import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, CheckCircle2, Download, ExternalLink, ShieldCheck, Lock } from 'lucide-react';
import { Card, CardHeader, CardContent, CardFooter } from '../common/Card';
import { Button } from '../common/Button';
import { StatusPill } from '../common/StatusPill';
import { LearningPack } from '../../types';
import { api } from '../../services/api';

interface PublishUnitViewProps {
  pack: LearningPack;
  onPublishSuccess: () => void;
}

export const PublishUnitView: React.FC<PublishUnitViewProps> = ({
  pack,
  onPublishSuccess,
}) => {
  const navigate = useNavigate();
  const [classLabel, setClassLabel] = useState<string>('Class 10-A');
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [publishResult, setPublishResult] = useState<any>(null);

  const allSlots = pack.by_objective?.flatMap((o) => o.slots) || [];
  const approvedSlots = allSlots.filter((s) => s.asset?.status === 'approved');
  const canPublish = approvedSlots.length > 0;

  const handlePublish = async () => {
    if (!canPublish) return;
    try {
      setIsPublishing(true);
      const res = await api.publishUnit(pack.unit.id, classLabel);
      setPublishResult(res);
      onPublishSuccess();
    } catch (err: any) {
      alert(err.message || 'Publishing failed');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await api.exportUnit(pack.unit.id);
      const blob = new Blob([res.html_document], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `unit_${pack.unit.id}_lessonfoundry_pack.html`;
      a.click();
    } catch (err: any) {
      alert(err.message || 'Export failed');
    }
  };

  return (
    <div className="space-y-6 animate-in">
      {publishResult ? (
        <Card className="p-8 text-center bg-emerald-50/50 border-emerald-200">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-emerald-950 mb-1">
            Unit Published Successfully!
          </h2>
          <p className="text-xs text-emerald-800 max-w-md mx-auto mb-6">
            Snapshot #{publishResult.publication_id} containing {publishResult.approved_assets_count} approved items is now active for {publishResult.class_label}.
          </p>

          <div className="flex justify-center gap-3">
            <Button
              onClick={() => navigate(`/student/quiz/${pack.unit.id}`)}
              rightIcon={<ExternalLink className="w-4 h-4" />}
            >
              Test Student Experience
            </Button>
            <Button variant="outline" onClick={handleExport} leftIcon={<Download className="w-4 h-4" />}>
              Download Export HTML
            </Button>
          </div>
        </Card>
      ) : (
        <Card>
          <CardHeader
            title={
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-indigo-600" />
                <span>Publish Learning Pack to Classroom</span>
              </div>
            }
            subtitle="Snapshots only approved current versions into an immutable publication."
          />
          <CardContent className="space-y-5 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Target Class / Cohort:
                </label>
                <select
                  value={classLabel}
                  onChange={(e) => setClassLabel(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
                >
                  <option value="Class 10-A">Class 10-A (Biology)</option>
                  <option value="Class 10-B">Class 10-B (Biology)</option>
                  <option value="AP Biology Cohort">AP Biology Cohort</option>
                  <option value="Remediation Group">Remediation Group</option>
                </select>
              </div>

              <div className="flex items-end">
                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl w-full text-indigo-950">
                  <span className="font-semibold block mb-0.5">Approved Items Ready:</span>
                  <span className="text-base font-bold text-indigo-700">
                    {approvedSlots.length} / {allSlots.length} Slots Approved
                  </span>
                </div>
              </div>
            </div>

            {/* Approved Items Checklist */}
            <div className="space-y-2 pt-2">
              <span className="font-semibold text-slate-700 block">
                Approved Assets Included in Snapshot:
              </span>
              <div className="max-h-60 overflow-y-auto space-y-1.5 border border-slate-200 p-2 rounded-xl bg-slate-50">
                {allSlots.map((item, idx) => {
                  const isApproved = item.asset?.status === 'approved';
                  return (
                    <div
                      key={item.slot.id}
                      className={`p-2.5 rounded-lg border flex items-center justify-between text-xs ${
                        isApproved
                          ? 'bg-white border-emerald-200 text-slate-800'
                          : 'bg-slate-100/70 border-slate-200 text-slate-400 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isApproved ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Lock className="w-4 h-4 text-slate-400" />
                        )}
                        <span className="font-medium capitalize">
                          Slot #{item.slot.position}: {item.slot.type.replace('_', ' ')}
                        </span>
                      </div>

                      <StatusPill status={item.asset?.status || 'draft'} size="sm" />
                    </div>
                  );
                })}
              </div>
            </div>

            {!canPublish && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Cannot publish unit: At least one pedagogical asset must be approved by the teacher before publishing to students.
                </span>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex justify-between items-center">
            <Button variant="outline" onClick={handleExport} leftIcon={<Download className="w-4 h-4" />}>
              Export Offline HTML
            </Button>
            <Button
              onClick={handlePublish}
              disabled={!canPublish}
              isLoading={isPublishing}
              rightIcon={<Send className="w-4 h-4" />}
            >
              Publish to Class
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
};
