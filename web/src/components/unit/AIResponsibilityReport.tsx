import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  Eye,
  AlertTriangle,
  UserCheck,
  Database,
  Cpu,
  History,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../common/Card';
import { LoadingState } from '../common/LoadingState';
import { api } from '../../services/api';

interface AIResponsibilityReportProps {
  unitId: number;
}

export const AIResponsibilityReport: React.FC<AIResponsibilityReportProps> = ({ unitId }) => {
  const [auditData, setAuditData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadAudit();
  }, [unitId]);

  const loadAudit = async () => {
    try {
      setLoading(true);
      const res = await api.getUnitAudit(unitId);
      setAuditData(res);
    } catch (err) {
      console.error('Failed to load audit report', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingState message="Compiling AI Responsibility & Audit metrics..." />;
  if (!auditData) return null;

  return (
    <div className="space-y-6 animate-in">
      <Card className="p-6 bg-gradient-to-r from-[#0B1437] to-[#1A234A] text-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold">AI Responsibility & Governance Report</h2>
            <p className="text-xs text-slate-300">
              Complete provenance, deterministic safety boundaries, and human teacher authority audit.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 1. Grounding Card */}
        <Card className="flex flex-col justify-between">
          <CardHeader
            title={
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>1. Evidence Grounding</span>
              </div>
            }
          />
          <CardContent className="space-y-3 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Verified Claims:</span>
              <span className="font-bold text-slate-800">
                {auditData.grounding?.verified_claims} / {auditData.grounding?.total_claims}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Grounding Ratio:</span>
              <span className="font-bold text-emerald-700">
                {(auditData.grounding?.ratio * 100).toFixed(1)}%
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Every sentence is paired with a verbatim source quote checked by a non-LLM verifier.
            </p>
          </CardContent>
        </Card>

        {/* 2. Transparency Card */}
        <Card className="flex flex-col justify-between">
          <CardHeader
            title={
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-indigo-600" />
                <span>2. Transparency</span>
              </div>
            }
          />
          <CardContent className="space-y-3 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Model Family:</span>
              <span className="font-mono font-semibold text-slate-800">{auditData.transparency?.model_family}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Prompt Version:</span>
              <span className="font-mono font-semibold text-slate-800">{auditData.transparency?.prompt_version}</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Model inputs, prompts, and provenance parameters are recorded on every AssetVersion.
            </p>
          </CardContent>
        </Card>

        {/* 3. Safety Card */}
        <Card className="flex flex-col justify-between">
          <CardHeader
            title={
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-600" />
                <span>3. Safety & Injection</span>
              </div>
            }
          />
          <CardContent className="space-y-3 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Injection Status:</span>
              <span className="font-semibold text-emerald-700">
                {auditData.safety?.injection_flagged ? 'Flagged & Contained' : 'Clean Source'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Data Boundary:</span>
              <span className="font-semibold text-slate-800">Strict Delimiters</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Source text is treated strictly as data, neutralizing instruction injection exploits.
            </p>
          </CardContent>
        </Card>

        {/* 4. Limitations Card */}
        <Card className="flex flex-col justify-between">
          <CardHeader
            title={
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>4. Limitations</span>
              </div>
            }
          />
          <CardContent className="space-y-3 text-xs">
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-950 text-[11px]">
              {auditData.transparency?.solver_limitation}
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Unsupported curriculum objectives are refused by the AI planner.
            </p>
          </CardContent>
        </Card>

        {/* 5. Human Control Card */}
        <Card className="flex flex-col justify-between">
          <CardHeader
            title={
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-purple-600" />
                <span>5. Human Authority</span>
              </div>
            }
          />
          <CardContent className="space-y-3 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Approved Assets:</span>
              <span className="font-bold text-slate-800">
                {auditData.human_control?.approved_assets} / {auditData.human_control?.total_assets}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Teacher Overrides Logged:</span>
              <span className="font-bold text-purple-700">
                {auditData.human_control?.total_overrides_logged}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              No asset is student-visible without explicit teacher approval or logged override.
            </p>
          </CardContent>
        </Card>

        {/* 6. Data Isolation Card */}
        <Card className="flex flex-col justify-between">
          <CardHeader
            title={
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-600" />
                <span>6. Data Integrity</span>
              </div>
            }
          />
          <CardContent className="space-y-3 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Source Version ID:</span>
              <span className="font-mono text-slate-800">#{auditData.pinned_source_version_id}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Source SHA-256:</span>
              <span className="font-mono text-[10px] text-slate-600 truncate max-w-[130px]">
                {auditData.source_sha256}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Immutable source versions. Assets remain permanently pinned to their source snapshot.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Decision Log Table */}
      <Card>
        <CardHeader
          title={
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-600" />
              <span>Immutable Teacher Decision & Override Audit Log</span>
            </div>
          }
          subtitle="Audit trail of status changes, regenerations, and quality overrides."
        />
        <CardContent className="space-y-2 text-xs max-h-72 overflow-y-auto">
          {auditData.decision_logs?.length === 0 ? (
            <p className="text-slate-400 p-4 text-center">No teacher decision actions logged yet.</p>
          ) : (
            auditData.decision_logs.map((log: any) => (
              <div
                key={log.id}
                className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-slate-800 capitalize">
                    {log.action.replace(/_/g, ' ')}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    By {log.actor} • {log.created_at ? new Date(log.created_at).toLocaleString() : ''}
                  </div>
                  {log.detail?.reason && (
                    <div className="mt-1 text-[11px] text-purple-900 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                      Reason: {log.detail.reason}
                    </div>
                  )}
                </div>

                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white border border-slate-200 text-slate-700">
                  Log #{log.id}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};
