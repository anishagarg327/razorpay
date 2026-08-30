import React from 'react';
import { ShieldAlert, TrendingDown, DollarSign, Target, CheckCircle2, AlertTriangle, XCircle, ArrowUpRight } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

export default function MetricsCards({ metricsData, onQuickTest }) {
  if (!metricsData) {
    return (
      <div className="p-8 text-center bg-slate-900/50 rounded-2xl border border-slate-800 animate-pulse">
        <p className="text-slate-400">Loading model evaluation metrics...</p>
      </div>
    );
  }

  const { metrics, confusion_matrix, cost_analysis, dataset } = metricsData;

  const costComparisonData = [
    { name: 'Unmitigated Loss (No Model)', cost: cost_analysis.baseline_unmitigated_loss_inr, color: '#f43f5e' },
    { name: 'Model Loss + Review Cost', cost: cost_analysis.total_model_loss_inr, color: '#0ea5e9' },
    { name: 'Net Profit Protected', cost: cost_analysis.net_financial_savings_inr, color: '#10b981' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner Alert for Judges */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-950/60 via-slate-900/80 to-indigo-950/60 border border-blue-800/40 p-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> STRICTLY DEFENSE-ONLY EVALUATION
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Held-out Test Split: {dataset?.test_samples} transactions ({dataset?.chargeback_rate}% base fraud rate)
              </span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Honest Metric & False-Positive Cost Accounting
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl">
              Trained on {dataset?.total_samples?.toLocaleString()} transactions. Calibrated to penalize both customer friction (₹{cost_analysis?.cost_per_fp_inr} / FP) and direct chargeback losses (₹{cost_analysis?.loss_per_fn_inr} / FN).
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <div className="bg-slate-950/80 px-4 py-2.5 rounded-xl border border-slate-800 text-right">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Net Financial Savings</p>
              <p className="text-2xl font-black text-emerald-400 font-mono">
                +₹{cost_analysis?.net_financial_savings_inr?.toLocaleString('en-IN')}
              </p>
              <p className="text-[11px] text-emerald-500 font-medium">
                {cost_analysis?.loss_reduction_pct}% Risk Cost Reduction
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Precision */}
        <div className="bg-slate-900/60 backdrop-blur-sm rounded-xl p-4 border border-slate-800/80 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Precision</span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-bold text-white font-mono">
              {(metrics.precision * 100).toFixed(1)}%
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              True frauds among flagged txns
            </p>
          </div>
        </div>

        {/* Recall */}
        <div className="bg-slate-900/60 backdrop-blur-sm rounded-xl p-4 border border-slate-800/80 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Recall (Sensitivity)</span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-bold text-white font-mono">
              {(metrics.recall * 100).toFixed(1)}%
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Actual frauds successfully detected
            </p>
          </div>
        </div>

        {/* F1 Score */}
        <div className="bg-slate-900/60 backdrop-blur-sm rounded-xl p-4 border border-slate-800/80 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">F1 Score & ROC-AUC</span>
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-bold text-white font-mono">
              {metrics.f1_score.toFixed(3)}
            </p>
            <p className="text-[11px] text-cyan-400 mt-1">
              ROC-AUC: <span className="font-mono font-semibold">{metrics.roc_auc.toFixed(3)}</span>
            </p>
          </div>
        </div>

        {/* False-Positive Cost */}
        <div className="bg-slate-900/60 backdrop-blur-sm rounded-xl p-4 border border-slate-800/80 hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">False-Positive Friction</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-bold text-amber-300 font-mono">
              ₹{cost_analysis.false_positive_cost_inr.toLocaleString('en-IN')}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              {confusion_matrix.false_positives} FPs × ₹{cost_analysis.cost_per_fp_inr} friction cost
            </p>
          </div>
        </div>
      </div>

      {/* Financial Comparison & Confusion Matrix Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Chart: Financial Impact Comparison */}
        <div className="lg:col-span-7 bg-slate-900/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Financial Impact: Baseline vs. Risk-Guard Model</h3>
              <p className="text-xs text-slate-400">Direct comparison of risk exposure and preserved merchant revenue (INR)</p>
            </div>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costComparisonData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <XAxis type="number" tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} stroke="#64748b" fontSize={11} />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} width={130} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-950 border border-slate-700 p-2.5 rounded-xl shadow-xl text-xs">
                          <p className="font-semibold text-white">{payload[0].payload.name}</p>
                          <p className="text-emerald-400 font-mono mt-1">
                            ₹{Number(payload[0].value).toLocaleString('en-IN')}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="cost" radius={[0, 6, 6, 0]}>
                  {costComparisonData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-center">
            <div>
              <p className="text-[10px] text-slate-400">Without RevShield</p>
              <p className="text-sm font-bold text-rose-400 font-mono">₹{cost_analysis.baseline_unmitigated_loss_inr.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400">With RevShield Incurred</p>
              <p className="text-sm font-bold text-sky-400 font-mono">₹{cost_analysis.total_model_loss_inr.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400">Net Money Saved</p>
              <p className="text-sm font-bold text-emerald-400 font-mono">+₹{cost_analysis.net_financial_savings_inr.toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>

        {/* Right Card: Confusion Matrix */}
        <div className="lg:col-span-5 bg-slate-900/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Held-Out Confusion Matrix</h3>
              <p className="text-xs text-slate-400">Class distribution on 1,000 unseen transactions</p>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
              N = {dataset?.test_samples}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-2">
            {/* True Negative */}
            <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center space-x-1 text-emerald-400 mb-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="text-[10px] uppercase font-bold tracking-wider">True Negative</span>
              </div>
              <p className="text-2xl font-bold text-emerald-300 font-mono">{confusion_matrix.true_negatives}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Legit Allowed (Zero Friction)</p>
            </div>

            {/* False Positive */}
            <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center space-x-1 text-amber-400 mb-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span className="text-[10px] uppercase font-bold tracking-wider">False Positive</span>
              </div>
              <p className="text-2xl font-bold text-amber-300 font-mono">{confusion_matrix.false_positives}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Legit Flagged (₹500 friction)</p>
            </div>

            {/* False Negative */}
            <div className="bg-rose-950/20 border border-rose-500/30 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center space-x-1 text-rose-400 mb-1">
                <XCircle className="w-3.5 h-3.5" />
                <span className="text-[10px] uppercase font-bold tracking-wider">False Negative</span>
              </div>
              <p className="text-2xl font-bold text-rose-300 font-mono">{confusion_matrix.false_negatives}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Missed Fraud (₹5k loss)</p>
            </div>

            {/* True Positive */}
            <div className="bg-blue-950/20 border border-blue-500/30 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center space-x-1 text-cyan-400 mb-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span className="text-[10px] uppercase font-bold tracking-wider">True Positive</span>
              </div>
              <p className="text-2xl font-bold text-cyan-300 font-mono">{confusion_matrix.true_positives}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Fraud Blocked / Prevented</p>
            </div>
          </div>

          <div className="mt-4 p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
            <span>Overall Test Accuracy: <strong className="text-white font-mono">{(metrics.accuracy * 100).toFixed(1)}%</strong></span>
            <button
              onClick={onQuickTest}
              className="inline-flex items-center text-blue-400 hover:text-blue-300 font-semibold"
            >
              Test Live Simulator <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
