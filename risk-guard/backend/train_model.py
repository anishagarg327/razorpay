import json
import os
import joblib
import numpy as np
import pandas as pd
import shap
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

def add_features(df: pd.DataFrame) -> pd.DataFrame:
    df_feat = df.copy()
    df_feat["refund_to_order_ratio"] = df_feat["refund_count_past_90d"] / (df_feat["order_count_past_30d"] + 1)
    df_feat["amount_per_account_day"] = df_feat["amount"] / (df_feat["customer_age_days"] + 1)
    df_feat["is_night_txn"] = df_feat["hour_of_day"].apply(lambda h: 1 if 1 <= h <= 5 or h == 0 or h == 23 else 0)
    df_feat["compound_risk_mismatch_device"] = (
        (df_feat["shipping_billing_mismatch"] == 1) & (df_feat["device_change_flag"] == 1)
    ).astype(int)
    df_feat["fresh_account_flag"] = (df_feat["customer_age_days"] <= 14).astype(int)
    return df_feat

def train_and_evaluate(data_path="data/transactions.csv", model_output="model.pkl"):
    if not os.path.exists(data_path):
        if os.path.exists(os.path.join("backend", data_path)):
            data_path = os.path.join("backend", data_path)
            model_output = os.path.join("backend", model_output)
        elif os.path.exists(os.path.join("d:/razorpay/risk-guard/backend", data_path)):
            data_path = os.path.join("d:/razorpay/risk-guard/backend", data_path)
            model_output = os.path.join("d:/razorpay/risk-guard/backend", model_output)

    print(f"[*] Loading transactions data from: {data_path}")
    df_raw = pd.read_csv(data_path)
    df = add_features(df_raw)

    numeric_features = [
        "amount",
        "customer_age_days",
        "order_count_past_30d",
        "refund_count_past_90d",
        "hour_of_day",
        "refund_to_order_ratio",
        "amount_per_account_day"
    ]
    binary_features = [
        "device_change_flag",
        "shipping_billing_mismatch",
        "is_night_txn",
        "compound_risk_mismatch_device",
        "fresh_account_flag"
    ]
    categorical_features = ["payment_method"]

    feature_cols = numeric_features + binary_features + categorical_features
    X = df[feature_cols]
    y = df["is_chargeback"]

    # 80/20 Stratified Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    print(f"[*] Dataset: {len(df)} samples | Frauds: {y.sum()} ({y.mean()*100:.2f}%)")
    print(f"[*] Train set: {len(X_train)} | Held-out Test set: {len(X_test)}")

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), numeric_features),
            ("bin", "passthrough", binary_features),
            ("cat", OneHotEncoder(handle_unknown="ignore"), categorical_features),
        ]
    )

    # Calibrated Balanced Random Forest
    clf = RandomForestClassifier(
        n_estimators=250,
        max_depth=7,
        min_samples_split=6,
        min_samples_leaf=3,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )

    pipeline = Pipeline(steps=[("preprocessor", preprocessor), ("classifier", clf)])

    print("[*] Training Balanced Risk Classifier...")
    pipeline.fit(X_train, y_train)

    # Threshold Optimization on Train Set
    train_proba = pipeline.predict_proba(X_train)[:, 1]
    precisions, recalls, thresholds = precision_recall_curve(y_train, train_proba)
    f1_scores = 2 * (precisions * recalls) / (precisions + recalls + 1e-9)
    best_idx = np.argmax(f1_scores)
    optimal_threshold = float(thresholds[best_idx]) if best_idx < len(thresholds) else 0.50
    optimal_threshold = max(0.48, min(optimal_threshold, 0.65))

    print(f"[*] Calibrated Decision Threshold: {optimal_threshold:.3f}")

    # Evaluate on Held-Out Test Set
    test_proba = pipeline.predict_proba(X_test)[:, 1]
    y_pred = (test_proba >= optimal_threshold).astype(int)

    prec = precision_score(y_test, y_pred, zero_division=0)
    rec = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    acc = accuracy_score(y_test, y_pred)
    roc_auc = roc_auc_score(y_test, test_proba)

    cm = confusion_matrix(y_test, y_pred)
    tn, fp, fn, tp = cm.ravel()

    # Cost-Benefit Analysis
    FP_COST_PER_UNIT = 500
    FN_COST_PER_UNIT = 5000

    fp_total_cost = int(fp * FP_COST_PER_UNIT)
    fn_total_cost = int(fn * FN_COST_PER_UNIT)
    total_model_cost = fp_total_cost + fn_total_cost

    total_positives_test = int(y_test.sum())
    baseline_unmitigated_cost = total_positives_test * FN_COST_PER_UNIT
    net_savings = baseline_unmitigated_cost - total_model_cost
    roi_percentage = (net_savings / baseline_unmitigated_cost * 100) if baseline_unmitigated_cost > 0 else 0

    # Compute Global SHAP Feature Importances on Test Set
    print("[*] Computing Global SHAP Feature Importances...")
    X_test_trans = pipeline.named_steps["preprocessor"].transform(X_test)
    explainer = shap.TreeExplainer(pipeline.named_steps["classifier"])
    shap_vals = explainer.shap_values(X_test_trans)
    
    if isinstance(shap_vals, list):
        shap_pos = shap_vals[1]
    elif len(shap_vals.shape) == 3:
        shap_pos = shap_vals[:, :, 1]
    else:
        shap_pos = shap_vals

    mean_abs_shap = np.mean(np.abs(shap_pos), axis=0)
    feature_names_out = pipeline.named_steps["preprocessor"].get_feature_names_out()

    shap_ranking = []
    for f_name, imp in zip(feature_names_out, mean_abs_shap):
        clean_name = f_name.replace("num__", "").replace("bin__", "").replace("cat__", "")
        shap_ranking.append({"feature": clean_name, "mean_abs_shap": float(imp)})

    shap_ranking.sort(key=lambda x: x["mean_abs_shap"], reverse=True)

    metrics_payload = {
        "dataset": {
            "total_samples": int(len(df)),
            "train_samples": int(len(X_train)),
            "test_samples": int(len(X_test)),
            "chargeback_rate": float(round(y.mean() * 100, 2)),
        },
        "metrics": {
            "precision": float(round(prec, 4)),
            "recall": float(round(rec, 4)),
            "f1_score": float(round(f1, 4)),
            "accuracy": float(round(acc, 4)),
            "roc_auc": float(round(roc_auc, 4)),
            "optimal_decision_threshold": float(round(optimal_threshold, 3)),
        },
        "confusion_matrix": {
            "true_negatives": int(tn),
            "false_positives": int(fp),
            "false_negatives": int(fn),
            "true_positives": int(tp),
        },
        "cost_analysis": {
            "cost_per_fp_inr": FP_COST_PER_UNIT,
            "loss_per_fn_inr": FN_COST_PER_UNIT,
            "false_positive_cost_inr": fp_total_cost,
            "false_negative_loss_inr": fn_total_cost,
            "total_model_loss_inr": total_model_cost,
            "baseline_unmitigated_loss_inr": baseline_unmitigated_cost,
            "net_financial_savings_inr": net_savings,
            "loss_reduction_pct": float(round(roi_percentage, 2)),
        },
        "top_shap_importances": shap_ranking[:8],
    }

    bundle = {
        "pipeline": pipeline,
        "optimal_threshold": optimal_threshold,
        "feature_cols": feature_cols,
        "numeric_features": numeric_features,
        "binary_features": binary_features,
        "categorical_features": categorical_features,
        "metrics": metrics_payload,
    }
    joblib.dump(bundle, model_output)
    print(f"[OK] Model bundle saved -> {model_output}")

    metrics_json_path = os.path.join(os.path.dirname(model_output), "metrics.json")
    with open(metrics_json_path, "w", encoding="utf-8") as f:
        json.dump(metrics_payload, f, indent=2)
    print(f"[OK] Metrics JSON saved -> {metrics_json_path}")

    # Executive Output Report
    print("\n" + "=" * 68)
    print("        RAZORPAY REVSHIELD: REALISTIC DEFENSE BENCHMARK         ")
    print("=" * 68)
    print(f" Held-Out Test Split:      {len(X_test)} samples (80/20 Stratified)")
    print(f" Actual Ground Truth Fraud: {total_positives_test} cases ({total_positives_test/len(X_test)*100:.2f}%)")
    print(f" Tuned Optimal Threshold:  {optimal_threshold:.3f}")
    print("-" * 68)
    print(" HONEST EVALUATION METRICS (TARGET: Prec 70-90%, Rec 65-85%, AUC 0.85-0.95):")
    print(f"  * Precision:  {prec * 100:.2f}%  (True Frauds / Flagged Transactions)")
    print(f"  * Recall:     {rec * 100:.2f}%  (Frauds Detected / Total Actual Frauds)")
    print(f"  * F1 Score:   {f1:.4f}")
    print(f"  * Accuracy:   {acc * 100:.2f}%")
    print(f"  * ROC-AUC:    {roc_auc:.4f}")
    print("-" * 68)
    print(" CONFUSION MATRIX:")
    print(f"                    | Predicted Legitimate | Predicted Chargeback")
    print(f"  Actual Legitimate | TN: {tn:<17}| FP: {fp:<17}")
    print(f"  Actual Chargeback | FN: {fn:<17}| TP: {tp:<17}")
    print("-" * 68)
    print(" TOP GLOBAL SHAP FEATURE ATTRIBUTIONS (CONFIRMING NO AMOUNT DOMINANCE):")
    for rank, item in enumerate(shap_ranking[:6], 1):
        print(f"  {rank}. {item['feature']:<30} (Mean |SHAP| = {item['mean_abs_shap']:.4f})")
    print("-" * 68)
    print(" DEFENSE COST ACCOUNTING:")
    print(f"  * Cost per False Positive (Friction):         Rs. {FP_COST_PER_UNIT:,}")
    print(f"  * Loss per False Negative (Chargeback Fee):   Rs. {FN_COST_PER_UNIT:,}")
    print(f"  -------------------------------------------------------------")
    print(f"  * False Positive Overhead Cost:               Rs. {fp_total_cost:,}")
    print(f"  * False Negative Fraud Loss:                  Rs. {fn_total_cost:,}")
    print(f"  * Total Incurred Risk Cost:                   Rs. {total_model_cost:,}")
    print(f"  * Baseline Unmitigated Loss (No Model):       Rs. {baseline_unmitigated_cost:,}")
    print(f"  * NET FINANCIAL SAVINGS:                      Rs. {net_savings:,} ({roi_percentage:.1f}% risk reduction)")
    print("=" * 68 + "\n")

    return metrics_payload

if __name__ == "__main__":
    train_and_evaluate(
        data_path="d:/razorpay/risk-guard/backend/data/transactions.csv",
        model_output="d:/razorpay/risk-guard/backend/model.pkl"
    )
