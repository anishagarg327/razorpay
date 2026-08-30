import datetime
import json
import os
import sqlite3
import time
from typing import List, Optional

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "risk_guard.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
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
    conn.commit()
    conn.close()
    print(f"[*] SQLite audit_log table initialized at: {DB_PATH}")

def log_prediction(
    transaction_id: str,
    risk_score: float,
    decision: str,
    reasons: List[str],
    amount: float = 0.0,
    payment_method: str = "credit_card",
    model_version: str = "v1.0-rf-shap"
) -> int:
    conn = get_connection()
    cursor = conn.cursor()
    
    # Backend deduplication guard: check if identical record was logged in the last 1.5 seconds
    cursor.execute("""
        SELECT id, timestamp FROM audit_log
        WHERE transaction_id = ? AND amount = ? AND payment_method = ?
        ORDER BY id DESC LIMIT 1
    """, (transaction_id, amount, payment_method))
    
    last_record = cursor.fetchone()
    if last_record:
        try:
            last_ts = datetime.datetime.fromisoformat(last_record["timestamp"])
            now_ts = datetime.datetime.now(datetime.timezone.utc)
            delta = (now_ts - last_ts).total_seconds()
            if delta < 1.5:
                # Deduplicate and return previous ID
                conn.close()
                return last_record["id"]
        except Exception:
            pass

    timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    reasons_json = json.dumps(reasons)
    
    cursor.execute("""
        INSERT INTO audit_log (
            timestamp, transaction_id, amount, payment_method, risk_score, decision, reasons, model_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        timestamp,
        transaction_id,
        amount,
        payment_method,
        risk_score,
        decision,
        reasons_json,
        model_version
    ))
    
    log_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return log_id

def get_audit_logs(limit: int = 50) -> List[dict]:
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, timestamp, transaction_id, amount, payment_method, risk_score, decision, reasons, model_version
        FROM audit_log
        ORDER BY id DESC
        LIMIT ?
    """, (limit,))
    
    rows = cursor.fetchall()
    logs = []
    for row in rows:
        reasons_raw = row["reasons"]
        try:
            reasons_list = json.loads(reasons_raw)
        except Exception:
            reasons_list = [reasons_raw]
            
        logs.append({
            "id": row["id"],
            "timestamp": row["timestamp"],
            "transaction_id": row["transaction_id"],
            "amount": row["amount"],
            "payment_method": row["payment_method"],
            "risk_score": row["risk_score"],
            "decision": row["decision"],
            "reasons": reasons_list,
            "model_version": row["model_version"],
        })
        
    conn.close()
    return logs

if __name__ == "__main__":
    init_db()
