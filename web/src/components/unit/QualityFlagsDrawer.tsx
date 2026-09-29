import React, { useState } from 'react';
import { AlertCircle, AlertTriangle, Info, Check, ShieldCheck, X } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { QualityFlag } from '../../types';
import { api } from '../../services/api';

interface QualityFlagsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  flags: QualityFlag[];
  onFlagsUpdated: () => void;
}

export const QualityFlagsDrawer: React.FC<QualityFlagsDrawerProps> = ({
  isOpen,
  onClose,
  flags,
  onFlagsUpdated,
}) => {
  const [selectedFlag, setSelectedFlag] = useState<QualityFlag | null>(null);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [isResolving, setIsResolving] = useState<boolean>(false);

  const handleResolveFlag = async (flagId: number, action: 'resolve' | 'override') => {
    if (action === 'override' && !overrideReason.trim()) {
      alert('Please provide a reason for overriding this quality flag.');
      return;
    }

    try {
      setIsResolving(true);
      await api.resolveFlag(flagId, {
        action,
        reason: action === 'override' ? overrideReason : undefined,
        actor: 'Teacher Admin',
      });
      setSelectedFlag(null);
      setOverrideReason('');
      onFlagsUpdated();
    } catch (err: any) {
      alert(err.message || 'Failed to update flag');
    } finally {
      setIsResolving(false);
    }
  };

  const unresolvedFlags = flags.filter((f) => !f.resolved);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-indigo-600" />
          <span>Quality Guardrail Flags Report</span>
        </div>
      }
      subtitle={`Total Flags: ${flags.length} • Open: ${unresolvedFlags.length} • Resolved: ${flags.length - unresolvedFlags.length}`}
      maxWidth="xl"
    >
      <div className="space-y-4 text-xs">
        {flags.length === 0 ? (
          <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl">
            <Check className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
            <p className="font-semibold text-slate-800">Clean Guardrails Report</p>
            <p className="text-[11px] text-slate-400">No quality flags or anomalies detected across this learning pack.</p>
          </div>
        ) : (
          flags.map((flag) => {
            const isError = flag.severity === 'error';
            const isWarning = flag.severity === 'warning';

            return (
              <div
                key={flag.id}
                className={`p-4 rounded-xl border space-y-2 transition-all ${
                  flag.resolved
                    ? 'bg-slate-50 border-slate-200 opacity-60'
                    : isError
                    ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                    : isWarning
                    ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                    : 'bg-indigo-50/70 border-indigo-200 text-indigo-950'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isError ? (
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                    ) : isWarning ? (
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    ) : (
                      <Info className="w-4 h-4 text-indigo-600" />
                    )}
                    <span className="font-bold text-slate-900 font-mono text-[11px] uppercase">
                      {flag.code.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        isError
                          ? 'bg-rose-100 text-rose-800'
                          : isWarning
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-indigo-100 text-indigo-800'
                      }`}
                    >
                      {flag.severity}
                    </span>
                    {flag.resolved && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                        Resolved by {flag.resolved_by || 'Teacher'}
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-slate-800 font-medium">{flag.message}</p>

                {flag.asset_version_id && (
                  <div className="text-[11px] text-slate-500 font-mono">
                    Target Asset Version: #{flag.asset_version_id}
                  </div>
                )}

                {/* Suggested Fix and Actions */}
                {!flag.resolved && (
                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-3">
                    <div className="text-[11px] text-slate-600 italic">
                      Suggested Fix: Review question stem or regenerate asset with specific instructions.
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedFlag(flag)}
                      >
                        Override with Reason
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleResolveFlag(flag.id, 'resolve')}
                      >
                        Mark Resolved
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Override Modal */}
        {selectedFlag && (
          <div className="p-4 bg-white border border-slate-300 rounded-xl shadow-lg space-y-3 mt-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900">
                Override Flag: {selectedFlag.code}
              </span>
              <button
                onClick={() => setSelectedFlag(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-slate-600">
              Teacher overrides are logged in the immutable DecisionLog audit trail.
            </p>
            <textarea
              rows={3}
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="State reason for overriding this quality guardrail..."
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setSelectedFlag(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="danger"
                isLoading={isResolving}
                onClick={() => handleResolveFlag(selectedFlag.id, 'override')}
              >
                Confirm Override
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
