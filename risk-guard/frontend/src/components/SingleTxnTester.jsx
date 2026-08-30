import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, ShieldCheck, AlertTriangle, Sparkles, RefreshCw, Zap, Clock, Smartphone, MapPin, CreditCard, RotateCcw } from 'lucide-react';

const PRESETS = [
  {
    name: '🚨 High-Risk Card Takeover',
    desc: 'New user, ₹28.5k, CC, Mismatch, 3 AM',
    data: {
      amount: 28500,
      customer_age_days: 2,
      order_count_past_30d: 14,
      refund_count_past_90d: 4,
      device_change_flag: 1,
      shipping_billing_mismatch: 1,
      payment_method: 'credit_card',
      hour_of_day: 3,
    },
  },
  {
    name: '🔄 Serial Refund Abuser',
    desc: 'High refund history (6 in 90d)',
    data: {
      amount: 8900,
      customer_age_days: 45,
      order_count_past_30d: 8,
      refund_count_past_90d: 6,
      device_change_flag: 0,
      shipping_billing_mismatch: 0,
      payment_method: 'debit_card',
      hour_of_day: 14,
    },
  },
  {
    name: '✅ Trusted Regular Shopper',
    desc: 'Established UPI customer, ₹1,450',
    data: {
      amount: 1450,
      customer_age_days: 380,
      order_count_past_30d: 4,
      refund_count_past_90d: 0,
      device_change_flag: 0,
      shipping_billing_mismatch: 0,
      payment_method: 'upi',
      hour_of_day: 18,
    },
  },
];

export default function SingleTxnTester({ onPredictionComplete }) {
  const [form, setForm] = useState({
    transaction_id: 'txn_sim_' + Math.floor(100000 + Math.random() * 900000),
    amount: 18500,
    customer_age_days: 3,
    order_count_past_30d: 12,
    refund_count_past_90d: 3,
    device_change_flag: 1,
    shipping_billing_mismatch: 1,
    payment_method: 'credit_card',
    hour_of_day: 3,
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const initialMountRef = useRef(false);
  const debounceTimerRef = useRef(null);

  const executeApiCall = async (formData) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:8000/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error('Prediction API failed with status ' + res.status);
      const data = await res.json();
      setResult(data);
      if (onPredictionComplete) onPredictionComplete(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Run initial prediction once on component mount
  useEffect(() => {
    if (!initialMountRef.current) {
      initialMountRef.current = true;
      executeApiCall(form);
    }
  }, []);

  const handleChange = (field, value) => {
    const updated = { ...form, [field]: value };
    setForm(updated);

    // Debounce live slider updates to avoid duplicate/rapid requests
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      executeApiCall(updated);
    }, 250);
  };

  const applyPreset = (presetData) => {
    const updated = {
      ...presetData,
      transaction_id: 'txn_sim_' + Math.floor(100000 + Math.random() * 900000),
    };
    setForm(updated);
    executeApiCall(updated);
  };

  const getDecisionBadge = (decision) => {
    if (decision === 'BLOCK') {
      return {
        bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
        icon: <ShieldAlert className="w-5 h-5 text-rose-400 mr-2" />,
        label: 'BLOCK TRANSACTION (High Risk)',
      };
    }
    if (decision === 'MANUAL_REVIEW') {
      return {
        bg: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
        icon: <AlertTriangle className="w-5 h-5 text-amber-400 mr-2" />,
        label: 'FLAG FOR 2FA / MANUAL REVIEW',
      };
    }
    return {
      bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
      icon: <ShieldCheck className="w-5 h-5 text-emerald-400 mr-2" />,
      label: 'APPROVE INSTANTLY (Low Risk)',
    };
  };

  const badge = result ? getDecisionBadge(result.decision) : null;

  return (
    <div className="space-y-6">
      {/* Header & Preset Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center">
            <Zap className="w-5 h-5 text-yellow-400 mr-2" /> Live Real-Time Risk & SHAP Simulator
          </h2>
          <p className="text-xs text-slate-400">
            Adjust transaction parameters below to evaluate instant ML risk score and top SHAP feature attributions
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p, i) => (
            <button
              key={i}
              onClick={() => applyPreset(p.data)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-all hover:scale-[1.02] flex flex-col items-start"
            >
              <span>{p.name}</span>
              <span className="text-[10px] text-slate-400 font-normal">{p.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Form Controls Left (7 cols), Score & SHAP Right (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Input Form */}
        <div className="lg:col-span-7 bg-slate-900/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-800 space-y-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Transaction Parameters
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Amount */}
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-medium">Transaction Amount (₹)</span>
                <span className="font-mono text-emerald-400 font-bold text-sm">
                  ₹{Number(form.amount).toLocaleString('en-IN')}
                </span>
              </div>
              <input
                type="range"
                min="100"
                max="65000"
                step="250"
                value={form.amount}
                onChange={(e) => handleChange('amount', parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Account Age */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-medium">Customer Account Age</span>
                <span className="font-mono text-cyan-300 font-bold">{form.customer_age_days} days</span>
              </div>
              <input
                type="range"
                min="0"
                max="500"
                value={form.customer_age_days}
                onChange={(e) => handleChange('customer_age_days', parseInt(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>

            {/* Hour of Day */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-medium">Transaction Time</span>
                <span className="font-mono text-indigo-300 font-bold">
                  {form.hour_of_day}:00 hrs {form.hour_of_day >= 1 && form.hour_of_day <= 5 ? '(Late Night)' : ''}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="23"
                value={form.hour_of_day}
                onChange={(e) => handleChange('hour_of_day', parseInt(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>

            {/* Orders in past 30 days */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-medium">Past 30d Order Velocity</span>
                <span className="font-mono text-slate-200 font-bold">{form.order_count_past_30d} orders</span>
              </div>
              <input
                type="range"
                min="0"
                max="25"
                value={form.order_count_past_30d}
                onChange={(e) => handleChange('order_count_past_30d', parseInt(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Refunds in past 90 days */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-medium">Past 90d Refund Count</span>
                <span className={`font-mono font-bold ${form.refund_count_past_90d >= 3 ? 'text-rose-400' : 'text-slate-200'}`}>
                  {form.refund_count_past_90d} refunds
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={form.refund_count_past_90d}
                onChange={(e) => handleChange('refund_count_past_90d', parseInt(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
              />
            </div>

            {/* Payment Method */}
            <div className="space-y-1.5 sm:col-span-2">
              <span className="text-xs text-slate-300 font-medium">Payment Instrument</span>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {[
                  { id: 'credit_card', label: 'Credit Card' },
                  { id: 'debit_card', label: 'Debit Card' },
                  { id: 'upi', label: 'UPI PIN' },
                  { id: 'net_banking', label: 'Net Banking' },
                  { id: 'wallet', label: 'Wallet' },
                ].map((pm) => (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => handleChange('payment_method', pm.id)}
                    className={`py-2 px-2 rounded-xl text-xs font-medium border transition-all text-center ${
                      form.payment_method === pm.id
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-sm shadow-blue-500/20'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {pm.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Toggles: Device change & Address Mismatch */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-800/80">
            {/* Device Change */}
            <button
              type="button"
              onClick={() => handleChange('device_change_flag', form.device_change_flag ? 0 : 1)}
              className={`p-3 rounded-xl border flex items-center justify-between text-left transition-all ${
                form.device_change_flag
                  ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Smartphone className="w-4 h-4" />
                <span className="text-xs font-semibold">New Device Fingerprint</span>
              </div>
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${form.device_change_flag ? 'bg-amber-500 text-black' : 'bg-slate-800 text-slate-400'}`}>
                {form.device_change_flag ? 'YES' : 'NO'}
              </span>
            </button>

            {/* Shipping Billing Mismatch */}
            <button
              type="button"
              onClick={() => handleChange('shipping_billing_mismatch', form.shipping_billing_mismatch ? 0 : 1)}
              className={`p-3 rounded-xl border flex items-center justify-between text-left transition-all ${
                form.shipping_billing_mismatch
                  ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400'
              }`}
            >
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4" />
                <span className="text-xs font-semibold">Billing/Shipping Mismatch</span>
              </div>
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${form.shipping_billing_mismatch ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                {form.shipping_billing_mismatch ? 'YES' : 'NO'}
              </span>
            </button>
          </div>
        </div>

        {/* Right: Live SHAP Explainability & Decision Output */}
        <div className="lg:col-span-5 space-y-4">
          {error && (
            <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded-2xl text-xs text-rose-300">
              {error}
            </div>
          )}

          {result && (
            <div className="bg-slate-900/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-800 space-y-4">
              {/* Top Decision Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-xs font-mono text-slate-400">{result.transaction_id}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  {result.model_version}
                </span>
              </div>

              {/* Big Score Card */}
              <div className="text-center py-2">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">
                  Predicted Chargeback Risk Score
                </p>
                <div className="inline-flex items-baseline space-x-1">
                  <span className={`text-5xl font-black font-mono tracking-tight ${
                    result.risk_score >= 65 ? 'text-rose-400' : result.risk_score >= 30 ? 'text-amber-300' : 'text-emerald-400'
                  }`}>
                    {result.risk_score.toFixed(1)}%
                  </span>
                  <span className="text-slate-500 text-lg font-mono">/100</span>
                </div>

                {/* Decision Badge */}
                <div className={`mt-3 inline-flex items-center px-3.5 py-1.5 rounded-full border text-xs font-bold ${badge?.bg}`}>
                  {badge?.icon}
                  {badge?.label}
                </div>

                <p className="text-xs text-slate-300 mt-2 italic max-w-sm mx-auto">
                  "{result.action_recommendation}"
                </p>
              </div>

              {/* Top 3 SHAP Human-Readable Reasons */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white flex items-center">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400 mr-1.5" /> Top 3 SHAP Risk Drivers
                  </span>
                  <span className="text-[10px] text-slate-400">Explainability Audit</span>
                </div>

                <div className="space-y-2 mt-2">
                  {result.top_reasons?.map((reason, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-200 flex items-start space-x-2"
                    >
                      <span className="flex-shrink-0 w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 font-mono text-[10px] flex items-center justify-center font-bold">
                        {idx + 1}
                      </span>
                      <span className="leading-snug">{reason}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Raw SHAP Contribution Bar Chart */}
              {result.raw_shap_breakdown && (
                <div className="pt-3 border-t border-slate-800 space-y-1.5">
                  <span className="text-[11px] font-medium text-slate-400">
                    Feature Attributions (+ pushes towards chargeback)
                  </span>
                  <div className="space-y-1.5 text-[11px]">
                    {result.raw_shap_breakdown.map((item, i) => (
                      <div key={i} className="flex items-center justify-between font-mono">
                        <span className="text-slate-400 truncate max-w-[200px]">{item.feature}</span>
                        <span className={`font-semibold ${item.contribution >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {item.contribution >= 0 ? '+' : ''}{item.contribution.toFixed(4)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
