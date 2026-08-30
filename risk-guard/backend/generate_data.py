import csv
import math
import os
import random
import numpy as np

def generate_synthetic_transactions(num_rows=5000, output_path="data/transactions.csv"):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    np.random.seed(42)
    random.seed(42)

    payment_methods = ["credit_card", "debit_card", "upi", "net_banking", "wallet"]
    pm_weights_legit = [0.34, 0.24, 0.32, 0.06, 0.04]
    pm_weights_fraud = [0.60, 0.22, 0.10, 0.05, 0.03]

    headers = [
        "transaction_id",
        "amount",
        "customer_age_days",
        "order_count_past_30d",
        "refund_count_past_90d",
        "device_change_flag",
        "shipping_billing_mismatch",
        "payment_method",
        "hour_of_day",
        "is_chargeback"
    ]

    rows = []
    chargeback_count = 0
    target_fraud_count = int(num_rows * 0.05)
    fraud_indices = set(random.sample(range(num_rows), target_fraud_count))

    for i in range(num_rows):
        txn_id = f"txn_{100000 + i + 1}"
        is_fraud = 1 if i in fraud_indices else 0

        # Amount: EXACT SAME distribution for both Legit & Fraud (ZERO LEAKAGE)
        base_amount = np.random.lognormal(mean=7.2, sigma=0.82)
        amount = round(float(np.clip(base_amount, 100.0, 48000.0)), 2)

        if is_fraud:
            # Fraud profile: Higher probability of compound risk signals with natural overlap
            # 70% young accounts (<20 days), 30% seasoned compromised accounts
            if random.random() < 0.70:
                customer_age_days = random.randint(0, 18)
            else:
                customer_age_days = int(np.random.exponential(140)) + 19

            order_count_past_30d = int(np.random.poisson(lam=6.0))
            order_count_past_30d = min(order_count_past_30d, 30)

            # 45% have elevated refund history (friendly fraud)
            if random.random() < 0.45:
                refund_count_past_90d = random.randint(2, 6)
            else:
                refund_count_past_90d = random.choice([0, 1])

            # 52% have device change, 55% address mismatch
            device_change_flag = 1 if random.random() < 0.52 else 0
            shipping_billing_mismatch = 1 if random.random() < 0.55 else 0

            payment_method = random.choices(payment_methods, weights=pm_weights_fraud)[0]

            # 35% late night
            if random.random() < 0.35:
                hour_of_day = random.choice([0, 1, 2, 3, 4, 5, 23])
            else:
                hour_of_day = random.randint(6, 22)

            chargeback_count += 1

        else:
            # Legitimate profile: Mostly mature accounts, low refunds, matching address
            # 14% legitimate users are also new accounts (natural overlap)
            if random.random() < 0.14:
                customer_age_days = random.randint(0, 18)
            else:
                customer_age_days = int(np.random.exponential(180)) + 19

            order_count_past_30d = int(np.random.poisson(lam=3.5))
            order_count_past_30d = min(order_count_past_30d, 25)

            # Only 6% legitimate users have refunds
            if random.random() < 0.06:
                refund_count_past_90d = 1
            else:
                refund_count_past_90d = 0

            # 8% legitimate users buy on new device, 7% have gift address mismatch
            device_change_flag = 1 if random.random() < 0.08 else 0
            shipping_billing_mismatch = 1 if random.random() < 0.07 else 0

            payment_method = random.choices(payment_methods, weights=pm_weights_legit)[0]

            hour_weights = [
                1, 1, 0.5, 0.5, 0.5, 1, 2, 3, 5, 7, 8, 9, 9, 8, 8, 8, 9, 10, 10, 9, 8, 6, 4, 2
            ]
            hour_of_day = random.choices(range(24), weights=hour_weights)[0]

        customer_age_days = min(customer_age_days, 1500)

        rows.append([
            txn_id,
            amount,
            customer_age_days,
            order_count_past_30d,
            refund_count_past_90d,
            device_change_flag,
            shipping_billing_mismatch,
            payment_method,
            hour_of_day,
            is_fraud
        ])

    with open(output_path, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(rows)

    print(f"[OK] Generated {num_rows} transactions -> {output_path}")
    print(f"[OK] Total chargebacks: {chargeback_count} ({(chargeback_count/num_rows)*100:.2f}%)")

if __name__ == "__main__":
    generate_synthetic_transactions(5000, "d:/razorpay/risk-guard/backend/data/transactions.csv")
