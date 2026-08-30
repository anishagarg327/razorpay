import datetime
import json
import os
import random
import sqlite3

def generate_historical_logs(count=36):
    now = datetime.datetime.now(datetime.timezone.utc)

    # 36 realistic organic transactions over the past 4 days
    archetypes = [
        # (Decision, Score range, Reasons generator, Amount range, Payment method)
        ("APPROVE", (0.5, 12.0), "legit_regular", (450, 4800), ["upi", "debit_card", "net_banking", "upi"]),
        ("APPROVE", (1.0, 15.0), "legit_cc", (1200, 18500), ["credit_card", "credit_card", "upi"]),
        ("APPROVE", (2.0, 18.0), "legit_established", (800, 9500), ["upi", "wallet", "debit_card"]),
        ("MANUAL_REVIEW", (32.0, 48.0), "review_device", (3500, 22000), ["credit_card", "debit_card"]),
        ("MANUAL_REVIEW", (42.0, 58.0), "review_mismatch", (6200, 29000), ["credit_card", "net_banking"]),
        ("BLOCK", (78.0, 96.5), "block_ato_mismatch", (12000, 42000), ["credit_card", "credit_card"]),
        ("BLOCK", (82.0, 98.0), "block_serial_refund", (4500, 18900), ["credit_card", "debit_card", "wallet"]),
        ("BLOCK", (74.0, 92.0), "block_fresh_velocity", (8500, 28000), ["credit_card", "credit_card"]),
    ]

    # Weighted distribution: 75% Approve, 15% Review, 10% Block
    distribution_pool = (
        [archetypes[0]] * 12 +
        [archetypes[1]] * 10 +
        [archetypes[2]] * 5 +
        [archetypes[3]] * 3 +
        [archetypes[4]] * 2 +
        [archetypes[5]] * 2 +
        [archetypes[6]] * 1 +
        [archetypes[7]] * 1
    )

    random.seed(1337)
    random.shuffle(distribution_pool)
    distribution_pool = distribution_pool[:count]

    # Generate descending time intervals over the last 96 hours
    time_offsets_minutes = sorted([random.randint(12, 5700) for _ in range(count)], reverse=True)

    entries = []
    for i, (decision, score_range, arch_type, amt_range, pm_list) in enumerate(distribution_pool):
        ts = (now - datetime.timedelta(minutes=time_offsets_minutes[i])).isoformat()
        
        # Organic transaction ID style
        txn_prefix = random.choice(["txn_pay_", "pay_", "txn_202608_"])
        txn_rand = "".join(random.choices("0123456789abcdefABCDEF", k=8))
        txn_id = f"{txn_prefix}{txn_rand}"
        
        score = round(random.uniform(score_range[0], score_range[1]), 1)
        amount = round(random.uniform(amt_range[0], amt_range[1]), 2)
        pm = random.choice(pm_list)
        pm_display = pm.replace("_", " ").title()

        # Consistent SHAP reasoning aligned with model's actual feature rankings
        if arch_type == "legit_regular":
            reasons = [
                "Clean return history (0 refunds in past 90 days)",
                "Verified shipping & billing address match",
                "Payment via UPI (Secured by 2FA MPIN)" if pm == "upi" else "Known verified device fingerprint"
            ]
        elif arch_type == "legit_cc":
            age = random.randint(90, 450)
            reasons = [
                f"Established account tenure ({age} days active)",
                "Verified shipping & billing address match",
                "Clean return history (0 refunds in past 90 days)"
            ]
        elif arch_type == "legit_established":
            age = random.randint(120, 600)
            reasons = [
                f"Established account tenure ({age} days active)",
                "Consistent device & billing address verification",
                "Standard purchasing velocity (3 orders in past 30 days)"
            ]
        elif arch_type == "review_device":
            reasons = [
                "Transaction initiated from a newly detected device/fingerprint",
                "Young account profile (18 days active)",
                f"Payment via {pm_display} (Card-not-present dispute exposure)"
            ]
        elif arch_type == "review_mismatch":
            reasons = [
                "Billing & Shipping address mismatch (Elevated card-not-present fraud risk)",
                "Standard purchasing velocity (4 orders in past 30 days)",
                f"Payment via {pm_display}"
            ]
        elif arch_type == "block_ato_mismatch":
            age = random.randint(1, 4)
            reasons = [
                "Compound Risk: Simultaneous address mismatch AND unrecognized device signature",
                f"Transaction on brand new account ({age} days old)",
                "Off-peak night transaction timestamp (03:00 hrs)"
            ]
        elif arch_type == "block_serial_refund":
            ref_cnt = random.randint(4, 7)
            reasons = [
                f"Serial refund history ({ref_cnt} refund requests in past 90 days - friendly fraud pattern)",
                "Elevated return-to-order ratio (0.65)",
                f"Payment via {pm_display} (Card-not-present dispute exposure)"
            ]
        else: # block_fresh_velocity
            orders = random.randint(12, 18)
            age = random.randint(2, 6)
            reasons = [
                f"High order velocity spike ({orders} orders in past 30 days)",
                f"Transaction on brand new account ({age} days old)",
                "Unrecognized device fingerprint"
            ]

        entries.append({
            "timestamp": ts,
            "transaction_id": txn_id,
            "amount": amount,
            "payment_method": pm,
            "risk_score": score,
            "decision": decision,
            "reasons": reasons,
            "model_version": "v1.0-rf-shap"
        })

    return entries

def seed_database(db_path=None, entries=None):
    if not db_path:
        curr_dir = os.path.dirname(os.path.abspath(__file__))
        db_path = os.path.join(curr_dir, "risk_guard.db")

    if not entries:
        entries = generate_historical_logs(36)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Ensure table exists
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            transaction_id TEXT NOT NULL,
            amount REAL DEFAULT 0.0,
            payment_method TEXT DEFAULT 'credit_card',
            risk_score REAL NOT NULL,
            decision TEXT NOT NULL,
            reasons TEXT NOT NULL,
            model_version TEXT NOT NULL
        )
    """)
    
    # Reset existing rows
    cursor.execute("DELETE FROM audit_log")
    cursor.execute("DELETE FROM sqlite_sequence WHERE name='audit_log'")

    for e in entries:
        cursor.execute("""
            INSERT INTO audit_log (
                timestamp, transaction_id, amount, payment_method, risk_score, decision, reasons, model_version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            e["timestamp"],
            e["transaction_id"],
            e["amount"],
            e["payment_method"],
            e["risk_score"],
            e["decision"],
            json.dumps(e["reasons"]),
            e["model_version"]
        ))

    conn.commit()
    cursor.execute("SELECT COUNT(*) FROM audit_log")
    count = cursor.fetchone()[0]
    conn.close()
    print(f"[OK] Successfully seeded {count} organic historical audit entries into: {db_path}")
    return entries

if __name__ == "__main__":
    seed_database()
