import React, { useState, useEffect, useRef } from 'react';
import { Upload, FileText, CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp, Download, Sparkles, Filter, Play, RefreshCw, Zap, TrendingUp, DollarSign, ShieldAlert } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { API_BASE } from '../config';

export default function CsvBatchScorer({ onBatchComplete }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [batchData, setBatchData] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('ALL');
  const [expandedRow, setExpandedRow] = useState(null);
  const [search, setSearch] = useState('');

  // 1,000 Transactions Simulation States
  const [isSimulating, setIsSimulating] = useState(false);
  const [simProgress, setSimProgress] = useState(0);
  const [chartHistory, setChartHistory] = useState([]);
  const [simStats, setSimStats] = useState(null);
  const simTimerRef = useRef(null);

  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;
    setFile(uploadedFile);
    await processFile(uploadedFile);
  };

  const processFile = async (fileToUpload) => {
    setLoading(true);
    setError(null);
    setSimStats(null);
    try {
      const formData = new FormData();
      formData.append('file', fileToUpload);

      const res = await fetch(`${API_BASE}/api/upload-csv`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.detail || 'CSV upload failed');
      }

      const data = await res.json();
      setBatchData(data);
      if (onBatchComplete) onBatchComplete(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSampleTransactions = async () => {
    setLoading(true);
    setError(null);
    setSimStats(null);
    try {
      const res = await fetch(`${API_BASE}/api/transactions/sample?limit=25`);
      if (!res.ok) throw new Error('Failed to load sample transactions');
      const sampleTxns = await res.json();

      const batchRes = await fetch(`${API_BASE}/api/batch-predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sampleTxns),
      });

      if (!batchRes.ok) throw new Error('Batch scoring failed');
      const data = await batchRes.json();
      setBatchData(data);
      if (onBatchComplete) onBatchComplete(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Run 1,000 Transactions Real-Time Animated Benchmark
  const run1000Simulation = async () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setSimProgress(0);
    setChartHistory([]);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/simulation/test-batch?count=1000`);
      if (!res.ok) throw new Error('Failed to fetch test batch');
      const data = await res.json();
      const allTxns = data.transactions || [];

      let tp = 0;
      let fp = 0;
      let fn = 0;
      let tn = 0;
      let processed = 0;
      let history = [];
      const batchChunkSize = 40;
      const totalChunks = Math.ceil(allTxns.length / batchChunkSize);
      let currentChunk = 0;

      const step = () => {
        if (currentChunk >= totalChunks) {
          setIsSimulating(false);
          setSimProgress(100);
          setBatchData({
            total_processed: allTxns.length,
            summary: {
              approved: tn + fn,
              manual_review: Math.round(fp * 0.4),
              blocked: tp + Math.round(fp * 0.6),
              total_volume_inr: Math.round(allTxns.reduce((acc, t) => acc + t.amount, 0)),
              fraud_blocked_volume_inr: Math.round(allTxns.filter((t) => t.outcome === 'TP').reduce((acc, t) => acc + t.amount, 0)),
              block_rate_pct: Number(((tp + fp) / allTxns.length * 100).toFixed(1)),
            },
            results: allTxns,
          });
          return;
        }

        const start = currentChunk * batchChunkSize;
        const end = Math.min(start + batchChunkSize, allTxns.length);
        const chunk = allTxns.slice(start, end);

        for (const t of chunk) {
          processed += 1;
          if (t.outcome === 'TP') tp += 1;
          else if (t.outcome === 'FP') fp += 1;
          else if (t.outcome === 'FN') fn += 1;
          else tn += 1;
        }

        const precision = tp + fp > 0 ? (tp / (tp + fp)) * 100 : 100;
        const recall = tp + fn > 0 ? (tp / (tp + fn)) * 100 : 100;
        const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

        const moneySaved = tp * 5000;
        const moneyLost = fp * 500 + fn * 5000;
        const netSavings = moneySaved - moneyLost;

        history.push({
          step: processed,
          precision: parseFloat(precision.toFixed(1)),
          recall: parseFloat(recall.toFixed(1)),
          f1: parseFloat(f1.toFixed(1)),
          moneySaved,
          moneyLost,
        });

        setChartHistory([...history]);
        setSimProgress(Math.round((processed / allTxns.length) * 100));
        setSimStats({
          processed,
          total: allTxns.length,
          tp,
          fp,
          fn,
          tn,
          totalFlagged: tp + fp,
          moneySaved,
          moneyLost,
          netSavings,
          currentPrecision: precision.toFixed(1),
          currentRecall: recall.toFixed(1),
          currentF1: (f1 / 100).toFixed(3),
        });

        currentChunk += 1;
        simTimerRef.current = setTimeout(step, 45);
      };

      step();
    } catch (err) {
      setError(err.message);
      setIsSimulating(false);
    }
  };

  useEffect(() => {
    return () => {
      if (simTimerRef.current) clearTimeout(simTimerRef.current);
    };
  }, []);

  // Filtered rows
  const filteredResults = batchData?.results
    ? batchData.results.filter((item) => {
        const matchesFilter =
          filter === 'ALL'
            ? true
            : filter === 'BLOCK'
            ? item.decision === 'BLOCK'
            : filter === 'REVIEW'
            ? item.decision === 'MANUAL_REVIEW'
            : item.decision === 'APPROVE';

        const matchesSearch =
          !search ||
          item.transaction_id.toLowerCase().includes(search.toLowerCase()) ||
          item.payment_method?.toLowerCase().includes(search.toLowerCase());

        return matchesFilter && matchesSearch;
      })
    : [];

  const getDecisionBadge = (decision) => {
    if (decision === 'BLOCK') {
      return (
        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/10 border border-rose-500/30 text-rose-400">
          BLOCK
        </span>
      );
    }
    if (decision === 'MANUAL_REVIEW') {
      return (
        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/10 border border-amber-500/30 text-amber-300">
          REVIEW
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
        APPROVE
      </span>
    );
  };

  const getScoreColor = (score) => {
    if (score >= 65) return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
    if (score >= 30) return 'text-amber-300 bg-amber-500/10 border-amber-500/20';
    return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar & 1,000 Transactions Runner */}
      <div className="bg-slate-900/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-800 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              <h2 className="text-lg font-bold text-white">
                Batch Scoring & 1,000 Held-Out Simulation
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Simulate 1,000 held-out test transactions in real-time to watch live Precision/Recall convergence, false-positive overhead, and financial balance dynamics.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Primary Simulation Button */}
            <button
              onClick={run1000Simulation}
              disabled={isSimulating || loading}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center justify-center transition-all hover:scale-[1.02] disabled:opacity-50"
            >
              <Play className="w-4 h-4 mr-1.5 fill-current" />
              {isSimulating ? `Simulating (${simProgress}%)` : 'Simulate 1,000 Transactions'}
            </button>

            {/* Quick 25 Sample */}
            <button
              onClick={loadSampleTransactions}
              disabled={isSimulating || loading}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all flex items-center justify-center disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5 text-cyan-400" />
              Sample 25 Txns
            </button>

            {/* Upload Custom CSV */}
            <label className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer transition-all flex items-center justify-center disabled:opacity-50">
              <Upload className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
              Upload CSV
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isSimulating || loading}
              />
            </label>
          </div>
        </div>

        {/* Progress Bar during simulation */}
        {isSimulating && (
          <div className="space-y-1.5 pt-2">
            <div className="flex justify-between text-xs font-mono text-cyan-300">
              <span>Streaming batch scoring: {simStats?.processed || 0} / {simStats?.total || 1000}</span>
              <span>{simProgress}%</span>
            </div>
            <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
              <div
                className="bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 h-full rounded-full transition-all duration-75"
                style={{ width: `${simProgress}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300">
            {error}
          </div>
        )}
      </div>

      {/* Live 1,000 Transactions Chart & Financial Balance Summary */}
      {simStats && (
        <div className="space-y-6">
          {/* 4 Live KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Flagged */}
            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Total Flagged / Blocked</span>
                <ShieldAlert className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-2xl font-bold text-white font-mono mt-1">
                {simStats.totalFlagged} <span className="text-xs text-slate-500">({((simStats.totalFlagged / simStats.processed) * 100).toFixed(1)}%)</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-1 font-mono">
                {simStats.tp} True Frauds Caught
              </p>
            </div>

            {/* Total False Positives */}
            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Total False Positives</span>
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-2xl font-bold text-amber-300 font-mono mt-1">
                {simStats.fp}
              </p>
              <p className="text-[11px] text-amber-400 mt-1 font-mono">
                ₹{(simStats.fp * 500).toLocaleString('en-IN')} friction overhead
              </p>
            </div>

            {/* Estimated Money Saved */}
            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between text-xs text-emerald-400 font-medium">
                <span>Estimated ₹ Saved</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-bold text-emerald-400 font-mono mt-1">
                +₹{simStats.moneySaved.toLocaleString('en-IN')}
              </p>
              <p className="text-[11px] text-emerald-500 mt-1">
                Direct chargeback loss prevented
              </p>
            </div>

            {/* Estimated Money Lost */}
            <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between text-xs text-rose-400 font-medium">
                <span>Estimated ₹ Lost</span>
                <TrendingUp className="w-4 h-4 text-rose-400" />
              </div>
              <p className="text-2xl font-bold text-rose-400 font-mono mt-1">
                ₹{simStats.moneyLost.toLocaleString('en-IN')}
              </p>
              <p className="text-[11px] text-slate-400 mt-1 font-mono">
                ₹{(simStats.fn * 5000).toLocaleString('en-IN')} FN + ₹{(simStats.fp * 500).toLocaleString('en-IN')} FP
              </p>
            </div>
          </div>

          {/* Real-Time Convergence Chart: Precision & Recall vs. Transactions */}
          <div className="bg-slate-900/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center">
                  <TrendingUp className="w-4 h-4 text-cyan-400 mr-2" /> Live Precision & Recall Convergence (Over 1,000 Transactions)
                </h3>
                <p className="text-xs text-slate-400">
                  Real-time trajectory tracking as transactions are evaluated sequentially against ground truth
                </p>
              </div>

              <div className="flex items-center space-x-3 text-xs font-mono">
                <span className="text-blue-400 font-bold">Prec: {simStats.currentPrecision}%</span>
                <span className="text-cyan-300 font-bold">Recall: {simStats.currentRecall}%</span>
                <span className="text-amber-400 font-bold">F1: {simStats.currentF1}</span>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartHistory} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="step" stroke="#64748b" fontSize={11} tickFormatter={(v) => `${v}`} />
                  <YAxis domain={[0, 100]} stroke="#64748b" fontSize={11} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl shadow-xl text-xs space-y-1 font-mono">
                            <p className="text-slate-400 font-semibold mb-1">Txn Count: {label}</p>
                            <p className="text-blue-400">Precision: {payload[0]?.value}%</p>
                            <p className="text-cyan-300">Recall: {payload[1]?.value}%</p>
                            <p className="text-amber-400">F1 Score: {payload[2]?.value}%</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="precision"
                    name="Precision (%)"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="recall"
                    name="Recall (%)"
                    stroke="#06b6d4"
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="f1"
                    name="F1 Score (%)"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Results Table & Filter Controls */}
      {batchData && (
        <div className="bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-1">
              {[
                { id: 'ALL', label: `All (${batchData.results.length})` },
                { id: 'BLOCK', label: 'Blocked' },
                { id: 'REVIEW', label: 'Review' },
                { id: 'APPROVE', label: 'Approved' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    filter === tab.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Search transaction ID or payment..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-full sm:w-64"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Transaction ID</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Risk Score</th>
                  <th className="px-4 py-3">Decision</th>
                  <th className="px-4 py-3">Primary SHAP Driver</th>
                  <th className="px-4 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredResults.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-slate-500">
                      No transactions match the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredResults.slice(0, 100).map((row, idx) => {
                    const isExpanded = expandedRow === idx;
                    return (
                      <React.Fragment key={idx}>
                        <tr className="hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3 font-mono font-medium text-slate-200">
                            {row.transaction_id}
                          </td>
                          <td className="px-4 py-3 font-mono font-semibold text-slate-200">
                            ₹{row.amount?.toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-3 capitalize text-slate-300">
                            {row.payment_method?.replace('_', ' ')}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full font-mono font-bold text-[11px] border ${getScoreColor(row.risk_score)}`}>
                              {row.risk_score.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {getDecisionBadge(row.decision)}
                          </td>
                          <td className="px-4 py-3 text-slate-300 max-w-xs truncate">
                            {row.top_reasons?.[0] || 'Standard Profile'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => setExpandedRow(isExpanded ? null : idx)}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-slate-950/90 border-b border-slate-800">
                            <td colSpan="7" className="p-4 space-y-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                    All Top SHAP Risk Drivers:
                                  </p>
                                  <div className="space-y-1">
                                    {row.top_reasons?.map((reason, rIdx) => (
                                      <div key={rIdx} className="text-xs text-slate-200 flex items-center space-x-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                        <span>{reason}</span>
                                      </div>
                                    ))}
                                  </div>
                                  <p className="text-xs text-slate-400 italic mt-2">
                                    Recommendation: {row.action_recommendation}
                                  </p>
                                </div>

                                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-[11px] font-mono grid grid-cols-2 gap-2 text-slate-300">
                                  <div>Account Age: <span className="text-white">{row.customer_age_days} days</span></div>
                                  <div>Time: <span className="text-white">{row.hour_of_day}:00 hrs</span></div>
                                  <div>30d Orders: <span className="text-white">{row.order_count_past_30d}</span></div>
                                  <div>90d Refunds: <span className="text-white">{row.refund_count_past_90d}</span></div>
                                  <div>New Device: <span className="text-white">{row.device_change_flag ? 'YES' : 'NO'}</span></div>
                                  <div>Address Mismatch: <span className="text-white">{row.shipping_billing_mismatch ? 'YES' : 'NO'}</span></div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
