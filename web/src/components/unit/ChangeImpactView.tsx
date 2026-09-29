import React, { useState } from 'react';
import { Zap, RotateCcw, AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Card, CardHeader, CardContent, CardFooter } from '../common/Card';
import { Button } from '../common/Button';
import { api } from '../../services/api';

interface ChangeImpactViewProps {
  unitId: number;
  onRegenerateComplete: () => void;
}

export const ChangeImpactView: React.FC<ChangeImpactViewProps> = ({
  unitId,
  onRegenerateComplete,
}) => {
  const [selectedChange, setSelectedChange] = useState<string>('difficulty:medium->advanced');
  const [impactData, setImpactData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [regenResult, setRegenResult] = useState<any>(null);

  const handleAnalyzeImpact = async () => {
    try {
      setLoading(true);
      setRegenResult(null);
      const data = await api.getChangeImpact(unitId, selectedChange);
      setImpactData(data);
    } catch (err: any) {
      alert(err.message || 'Impact analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateAffected = async () => {
    try {
      setIsRegenerating(true);
      const res = await api.regenerateAffected(unitId, selectedChange);
      setRegenResult(res);
      onRegenerateComplete();
    } catch (err: any) {
      alert(err.message || 'Regeneration of affected assets failed');
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="space-y-6 animate-in">
      <Card>
        <CardHeader
          title={
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              <span>Change Impact Engine</span>
            </div>
          }
          subtitle="Calculate exact downstream pedagogical slots affected by difficulty, language, objective, or source updates."
        />
        <CardContent className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Select Proposed Parameter Change:
              </label>
              <select
                value={selectedChange}
                onChange={(e) => setSelectedChange(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
              >
                <option value="difficulty:medium->advanced">
                  Difficulty Change: Medium &rarr; Advanced
                </option>
                <option value="difficulty:advanced->easy">
                  Difficulty Change: Advanced &rarr; Easy
                </option>
                <option value="language:English->Spanish">
                  Language Translation: English &rarr; Spanish
                </option>
                <option value="source_version:1->2">
                  Source Document Update: Version 1 &rarr; Version 2
                </option>
                <option value="objective:1:edit">
                  Objective #1 Text Refinement
                </option>
              </select>
            </div>

            <div className="flex items-end">
              <Button
                className="w-full"
                onClick={handleAnalyzeImpact}
                isLoading={loading}
                leftIcon={<Zap className="w-4 h-4" />}
              >
                Analyze Change Impact
              </Button>
            </div>
          </div>

          {impactData && (
            <div className="mt-6 space-y-4 pt-4 border-t border-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Affected Items */}
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between font-bold text-rose-950">
                    <span>Affected Slots: {impactData.affected_slots?.length || 0}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-rose-100 text-rose-800">
                      Requires Regeneration
                    </span>
                  </div>
                  <p className="text-[11px] text-rose-800">
                    These items directly depend on the modified parameters.
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {impactData.affected_slots?.map((slotId: number) => (
                      <span
                        key={slotId}
                        className="px-2 py-0.5 rounded bg-white border border-rose-200 text-rose-900 text-[10px] font-mono"
                      >
                        Slot #{slotId}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Unaffected Items */}
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between font-bold text-emerald-950">
                    <span>Unaffected Slots: {impactData.unaffected_slots?.length || 0}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800">
                      Preserved As-Is
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800">
                    Independent of the change; untouched and verified.
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {impactData.unaffected_slots?.map((slotId: number) => (
                      <span
                        key={slotId}
                        className="px-2 py-0.5 rounded bg-white border border-emerald-200 text-emerald-900 text-[10px] font-mono"
                      >
                        Slot #{slotId}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Safety Rule Note */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-amber-950 text-[11px]">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">Non-Destructive Teacher Safety Rule:</span>
                  Regenerating affected items will NEVER overwrite approved or locked assets. Approved items will be marked stale for teacher decision.
                </div>
              </div>

              {/* Action Button */}
              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleRegenerateAffected}
                  isLoading={isRegenerating}
                  leftIcon={<RotateCcw className="w-4 h-4" />}
                >
                  Regenerate Affected Items (Safe Mode)
                </Button>
              </div>

              {regenResult && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Safe Regeneration Completed</span>
                  </div>
                  <p className="text-[11px]">
                    Regenerated {regenResult.regenerated_count} affected draft items. Preserved {regenResult.approved_stale_preserved} approved items as stale for review.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
