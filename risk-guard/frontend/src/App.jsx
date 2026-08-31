import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import HeroExplainer from './components/HeroExplainer';
import MetricsCards from './components/MetricsCards';
import SingleTxnTester from './components/SingleTxnTester';
import CsvBatchScorer from './components/CsvBatchScorer';
import AuditTrail from './components/AuditTrail';
import { ShieldCheck, Database, Zap, Upload, Activity, ShieldAlert, Award, FileCode } from 'lucide-react';

import { API_BASE } from './config';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [metrics, setMetrics] = useState(null);
  const [apiOnline, setApiOnline] = useState(false);
  const [auditTrigger, setAuditTrigger] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchMetrics = async () => {
    try {
      setIsRefreshing(true);
      const res = await fetch(`${API_BASE}/api/metrics`);
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
        setApiOnline(true);
      } else {
        setApiOnline(false);
      }
    } catch (err) {
      console.error('Failed to load metrics:', err);
      setApiOnline(false);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 12000);
    return () => clearInterval(interval);
  }, []);

  const triggerAuditRefresh = () => {
    setAuditTrigger((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-500 selection:text-white flex flex-col overflow-x-hidden">
      {/* Top Navbar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        apiOnline={apiOnline}
        onRefresh={fetchMetrics}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8 transition-opacity duration-300">
        {/* Navigation Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Landing Hero & 3-Step Visual Guide */}
            <HeroExplainer onExploreSimulator={() => setActiveTab('simulator')} />

            {/* Model Evaluation Metrics & Financial Cost Breakdown */}
            <MetricsCards
              metricsData={metrics}
              onQuickTest={() => setActiveTab('simulator')}
            />

            {/* Sub-section: Live simulator snapshot on overview */}
            <div className="pt-6 border-t border-slate-800/80">
              <SingleTxnTester onPredictionComplete={triggerAuditRefresh} />
            </div>

            {/* Sub-section: Recent Audit Trail */}
            <div className="pt-6 border-t border-slate-800/80">
              <AuditTrail refreshTrigger={auditTrigger} />
            </div>
          </div>
        )}

        {activeTab === 'simulator' && (
          <div className="space-y-6 animate-fadeIn">
            <SingleTxnTester onPredictionComplete={triggerAuditRefresh} />
          </div>
        )}

        {activeTab === 'batch' && (
          <div className="space-y-6 animate-fadeIn">
            <CsvBatchScorer onBatchComplete={triggerAuditRefresh} />
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="space-y-6 animate-fadeIn">
            <AuditTrail refreshTrigger={auditTrigger} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/80 py-6 text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-400 font-medium">Razorpay AI Buildathon - Track 2: AI Risk Manager</span>
          </div>
          <div className="flex items-center space-x-4 font-mono text-[11px]">
            <span>Model: Balanced Random Forest + SHAP TreeExplainer</span>
            <span>SQLite Audit: Enabled</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
