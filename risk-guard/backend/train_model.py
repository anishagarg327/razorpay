import json
import os
import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

def train_and_evaluate(data_path="data/transactions.csv", model_output="model.pkl"):
    if not os.path.exists(data_path):
        if os.path.exists(os.path.join("backend", data_path)):
            data_path = os.path.join("backend", data_path)
            model_output = os.path.join("backend", model_output)

    print(f"[*] Loading transactions data from: {data_path}")
    df = pd.read_csv(data_path)

    # Feature Engineering
    df["refund_to_order_ratio"] = df["refund_count_past_90d"] / (df["order_count_past_30d"] + 1)
    df["amount_per_account_day"] = df["amount"] / (df["customer_age_days"] + 1)
    df["is_night_txn"] = df["hour_of_day"].apply(lambda h: 1 if 1 <= h <= 5 else 0)

    numeric_features = [
        "amount",
        "customer_age_days",
        "order_count_past_30d",
        "refund_count_past_90d",
        "hour_of_day",
        "refund_to_order_ratio",
        "amount_per_account_day"
    ]
    binary_features = ["device_change_flag", "shipping_billing_mismatch", "is_night_txn"]
    categorical_features = ["payment_method"]

    feature_cols = numeric_features + binary_features + categorical_features
    X = df[feature_cols]
    y = df["is_chargeback"]

    # 80/20 Train/Test Split (Stratified to maintain chargeback distribution)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    print(f"[*] Total dataset: {len(df)} samples | Chargebacks: {y.sum()} ({y.mean()*100:.2f}%)")
    print(f"[*] Train set: {len(X_train)} samples | Test set: {len(X_test)} samples")

    # Preprocessing Pipeline
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), numeric_features),
            ("bin", "passthrough", binary_features),
            ("cat", OneHotEncoder(handle_unknown="ignore"), categorical_features),
        ]
    )

    # Classifier: Tuned Random Forest with Balanced Class Weights
    clf = RandomForestClassifier(
        n_estimators=250,
        max_depth=10,
        min_samples_split=4,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )

    pipeline = Pipeline(steps=[("preprocessor", preprocessor), ("classifier", clf)])

    print("[*] Training Random Forest Risk Classifier...")
    pipeline.fit(X_train, y_train)

    # Predictions & Probabilities on Held-out Test Set
    y_pred = pipeline.predict(X_test)
    y_proba = pipeline.predict_proba(X_test)[:, 1]

    # Metrics
    prec = precision_score(y_test, y_pred, zero_division=0)
    rec = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    acc = accuracy_score(y_test, y_pred)
    roc_auc = roc_auc_score(y_test, y_proba)

    cm = confusion_matrix(y_test, y_pred)
    tn, fp, fn, tp = cm.ravel()

    # Cost-Benefit Analysis (Defense-Only Metrics)
    FP_COST_PER_UNIT = 500   # User friction / manual review / lost legitimate sale
    FN_COST_PER_UNIT = 5000  # Direct chargeback loss + gateway penalty fee

    fp_total_cost = int(fp * FP_COST_PER_UNIT)
    fn_total_cost = int(fn * FN_COST_PER_UNIT)
    total_model_cost = fp_total_cost + fn_total_cost

    # Baseline cost if no defense model was deployed
    total_positives_test = int(y_test.sum())
    baseline_unmitigated_cost = total_positives_test * FN_COST_PER_UNIT
    net_savings = baseline_unmitigated_cost - total_model_cost
    roi_percentage = (net_savings / baseline_unmitigated_cost * 100) if baseline_unmitigated_cost > 0 else 0

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
    }

    # Save complete model bundle
    bundle = {
        "pipeline": pipeline,
        "feature_cols": feature_cols,
        "numeric_features": numeric_features,
        "binary_features": binary_features,
        "categorical_features": categorical_features,
        "metrics": metrics_payload,
    }
    joblib.dump(bundle, model_output)
    print(f"[OK] Model saved to {model_output}")

    # Also save metrics as json
    metrics_json_path = os.path.join(os.path.dirname(model_output), "metrics.json")
    with open(metrics_json_path, "w", encoding="utf-8") as f:
        json.dump(metrics_payload, f, indent=2)
    print(f"[OK] Metrics JSON saved to {metrics_json_path}")

    # Print Clean Metrics Report
    print("\n" + "=" * 65)
    print("      RAZORPAY RISK-GUARD: MODEL PERFORMANCE & COST REPORT      ")
    print("=" * 65)
    print(f" Test Set Size: {len(X_test)} rows (80/20 held-out split)")
    print(f" Positive Samples (Chargebacks): {total_positives_test}")
    print("-" * 65)
    print(" EVALUATION METRICS:")
    print(f"  * Precision:  {prec * 100:.2f}%  (True frauds / Flagged transactions)")
    print(f"  * Recall:     {rec * 100:.2f}%  (Frauds caught / Total actual frauds)")
    print(f"  * F1 Score:   {f1:.4f}")
    print(f"  * Accuracy:   {acc * 100:.2f}%")
    print(f"  * ROC-AUC:    {roc_auc:.4f}")
    print("-" * 65)
    print(" CONFUSION MATRIX:")
    print(f"                    | Predicted Legitimate | Predicted Chargeback")
    print(f"  Actual Legitimate | TN: {tn:<17}| FP: {fp:<17}")
    print(f"  Actual Chargeback | FN: {fn:<17}| TP: {tp:<17}")
    print("-" * 65)
    print(" COST & FINANCIAL IMPACT ANALYSIS (DEFENSE-ONLY):")
    print(f"  * Cost per False Positive (Friction/Review):  Rs. {FP_COST_PER_UNIT:,}")
    print(f"  * Loss per False Negative (Chargeback+Fee):   Rs. {FN_COST_PER_UNIT:,}")
    print(f"  -------------------------------------------------------------")
    print(f"  * False Positive Overhead Cost:               Rs. {fp_total_cost:,}")
    print(f"  * False Negative Fraud Loss:                  Rs. {fn_total_cost:,}")
    print(f"  * Total Incurred Risk Cost:                   Rs. {total_model_cost:,}")
    print(f"  * Baseline Unmitigated Loss (No Model):       Rs. {baseline_unmitigated_cost:,}")
    print(f"  * NET FINANCIAL SAVINGS:                      Rs. {net_savings:,} ({roi_percentage:.1f}% reduction)")
    print("=" * 65 + "\n")

    return metrics_payload

if __name__ == "__main__":
    train_and_evaluate(
        data_path="d:/razorpay/risk-guard/backend/data/transactions.csv",
        model_output="d:/razorpay/risk-guard/backend/model.pkl"
    )
