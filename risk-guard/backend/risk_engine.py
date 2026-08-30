import os
import joblib
import numpy as np
import pandas as pd
import shap

class RiskEngine:
    def __init__(self, model_path="model.pkl"):
        curr_dir = os.path.dirname(os.path.abspath(__file__))
        candidates = [
            model_path,
            os.path.join(curr_dir, model_path),
            os.path.join(curr_dir, "model.pkl"),
            os.path.join(os.getcwd(), model_path),
            os.path.join(os.getcwd(), "backend", model_path)
        ]
        
        resolved_path = None
        for p in candidates:
            if p and os.path.exists(p):
                resolved_path = p
                break
                
        if not resolved_path:
            resolved_path = os.path.join(curr_dir, "model.pkl")

        print(f"[*] Loading Risk Model bundle from: {resolved_path}")
        self.bundle = joblib.load(resolved_path)
        self.pipeline = self.bundle["pipeline"]
        self.preprocessor = self.pipeline.named_steps["preprocessor"]
        self.classifier = self.pipeline.named_steps["classifier"]
        self.feature_cols = self.bundle["feature_cols"]
        self.metrics = self.bundle.get("metrics", {})
        self.optimal_threshold = self.bundle.get("optimal_threshold", 0.50)

        # Initialize SHAP TreeExplainer on the Random Forest classifier
        print("[*] Initializing SHAP TreeExplainer...")
        self.explainer = shap.TreeExplainer(self.classifier)

        # Cache transformed feature names from the preprocessor
        self.transformed_feature_names = self._get_feature_names()

    def _get_feature_names(self):
        try:
            return self.preprocessor.get_feature_names_out()
        except Exception:
            return [f"feat_{i}" for i in range(25)]

    def _preprocess_input(self, txn_dict: dict) -> pd.DataFrame:
        df = pd.DataFrame([txn_dict])
        
        # Apply deterministic feature engineering
        df["refund_to_order_ratio"] = df["refund_count_past_90d"] / (df["order_count_past_30d"] + 1)
        df["amount_per_account_day"] = df["amount"] / (df["customer_age_days"] + 1)
        df["is_night_txn"] = df["hour_of_day"].apply(lambda h: 1 if 1 <= h <= 5 or h == 0 or h == 23 else 0)
        df["compound_risk_mismatch_device"] = (
            (df["shipping_billing_mismatch"] == 1) & (df["device_change_flag"] == 1)
        ).astype(int)
        df["fresh_account_flag"] = (df["customer_age_days"] <= 14).astype(int)

        # Ensure correct column ordering
        return df[self.feature_cols]

    def _format_human_reason(self, feature_name: str, shap_val: float, raw_data: dict) -> str:
        amount = raw_data.get("amount", 0)
        age = raw_data.get("customer_age_days", 0)
        orders = raw_data.get("order_count_past_30d", 0)
        refunds = raw_data.get("refund_count_past_90d", 0)
        device_change = raw_data.get("device_change_flag", 0)
        mismatch = raw_data.get("shipping_billing_mismatch", 0)
        hour = raw_data.get("hour_of_day", 0)
        pm = raw_data.get("payment_method", "").replace("_", " ").title()

        if "compound_risk_mismatch_device" in feature_name:
            if mismatch == 1 and device_change == 1:
                return "Compound Risk: Simultaneous address mismatch AND unrecognized device signature"
            return "Consistent device & billing address verification"

        elif "shipping_billing_mismatch" in feature_name:
            if mismatch == 1:
                return "Billing & Shipping address mismatch (Elevated card-not-present fraud risk)"
            return "Verified shipping & billing address match"

        elif "customer_age_days" in feature_name or "amount_per_account_day" in feature_name or "fresh_account_flag" in feature_name:
            if age < 7:
                return f"Transaction on brand new account ({age} days old)"
            elif age < 25:
                return f"Young account profile ({age} days active)"
            return f"Established account tenure ({age} days active)"

        elif "refund_count_past_90d" in feature_name or "refund_to_order_ratio" in feature_name:
            if refunds >= 3:
                return f"Serial refund history ({refunds} refund requests in past 90 days - friendly fraud pattern)"
            return f"Clean return history ({refunds} refunds in past 90 days)"

        elif "device_change_flag" in feature_name:
            if device_change == 1:
                return "Transaction initiated from a newly detected device/fingerprint"
            return "Known verified device fingerprint"

        elif "order_count_past_30d" in feature_name:
            if orders >= 8:
                return f"High order velocity spike ({orders} orders in past 30 days)"
            return f"Standard purchasing velocity ({orders} orders in past 30 days)"

        elif "amount" in feature_name:
            if amount > 15000:
                return f"Elevated basket value of Rs. {amount:,.2f}"
            return f"Standard transaction amount of Rs. {amount:,.2f}"

        elif "hour_of_day" in feature_name or "is_night_txn" in feature_name:
            if 1 <= hour <= 5 or hour == 0 or hour == 23:
                return f"Off-peak night transaction timestamp ({hour:02d}:00 hrs)"
            return f"Standard daytime shopping hours ({hour:02d}:00 hrs)"

        elif "payment_method" in feature_name:
            if "credit_card" in feature_name:
                return f"Payment via {pm} (Card-not-present dispute exposure)"
            elif "upi" in feature_name:
                return "Payment via UPI (Secured by 2FA MPIN)"
            return f"Payment method: {pm}"

        return f"Feature '{feature_name}' contributed {shap_val:+.2f} to risk"

    def predict(self, txn_dict: dict) -> dict:
        df_processed = self._preprocess_input(txn_dict)
        X_trans = self.preprocessor.transform(df_processed)

        # Risk Probability (0 - 100)
        proba = self.pipeline.predict_proba(df_processed)[0, 1]
        risk_score = round(float(proba) * 100, 1)

        # SHAP attribution
        shap_raw = self.explainer.shap_values(X_trans)
        if isinstance(shap_raw, list):
            shap_for_fraud = shap_raw[1][0]
        elif len(shap_raw.shape) == 3:
            shap_for_fraud = shap_raw[0, :, 1]
        else:
            shap_for_fraud = shap_raw[0]

        feature_contributions = []
        for name, shap_val in zip(self.transformed_feature_names, shap_for_fraud):
            feature_contributions.append({
                "feature": name,
                "shap_value": float(shap_val),
                "abs_importance": abs(float(shap_val))
            })

        feature_contributions.sort(key=lambda x: x["shap_value"], reverse=True)

        top_reasons = []
        seen_topics = set()

        for item in feature_contributions:
            fname = item["feature"]
            root_topic = fname.split("__")[-1].split("_")[0]
            if root_topic in seen_topics and len(seen_topics) < 5:
                continue

            reason_str = self._format_human_reason(fname, item["shap_value"], txn_dict)
            if reason_str not in top_reasons:
                top_reasons.append(reason_str)
                seen_topics.add(root_topic)

            if len(top_reasons) == 3:
                break

        if len(top_reasons) < 3:
            for item in feature_contributions:
                reason_str = self._format_human_reason(item["feature"], item["shap_value"], txn_dict)
                if reason_str not in top_reasons:
                    top_reasons.append(reason_str)
                if len(top_reasons) == 3:
                    break

        # Tuned decision thresholds
        block_threshold = max(60.0, float(self.optimal_threshold * 100) + 12)
        review_threshold = max(25.0, float(self.optimal_threshold * 100) - 15)

        if risk_score >= block_threshold:
            decision = "BLOCK"
            action_recommendation = "Reject transaction / Step-up 3D Secure authentication"
        elif risk_score >= review_threshold:
            decision = "MANUAL_REVIEW"
            action_recommendation = "Route to Merchant Risk Analyst for manual dispatch review"
        else:
            decision = "APPROVE"
            action_recommendation = "Instant 1-Click Checkout Authorization"

        return {
            "transaction_id": txn_dict.get("transaction_id", "txn_live"),
            "risk_score": risk_score,
            "decision": decision,
            "action_recommendation": action_recommendation,
            "top_reasons": top_reasons,
            "raw_shap_breakdown": [
                {
                    "feature": f["feature"].split("__")[-1],
                    "contribution": round(f["shap_value"], 4)
                }
                for f in feature_contributions[:5]
            ]
        }

risk_engine_instance = None

def get_risk_engine():
    global risk_engine_instance
    if risk_engine_instance is None:
        risk_engine_instance = RiskEngine()
    return risk_engine_instance
