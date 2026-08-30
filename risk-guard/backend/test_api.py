import json
import urllib.request

def test_prediction(title, payload):
    print("=" * 65)
    print(f" TEST SCENARIO: {title}")
    print("=" * 65)
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        "http://127.0.0.1:8000/predict",
        data=data,
        headers={"Content-Type": "application/json"}
    )
    res = urllib.request.urlopen(req)
    result = json.loads(res.read().decode("utf-8"))
    
    print(f" Transaction ID:        {result['transaction_id']}")
    print(f" Amount:                Rs. {payload['amount']:,.2f}")
    print(f" Payment Method:        {payload['payment_method']}")
    print(f" Risk Score:            {result['risk_score']} / 100")
    print(f" Final Decision:        {result['decision']}")
    print(f" Defense Action:        {result['action_recommendation']}")
    print("-" * 65)
    print(" Top SHAP Risk Drivers (Explainability):")
    for i, reason in enumerate(result["top_reasons"], 1):
        print(f"   {i}. {reason}")
    print("=" * 65 + "\n")

if __name__ == "__main__":
    # 1. Suspicious / High-Risk Transaction
    test_prediction("High-Risk Fraud / Chargeback Attempt", {
        "transaction_id": "txn_suspicious_881",
        "amount": 28500.0,
        "customer_age_days": 2,
        "order_count_past_30d": 14,
        "refund_count_past_90d": 5,
        "device_change_flag": 1,
        "shipping_billing_mismatch": 1,
        "payment_method": "credit_card",
        "hour_of_day": 3
    })

    # 2. Legitimate / Low-Risk Transaction
    test_prediction("Legitimate Everyday Customer Purchase", {
        "transaction_id": "txn_legit_102",
        "amount": 1250.0,
        "customer_age_days": 340,
        "order_count_past_30d": 3,
        "refund_count_past_90d": 0,
        "device_change_flag": 0,
        "shipping_billing_mismatch": 0,
        "payment_method": "upi",
        "hour_of_day": 16
    })
