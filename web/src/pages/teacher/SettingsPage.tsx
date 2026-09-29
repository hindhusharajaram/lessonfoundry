import React from 'react';
import { ShieldCheck, Cpu, Database, Key } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';

export const SettingsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h1 className="text-xl font-bold text-slate-900">Studio Settings & AI Provenance</h1>
        <p className="text-xs text-slate-500 mt-1">
          Configure backend models, security policies, and student access settings.
        </p>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="AI Engine & Model Architecture" />
          <CardContent className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Primary Model:</span>
              <span className="font-mono font-semibold text-slate-800">gemini-2.5-flash</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Fallback Model:</span>
              <span className="font-mono font-semibold text-slate-800">gemini-2.5-pro</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Structured Output:</span>
              <span className="text-emerald-700 font-semibold">Pydantic response_schema</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500">Local JSON Repair:</span>
              <span className="text-emerald-700 font-semibold">Active</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Security & Boundary Isolation" />
          <CardContent className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">API Key Privacy:</span>
              <span className="text-emerald-700 font-semibold">Backend only (.env)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Prompt Injection Scanner:</span>
              <span className="text-emerald-700 font-semibold">Active (Non-destructive)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Dual Independent Solver:</span>
              <span className="text-emerald-700 font-semibold">Enabled</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500">Non-LLM Verifier:</span>
              <span className="text-emerald-700 font-semibold">Threshold &ge; 0.90</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
