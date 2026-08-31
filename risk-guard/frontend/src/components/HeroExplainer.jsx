import React from 'react';
import { ShieldCheck, Cpu, Search, Database, ArrowRight, Zap, CheckCircle2, Lock, FileText, Sparkles } from 'lucide-react';

export default function HeroExplainer({ onExploreSimulator }) {
  const steps = [
    {
      number: '01',
      title: 'Score',
      subtitle: 'Real-Time ML Defense',
      description: 'Evaluates behavioral velocity, device fingerprinting, address mismatches, and return histories in <15ms.',
      icon: Cpu,
      accent: 'from-blue-500 to-indigo-600',
      badge: '<15ms Latency',
      tagColor: 'text-blue-400 border-blue-500/20 bg-blue-500/10'
    },
    {
      number: '02',
      title: 'Explain',
      subtitle: 'SHAP Feature Attribution',
      description: 'Converts complex tree attributions into human-readable merchant audit rationale with top 3 driver signals.',
      icon: Search,
      accent: 'from-indigo-500 to-cyan-500',
      badge: 'Zero Black-Box',
      tagColor: 'text-cyan-400 border-cyan-500/20 bg-cyan-500/10'
    },
    {
      number: '03',
      title: 'Audit',
      subtitle: 'Immutable SQLite Trail',
      description: 'Persists timestamped decisions, model versions, and reasoning payload for dispute resolution and compliance.',
      icon: Database,
      accent: 'from-cyan-500 to-emerald-500',
      badge: 'Regulatory Ready',
      tagColor: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10'
    },
  ];

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900/90 via-slate-900/60 to-slate-950 border border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6 transition-all duration-300">
      {/* Subtle Background Glow Accent */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Title & Value Prop */}
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30 font-mono tracking-wide">
              <Sparkles className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
              RAZORPAY REVSHIELD AI
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-3 h-3 mr-1" /> DEFENSE-ONLY FRAUD ENGINE
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-snug">
            RevShield AI: Defense-Only Fraud & Chargeback Risk Detector
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
            Autonomous payment risk intelligence engineered to prevent friendly fraud, chargeback losses, and account takeovers before settlement - without adding friction for verified legitimate shoppers.
          </p>
        </div>

        {/* Quick Launch CTA */}
        <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-2 shrink-0">
          <button
            onClick={onExploreSimulator}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2 transition-all hover:scale-[1.02] active:scale-95"
          >
            <span>Launch Live Risk Simulator</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <p className="text-[11px] text-slate-400 font-mono text-left lg:text-right">
            Balanced Random Forest • SHAP Explainability
          </p>
        </div>
      </div>

      {/* 3-Step "How It Works" Visual Architecture */}
      <div className="relative z-10 pt-4 border-t border-slate-800/80">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs uppercase font-bold tracking-widest text-slate-400 font-mono">
            How It Works: 3-Step Defensive Pipeline
          </h3>
          <span className="text-[11px] text-cyan-400 font-mono hidden sm:inline-block">
            End-to-End Latency: &lt;15ms
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className="relative bg-slate-950/70 backdrop-blur-md rounded-2xl p-5 border border-slate-800 hover:border-slate-700/80 transition-all duration-200 group flex flex-col justify-between"
              >
                {/* Header of Step Card */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${step.accent} p-0.5 shadow-md`}>
                        <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                      </div>
                      <div>
                        <span className="text-xs font-mono font-bold text-slate-400">{step.number}.</span>
                        <h4 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                          {step.title}
                        </h4>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${step.tagColor}`}>
                      {step.badge}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-slate-300">
                    {step.subtitle}
                  </p>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Step Connector Arrow on Desktop */}
                {idx < 2 && (
                  <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-20 w-6 h-6 rounded-full bg-slate-900 border border-slate-700 items-center justify-center text-slate-400">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
