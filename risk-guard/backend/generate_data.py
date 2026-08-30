import csv
import math
import os
import random

def generate_synthetic_transactions(num_rows=5000, output_path="backend/data/transactions.csv"):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    random.seed(42)

    payment_methods = ["credit_card", "debit_card", "upi", "net_banking", "wallet"]
    # Weight payment methods realistically (credit card & upi being common)
    pm_weights = [0.40, 0.20, 0.25, 0.10, 0.05]

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

    for i in range(1, num_rows + 1):
        txn_id = f"txn_{100000 + i}"
        
        # Decide if this is a high-risk profile or regular profile
        # Account age: mixture of new accounts (exponential/gamma-like) and established accounts
        is_new_user = random.random() < 0.25
        if is_new_user:
            customer_age_days = random.randint(0, 14)
        else:
            customer_age_days = int(random.expovariate(1/180)) + 15
            customer_age_days = min(customer_age_days, 1500)

        # Base transaction amount: log-normal distribution (e.g. median ~₹800-1500, with long tail)
        base_amount = random.lognormvariate(mu=7.2, sigma=0.9)
        amount = round(max(50.0, min(base_amount, 75000.0)), 2)

        # Order count in past 30 days
        if is_new_user:
            order_count_past_30d = random.randint(1, 4)
        else:
            order_count_past_30d = min(int(random.expovariate(1/4)), 30)

        # Refund count in past 90 days
        if order_count_past_30d > 0:
            refund_rate = random.choice([0.0, 0.0, 0.0, 0.05, 0.15, 0.4])
            refund_count_past_90d = min(int(order_count_past_30d * refund_rate + (1 if random.random() < 0.05 else 0)), 12)
        else:
            refund_count_past_90d = 0

        # Device change flag (higher for suspicious actors)
        device_change_flag = 1 if random.random() < 0.12 else 0

        # Shipping vs billing address mismatch
        shipping_billing_mismatch = 1 if random.random() < 0.10 else 0

        # Payment method
        payment_method = random.choices(payment_methods, weights=pm_weights)[0]

        # Hour of day (circadian rhythm: low at 2-5 AM, peak afternoon/evening)
        hour_weights = [
            1, 1, 0.5, 0.5, 0.5, 1, 2, 3, 5, 7, 8, 9, 9, 8, 8, 8, 9, 10, 10, 9, 8, 6, 4, 2
        ]
        hour_of_day = random.choices(range(24), weights=hour_weights)[0]

        # --- REALISTIC CORRELATED RISK SCORING MODEL ---
        # Log-odds of chargeback
        logit = -4.5  # Base rate logit (around 1.1% base rate)

        # Factor 1: Brand new customer with large amount
        if customer_age_days < 7 and amount > 5000:
            logit += 2.2 * (math.log10(amount) - 3.5)
        elif customer_age_days < 3:
            logit += 0.8

        # Factor 2: Shipping / Billing address mismatch + high amount
        if shipping_billing_mismatch == 1:
            logit += 1.4
            if amount > 8000:
                logit += 1.2

        # Factor 3: Device change + new account or rapid velocity
        if device_change_flag == 1:
            logit += 0.9
            if order_count_past_30d > 10:
                logit += 1.6
            if customer_age_days < 10:
                logit += 1.1

        # Factor 4: High refund history (friendly fraud / serial refund abuse)
        if refund_count_past_90d >= 3:
            logit += 1.5 + 0.4 * (refund_count_past_90d - 3)

        # Factor 5: Late night transactions (1 AM to 5 AM) with credit cards & high amount
        if 1 <= hour_of_day <= 5:
            logit += 0.7
            if payment_method == "credit_card" and amount > 6000:
                logit += 1.3

        # Factor 6: Payment method risk differentiation (Credit cards are prone to chargeback disputes)
        if payment_method == "credit_card":
            logit += 0.4
        elif payment_method == "upi":
            logit -= 0.6  # UPI chargebacks are rarer due to 2FA PIN auth

        # Convert logit to probability via sigmoid
        risk_prob = 1.0 / (1.0 + math.exp(-logit))

        # Determine binary label with realistic noise/stochasticity
        is_chargeback = 1 if random.random() < risk_prob else 0
        if is_chargeback == 1:
            chargeback_count += 1

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
            is_chargeback
        ])

    with open(output_path, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(rows)

    print(f"Generated {num_rows} transactions saved to {output_path}")
    print(f"Total chargebacks: {chargeback_count} ({(chargeback_count/num_rows)*100:.2f}%)")

if __name__ == "__main__":
    generate_synthetic_transactions(5000, "backend/data/transactions.csv")
