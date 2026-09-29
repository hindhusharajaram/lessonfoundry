import React, { useState } from 'react';
import {
  ShieldCheck,
  Cpu,
  Key,
  ShieldAlert,
  Layers,
  Code2,
  Wrench,
  CheckCircle2,
  Activity,
  Server,
  RefreshCw,
  Check,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { api } from '../../services/api';

export const TrustSafetyPage: React.FC = () => {
  const [pingStatus, setPingStatus] = useState<{
    loading: boolean;
    latency: number | null;
    success: boolean | null;
    message: string | null;
  }>({
    loading: false,
    latency: null,
    success: null,
    message: null,
  });

  const handlePingHealth = async () => {
    setPingStatus({ loading: true, latency: null, success: null, message: null });
    const start = performance.now();
    try {
      const res = await api.getHealth();
      const elapsed = Math.round(performance.now() - start);
      setPingStatus({
        loading: false,
        latency: elapsed,
        success: true,
        message: `${res.app} v${res.version} • ${res.status.toUpperCase()} (${elapsed}ms)`,
      });
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - start);
      setPingStatus({
        loading: false,
        latency: elapsed,
        success: false,
        message: `Offline / ${err.message || 'Connection failed'}`,
      });
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans animate-in">
      {/* Top Header Card */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Trust, Safety & AI Governance</h1>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handlePingHealth}
            isLoading={pingStatus.loading}
            leftIcon={pingStatus.loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5 text-indigo-600" />}
            className="shrink-0"
          >
            Ping Engine API
          </Button>
        </div>

        {pingStatus.message && (
          <div
            className={`mt-4 p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${
              pingStatus.success
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                : 'bg-rose-50/80 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {pingStatus.success ? (
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="font-medium">{pingStatus.message}</span>
            </div>
            {pingStatus.latency !== null && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/80 border border-slate-200/60 text-slate-600">
                {pingStatus.latency}ms response
              </span>
            )}
          </div>
        )}
      </Card>

      {/* Compact Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-3.5 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">4 Security Guardrails</div>
            <div className="text-[11px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active & Enforced
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-3.5 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">2 Gemini Models</div>
            <div className="text-[11px] text-slate-500 font-medium mt-0.5">Flash (Primary) • Pro (Fallback)</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-3.5 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">Non-LLM Verifier</div>
            <div className="text-[11px] text-blue-600 font-semibold mt-0.5">Threshold &ge; 0.90 Target</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center gap-3.5 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900">API Isolation</div>
            <div className="text-[11px] text-purple-600 font-semibold mt-0.5">Backend Only (.env)</div>
          </div>
        </div>
      </div>

      {/* Main Detailed Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Model Architecture Card */}
        <Card className="rounded-2xl border-slate-200/80 shadow-sm overflow-hidden">
          <CardHeader
            title="AI Engine & Model Architecture"
          />
          <CardContent className="divide-y divide-slate-100 p-0 text-xs">
            {/* Primary Model */}
            <div className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Primary Model</div>
                  <div className="text-[11px] text-slate-400">Default generation orchestrator</div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200/80">
                gemini-2.5-flash
              </span>
            </div>

            {/* Fallback Model */}
            <div className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Fallback Model</div>
                  <div className="text-[11px] text-slate-400">High-capacity secondary failover</div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200/80">
                gemini-2.5-pro
              </span>
            </div>

            {/* Structured Output */}
            <div className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Code2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Structured Output</div>
                  <div className="text-[11px] text-slate-400">Rigid JSON validation pipeline</div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Pydantic response_schema
              </span>
            </div>

            {/* Local JSON Repair */}
            <div className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Wrench className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Local JSON Repair</div>
                  <div className="text-[11px] text-slate-400">Zero-token syntax recovery</div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Active
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Security & Boundary Isolation Card */}
        <Card className="rounded-2xl border-slate-200/80 shadow-sm overflow-hidden">
          <CardHeader
            title="Security & Boundary Isolation"
          />
          <CardContent className="divide-y divide-slate-100 p-0 text-xs">
            {/* API Key Privacy */}
            <div className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">API Key Privacy</div>
                  <div className="text-[11px] text-slate-400">Never exposed to browser runtime</div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Backend only (.env)
              </span>
            </div>

            {/* Prompt Injection Scanner */}
            <div className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Prompt Injection Scanner</div>
                  <div className="text-[11px] text-slate-400">Pre-flight input safety verification</div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Active (Non-destructive)
              </span>
            </div>

            {/* Dual Independent Solver */}
            <div className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Dual Independent Solver</div>
                  <div className="text-[11px] text-slate-400">Zero-context answer key consensus</div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Enabled
              </span>
            </div>

            {/* Non-LLM Verifier */}
            <div className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Non-LLM Verifier</div>
                  <div className="text-[11px] text-slate-400">Exact source substring grounding gate</div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Threshold &ge; 0.90
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TrustSafetyPage;
