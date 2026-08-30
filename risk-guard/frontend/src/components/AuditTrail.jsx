import React, { useState, useEffect } from 'react';
import { Database, RefreshCw, Clock, Search, Filter, ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';
import { API_BASE } from '../config';

export default function AuditTrail({ refreshTrigger }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [decisionFilter, setDecisionFilter] = useState('ALL');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/audit?limit=50`);
      if (!res.ok) throw new Error('Failed to fetch audit records');
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error('Audit fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [refreshTrigger]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const filteredLogs = logs.filter((log) => {
    const matchesDecision = decisionFilter === 'ALL' || log.decision === decisionFilter;
    const matchesSearch =
      !search ||
      log.transaction_id.toLowerCase().includes(search.toLowerCase()) ||
      log.payment_method?.toLowerCase().includes(search.toLowerCase());
    return matchesDecision && matchesSearch;
  });

  const getDecisionBadge = (decision) => {
    if (decision === 'BLOCK') {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/10 border border-rose-500/30 text-rose-400 inline-flex items-center">
          <ShieldAlert className="w-3 h-3 mr-1" /> BLOCK
        </span>
      );
    }
    if (decision === 'MANUAL_REVIEW') {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/10 border border-amber-500/30 text-amber-300 inline-flex items-center">
          <AlertTriangle className="w-3 h-3 mr-1" /> REVIEW
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 inline-flex items-center">
        <ShieldCheck className="w-3 h-3 mr-1" /> APPROVE
      </span>
    );
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-800 overflow-hidden space-y-4">
      {/* Header & Actions */}
      <div className="p-5 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Database className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white">Immutable SQLite Audit Trail</h2>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
              Table: audit_log
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Every scoring decision is permanently recorded with timestamp, model version, and SHAP defense rationale
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Auto Refresh Toggle */}
          <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded bg-slate-950 border-slate-800 text-blue-600 focus:ring-0 w-3.5 h-3.5"
            />
            <span>Auto-refresh (5s)</span>
          </label>

          {/* Seed Sample History Button */}
          <button
            onClick={async () => {
              try {
                await fetch(`${API_BASE}/api/audit/seed`, { method: 'POST' });
                fetchLogs();
              } catch (err) {
                console.error('Failed to seed logs:', err);
              }
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold border border-slate-700 hover:border-cyan-500/40 transition-all flex items-center space-x-1.5"
            title="Populate realistic historical audit trail for demo"
          >
            <span>+ Seed History (36 Txns)</span>
          </button>

          {/* Clear Logs Button */}
          <button
            onClick={async () => {
              if (window.confirm('Are you sure you want to clear all audit log entries?')) {
                try {
                  await fetch(`${API_BASE}/api/audit/clear`, { method: 'POST' });
                  fetchLogs();
                } catch (err) {
                  console.error('Failed to clear logs:', err);
                }
              }
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-300 text-xs font-semibold border border-slate-700 hover:border-rose-700/60 transition-all flex items-center space-x-1.5"
            title="Reset audit trail"
          >
            <span>Reset Trail</span>
          </button>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            title="Refresh logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-1">
          {[
            { id: 'ALL', label: 'All Decisions' },
            { id: 'BLOCK', label: 'Blocked' },
            { id: 'MANUAL_REVIEW', label: 'Review' },
            { id: 'APPROVE', label: 'Approved' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setDecisionFilter(f.id)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                decisionFilter === f.id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search by Txn ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/80 text-slate-400 font-mono uppercase text-[10px] border-y border-slate-800">
            <tr>
              <th className="px-5 py-3">Timestamp (UTC)</th>
              <th className="px-4 py-3">Transaction ID</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Decision</th>
              <th className="px-4 py-3">Audit Reasons (SHAP Attribution)</th>
              <th className="px-4 py-3 text-right">Model</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-5 py-8 text-center text-slate-500">
                  No audit log entries recorded yet. Test a transaction or upload a batch to generate audit records.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-5 py-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString()} ({new Date(log.timestamp).toLocaleDateString()})
                  </td>
                  <td className="px-4 py-3 font-mono font-medium text-slate-200">
                    {log.transaction_id}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-300">
                    {log.amount > 0 ? `₹${log.amount.toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td className="px-4 py-3 font-mono font-bold">
                    <span className={log.risk_score >= 65 ? 'text-rose-400' : log.risk_score >= 30 ? 'text-amber-300' : 'text-emerald-400'}>
                      {log.risk_score.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {getDecisionBadge(log.decision)}
                  </td>
                  <td className="px-4 py-3 text-slate-300 max-w-md">
                    <div className="space-y-1">
                      {Array.isArray(log.reasons) ? (
                        log.reasons.map((r, i) => (
                          <div key={i} className="text-[11px] text-slate-300 flex items-center space-x-1.5">
                            <span className="w-1 h-1 rounded-full bg-blue-400 flex-shrink-0" />
                            <span className="truncate">{r}</span>
                          </div>
                        ))
                      ) : (
                        <span className="text-[11px] text-slate-400">{log.reasons}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400">
                      {log.model_version}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
