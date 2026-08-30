import csv
import io
import os
from contextlib import asynccontextmanager
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import pandas as pd
import numpy as np

from database import init_db, log_prediction, get_audit_logs, clear_audit_logs
from risk_engine import get_risk_engine

def _get_data_path():
    curr_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(curr_dir, "data", "transactions.csv"),
        os.path.join(curr_dir, "transactions.csv"),
        "data/transactions.csv",
        "backend/data/transactions.csv",
        "risk-guard/backend/data/transactions.csv"
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return os.path.join(curr_dir, "data", "transactions.csv")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database schema
    init_db()
    # Warm up risk engine & SHAP
    get_risk_engine()
    yield

app = FastAPI(
    title="Razorpay Risk-Guard AI Console",
    description="Defense-Only E-Commerce Risk Manager with SHAP Explainability & Real-Time Audit Trail",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for local and production Vercel frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TransactionInput(BaseModel):
    transaction_id: Optional[str] = Field(default="txn_sample", description="Unique transaction ID")
    amount: float = Field(..., ge=0.0, description="Transaction amount in INR")
    customer_age_days: int = Field(..., ge=0, description="Account age in days")
    order_count_past_30d: int = Field(..., ge=0, description="Total completed orders in last 30 days")
    refund_count_past_90d: int = Field(..., ge=0, description="Number of refund/return requests in last 90 days")
    device_change_flag: int = Field(..., ge=0, le=1, description="1 if new/unrecognized device fingerprint, else 0")
    shipping_billing_mismatch: int = Field(..., ge=0, le=1, description="1 if shipping address != billing address, else 0")
    payment_method: str = Field(default="credit_card", description="Payment method: credit_card, debit_card, upi, net_banking, wallet")
    hour_of_day: int = Field(..., ge=0, le=23, description="Hour of transaction (0-23)")

class PredictionResponse(BaseModel):
    transaction_id: str
    risk_score: float
    decision: str
    action_recommendation: str
    top_reasons: List[str]
    model_version: str = "v1.0-rf-shap"
    audit_log_id: Optional[int] = None
    raw_shap_breakdown: Optional[List[dict]] = None

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "Razorpay Risk-Guard AI Console",
        "version": "1.0.0",
        "track": "Track 2 - AI Risk Manager",
        "audit_logging": "active"
    }

@app.post("/predict", response_model=PredictionResponse)
@app.post("/api/predict", response_model=PredictionResponse)
def predict_transaction_risk(txn: TransactionInput):
    try:
        engine = get_risk_engine()
        txn_dict = txn.model_dump()
        result = engine.predict(txn_dict)
        
        # Log prediction to SQLite audit_log table (exactly 1 row inserted per call)
        model_ver = "v1.0-rf-shap"
        log_id = log_prediction(
            transaction_id=result["transaction_id"],
            risk_score=result["risk_score"],
            decision=result["decision"],
            reasons=result["top_reasons"],
            amount=txn.amount,
            payment_method=txn.payment_method,
            model_version=model_ver
        )
        
        result["model_version"] = model_ver
        result["audit_log_id"] = log_id
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

@app.get("/api/simulation/test-batch")
def get_simulation_test_batch(count: int = Query(default=1000, ge=10, le=2000)):
    try:
        data_path = _get_data_path()
        df = pd.read_csv(data_path)
        test_df = df.tail(count).copy().reset_index(drop=True)
        
        engine = get_risk_engine()
        
        # Vectorized feature preparation
        df_feat = test_df.copy()
        df_feat["refund_to_order_ratio"] = df_feat["refund_count_past_90d"] / (df_feat["order_count_past_30d"] + 1)
        df_feat["amount_per_account_day"] = df_feat["amount"] / (df_feat["customer_age_days"] + 1)
        df_feat["is_night_txn"] = df_feat["hour_of_day"].apply(lambda h: 1 if 1 <= h <= 5 or h == 0 or h == 23 else 0)
        df_feat["compound_risk_mismatch_device"] = (
            (df_feat["shipping_billing_mismatch"] == 1) & (df_feat["device_change_flag"] == 1)
        ).astype(int)
        df_feat["fresh_account_flag"] = (df_feat["customer_age_days"] <= 14).astype(int)
        
        X_df = df_feat[engine.feature_cols]
        probs = engine.pipeline.predict_proba(X_df)[:, 1]
        
        block_thresh = max(60.0, float(engine.optimal_threshold * 100) + 12)
        review_thresh = max(25.0, float(engine.optimal_threshold * 100) - 15)
        
        results = []
        for idx, row in test_df.iterrows():
            prob = float(probs[idx])
            risk_score = round(prob * 100, 1)
            
            if risk_score >= block_thresh:
                decision = "BLOCK"
                action_rec = "Reject transaction / Step-up 3D Secure authentication"
            elif risk_score >= review_thresh:
                decision = "MANUAL_REVIEW"
                action_rec = "Route to Merchant Risk Analyst for manual dispatch review"
            else:
                decision = "APPROVE"
                action_rec = "Instant 1-Click Checkout Authorization"

            ground_truth = int(row.get("is_chargeback", 0))
            is_predicted_fraud = 1 if decision in ["BLOCK", "MANUAL_REVIEW"] else 0
            
            if ground_truth == 1 and is_predicted_fraud == 1:
                outcome = "TP"
            elif ground_truth == 0 and is_predicted_fraud == 1:
                outcome = "FP"
            elif ground_truth == 1 and is_predicted_fraud == 0:
                outcome = "FN"
            else:
                outcome = "TN"

            reasons = []
            if row["shipping_billing_mismatch"] == 1 and row["device_change_flag"] == 1:
                reasons.append("Compound Risk: Address mismatch AND new device signature")
            elif row["shipping_billing_mismatch"] == 1:
                reasons.append("Billing & Shipping address mismatch")
            elif row["device_change_flag"] == 1:
                reasons.append("Unrecognized device fingerprint")

            if row["refund_count_past_90d"] >= 3:
                reasons.append(f"Serial refund history ({row['refund_count_past_90d']} in 90d)")
            if row["customer_age_days"] <= 14:
                reasons.append(f"Young account profile ({row['customer_age_days']} days active)")
            
            if not reasons:
                reasons = ["Standard verified profile", f"Payment via {str(row['payment_method']).replace('_', ' ').title()}"]

            results.append({
                "transaction_id": str(row.get("transaction_id", f"txn_sim_{idx}")),
                "amount": float(row["amount"]),
                "customer_age_days": int(row["customer_age_days"]),
                "order_count_past_30d": int(row["order_count_past_30d"]),
                "refund_count_past_90d": int(row["refund_count_past_90d"]),
                "device_change_flag": int(row["device_change_flag"]),
                "shipping_billing_mismatch": int(row["shipping_billing_mismatch"]),
                "payment_method": str(row["payment_method"]),
                "hour_of_day": int(row["hour_of_day"]),
                "risk_score": risk_score,
                "decision": decision,
                "action_recommendation": action_rec,
                "ground_truth": ground_truth,
                "is_predicted_fraud": is_predicted_fraud,
                "outcome": outcome,
                "top_reasons": reasons[:3]
            })

        return {
            "total_samples": len(results),
            "transactions": results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation batch error: {str(e)}")

@app.post("/api/batch-predict")
def batch_predict_transactions(transactions: List[TransactionInput]):
    try:
        engine = get_risk_engine()
        results = []
        approved_count = 0
        review_count = 0
        blocked_count = 0
        total_amount = 0.0
        blocked_amount = 0.0

        for txn in transactions:
            txn_dict = txn.model_dump()
            res = engine.predict(txn_dict)
            
            res["amount"] = txn.amount
            res["payment_method"] = txn.payment_method
            res["customer_age_days"] = txn.customer_age_days
            res["device_change_flag"] = txn.device_change_flag
            res["shipping_billing_mismatch"] = txn.shipping_billing_mismatch
            res["order_count_past_30d"] = txn.order_count_past_30d
            res["refund_count_past_90d"] = txn.refund_count_past_90d
            res["hour_of_day"] = txn.hour_of_day

            if res["decision"] == "APPROVE":
                approved_count += 1
            elif res["decision"] == "MANUAL_REVIEW":
                review_count += 1
            elif res["decision"] == "BLOCK":
                blocked_count += 1
                blocked_amount += txn.amount

            total_amount += txn.amount
            results.append(res)

        return {
            "total_processed": len(results),
            "summary": {
                "approved": approved_count,
                "manual_review": review_count,
                "blocked": blocked_count,
                "total_volume_inr": round(total_amount, 2),
                "fraud_blocked_volume_inr": round(blocked_amount, 2),
                "block_rate_pct": round((blocked_count / len(results) * 100) if results else 0, 2)
            },
            "results": results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch prediction error: {str(e)}")

@app.post("/api/upload-csv")
async def upload_and_score_csv(file: UploadFile = File(...)):
    try:
        content = await file.read()
        df = pd.read_csv(io.StringIO(content.decode("utf-8")))
        
        required_cols = [
            "amount", "customer_age_days", "order_count_past_30d",
            "refund_count_past_90d", "device_change_flag",
            "shipping_billing_mismatch", "payment_method", "hour_of_day"
        ]
        
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            raise HTTPException(status_code=400, detail=f"CSV is missing required columns: {missing}")

        engine = get_risk_engine()
        results = []
        approved_count = 0
        review_count = 0
        blocked_count = 0
        total_amount = 0.0
        blocked_amount = 0.0

        for idx, row in df.iterrows():
            txn_id = str(row.get("transaction_id", f"txn_batch_{idx+1}"))
            txn_dict = {
                "transaction_id": txn_id,
                "amount": float(row["amount"]),
                "customer_age_days": int(row["customer_age_days"]),
                "order_count_past_30d": int(row["order_count_past_30d"]),
                "refund_count_past_90d": int(row["refund_count_past_90d"]),
                "device_change_flag": int(row["device_change_flag"]),
                "shipping_billing_mismatch": int(row["shipping_billing_mismatch"]),
                "payment_method": str(row["payment_method"]),
                "hour_of_day": int(row["hour_of_day"])
            }
            
            res = engine.predict(txn_dict)

            res["amount"] = txn_dict["amount"]
            res["payment_method"] = txn_dict["payment_method"]
            res["customer_age_days"] = txn_dict["customer_age_days"]
            res["device_change_flag"] = txn_dict["device_change_flag"]
            res["shipping_billing_mismatch"] = txn_dict["shipping_billing_mismatch"]
            res["refund_count_past_90d"] = txn_dict["refund_count_past_90d"]
            res["order_count_past_30d"] = txn_dict["order_count_past_30d"]
            res["hour_of_day"] = txn_dict["hour_of_day"]

            if res["decision"] == "APPROVE":
                approved_count += 1
            elif res["decision"] == "MANUAL_REVIEW":
                review_count += 1
            elif res["decision"] == "BLOCK":
                blocked_count += 1
                blocked_amount += txn_dict["amount"]

            total_amount += txn_dict["amount"]
            results.append(res)

        return {
            "total_processed": len(results),
            "filename": file.filename,
            "summary": {
                "approved": approved_count,
                "manual_review": review_count,
                "blocked": blocked_count,
                "total_volume_inr": round(total_amount, 2),
                "fraud_blocked_volume_inr": round(blocked_amount, 2),
                "block_rate_pct": round((blocked_count / len(results) * 100) if results else 0, 2)
            },
            "results": results
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse or score CSV: {str(e)}")

@app.get("/audit")
@app.get("/api/audit")
def fetch_audit_logs(limit: int = Query(default=50, ge=1, le=100)):
    try:
        logs = get_audit_logs(limit=limit)
        return {
            "total_records": len(logs),
            "limit": limit,
            "logs": logs
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch audit logs: {str(e)}")

@app.post("/api/audit/clear")
@app.delete("/api/audit")
def clear_audit_trail():
    try:
        count = clear_audit_logs()
        return {
            "status": "success",
            "message": f"Successfully cleared {count} audit records",
            "cleared_count": count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear audit trail: {str(e)}")

@app.post("/api/audit/seed")
def seed_audit_trail():
    try:
        from seed_audit_history import generate_historical_logs, seed_database
        from database import DB_PATH
        entries = generate_historical_logs(36)
        seed_database(db_path=DB_PATH, entries=entries)
        return {
            "status": "success",
            "message": f"Successfully seeded {len(entries)} organic historical audit records",
            "seeded_count": len(entries)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to seed audit trail: {str(e)}")

@app.get("/api/metrics")
def get_model_metrics():
    engine = get_risk_engine()
    if not engine.metrics:
        raise HTTPException(status_code=404, detail="Metrics not found")
    return engine.metrics

@app.get("/api/transactions/sample")
def get_sample_transactions(limit: int = 25):
    data_path = _get_data_path()
    if not os.path.exists(data_path):
        raise HTTPException(status_code=404, detail="Transactions dataset not found")

    df = pd.read_csv(data_path).head(limit)
    return df.to_dict(orient="records")
