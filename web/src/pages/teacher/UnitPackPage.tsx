import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  FileText,
  HelpCircle,
  BookOpen,
  Send,
  Download,
  Share2,
  Layers,
  History,
  Check,
  Lock,
  Zap,
  Info,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { Card, CardHeader, CardContent, CardFooter } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusPill } from '../../components/common/StatusPill';
import { Badge } from '../../components/common/Badge';
import { ProgressRing, ProgressBar } from '../../components/common/ProgressBar';
import { Modal } from '../../components/common/Modal';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { api, ApiError } from '../../services/api';
import {
  LearningPack,
  PackHealth,
  Slot,
  Asset,
  AssetVersion,
  Claim,
  QualityFlag,
} from '../../types';

export const UnitPackPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const unitId = parseInt(id || '1');

  const [pack, setPack] = useState<LearningPack | null>(null);
  const [health, setHealth] = useState<PackHealth | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Selected item inspection
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  // Approval & Override Modal
  const [approvalModalOpen, setApprovalModalOpen] = useState<boolean>(false);
  const [overrideModalOpen, setOverrideModalOpen] = useState<boolean>(false);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [activeAssetId, setActiveAssetId] = useState<number | null>(null);

  // Regeneration Modal
  const [regenerateModalOpen, setRegenerateModalOpen] = useState<boolean>(false);
  const [regenFeedback, setRegenFeedback] = useState<string>('');
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);

  // Version History Modal
  const [versionsModalOpen, setVersionsModalOpen] = useState<boolean>(false);
  const [assetVersions, setAssetVersions] = useState<AssetVersion[]>([]);
  const [versionDiffs, setVersionDiffs] = useState<any[]>([]);

  // Change Impact Modal
  const [impactModalOpen, setImpactModalOpen] = useState<boolean>(false);
  const [impactData, setImpactData] = useState<any>(null);
  const [selectedChange, setSelectedChange] = useState<string>('difficulty:medium->advanced');

  // Publishing Modal
  const [publishModalOpen, setPublishModalOpen] = useState<boolean>(false);
  const [classLabel, setClassLabel] = useState<string>('Class 10-A');
  const [publishSuccess, setPublishSuccess] = useState<boolean>(false);

  useEffect(() => {
    loadPackData();
  }, [unitId]);

  const loadPackData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [p, h] = await Promise.all([
        api.getLearningPack(unitId),
        api.getUnitHealth(unitId),
      ]);
      setPack(p);
      setHealth(h);

      // Select first slot by default
      if (p.by_objective?.[0]?.slots?.[0]?.slot) {
        setSelectedSlotId(p.by_objective[0].slots[0].slot.id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load learning pack');
    } finally {
      setLoading(false);
    }
  };

  // Find currently active item
  const allSlotItems = pack?.by_objective?.flatMap((o) => o.slots) || [];
  const activeItem = allSlotItems.find((item) => item.slot.id === selectedSlotId) || allSlotItems[0];

  // Handle Asset Status Update
  const handleApprove = async (assetId: number, override: boolean = false) => {
    try {
      await api.updateAssetStatus(assetId, {
        status: 'approved',
        actor: 'Teacher Admin',
        override,
        override_reason: override ? overrideReason : undefined,
      });
      setApprovalModalOpen(false);
      setOverrideModalOpen(false);
      setOverrideReason('');
      loadPackData();
    } catch (err: any) {
      if (err.status === 409) {
        setActiveAssetId(assetId);
        setOverrideModalOpen(true);
      } else {
        alert(err.message || 'Failed to update asset status');
      }
    }
  };

  const handleSetNeedsRevision = async (assetId: number) => {
    try {
      await api.updateAssetStatus(assetId, {
        status: 'needs_revision',
        actor: 'Teacher Admin',
      });
      loadPackData();
    } catch (err: any) {
      alert(err.message || 'Failed to set needs revision');
    }
  };

  // Handle Regeneration
  const handleRegenerate = async () => {
    if (!activeItem?.asset) return;
    try {
      setIsRegenerating(true);
      await api.regenerateAsset(activeItem.asset.id, regenFeedback || undefined);
      setRegenerateModalOpen(false);
      setRegenFeedback('');
      loadPackData();
    } catch (err: any) {
      alert(err.message || 'Regeneration failed');
    } finally {
      setIsRegenerating(false);
    }
  };

  // Handle Simplification
  const handleSimplify = async (assetId: number) => {
    try {
      await api.simplifyAsset(assetId);
      loadPackData();
    } catch (err: any) {
      alert(err.message || 'Simplification failed');
    }
  };

  // Handle Versions History
  const handleOpenVersions = async (assetId: number) => {
    try {
      const data = await api.getAssetVersions(assetId);
      setAssetVersions(data.versions || []);
      setVersionDiffs(data.diffs || []);
      setVersionsModalOpen(true);
    } catch (err: any) {
      alert(err.message || 'Failed to load versions history');
    }
  };

  // Handle Impact Check
  const handleCheckImpact = async (changeStr: string) => {
    try {
      setSelectedChange(changeStr);
      const data = await api.getChangeImpact(unitId, changeStr);
      setImpactData(data);
      setImpactModalOpen(true);
    } catch (err: any) {
      alert(err.message || 'Impact analysis failed');
    }
  };

  // Handle Publish
  const handlePublish = async () => {
    try {
      await api.publishUnit(unitId, classLabel);
      setPublishSuccess(true);
      loadPackData();
    } catch (err: any) {
      alert(err.message || 'Publishing failed');
    }
  };

  // Handle Export
  const handleExport = async () => {
    try {
      const res = await api.exportUnit(unitId);
      const blob = new Blob([res.html_document], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `unit_${unitId}_lessonfoundry_pack.html`;
      a.click();
    } catch (err: any) {
      alert(err.message || 'Export failed');
    }
  };

  if (loading) return <LoadingState message="Loading evidence-locked learning pack..." />;
  if (error || !pack) return <ErrorBanner message={error || 'Unit not found'} onRetry={loadPackData} />;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <Card className="p-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-[#4F46E5]">
                {pack.unit.target_grade}
              </span>
              <span className="text-xs text-slate-400 capitalize">• {pack.unit.difficulty} difficulty</span>
              <span className="text-xs text-slate-400">• {pack.unit.language}</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900">{pack.unit.title}</h1>
            <p className="text-xs text-slate-500">
              Source Version #{pack.unit.pinned_source_version_id} • {allSlotItems.length} Pedagogical Slots
            </p>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCheckImpact('difficulty:medium->advanced')}
              leftIcon={<Zap className="w-3.5 h-3.5 text-amber-500" />}
            >
              Change Impact
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              leftIcon={<Download className="w-3.5 h-3.5" />}
            >
              Export HTML
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setPublishSuccess(false);
                setPublishModalOpen(true);
              }}
              leftIcon={<Send className="w-3.5 h-3.5" />}
            >
              Publish to Class
            </Button>
          </div>
        </div>
      </Card>

      {/* Main Grid: Left Slot List & Pack Health, Right Asset Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 cols): Pack Health & Slot Navigation */}
        <div className="lg:col-span-4 space-y-6">
          {/* Pack Health Gauge */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-500">
                Pack Health & Guardrails
              </h3>
              <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                0-100 Standard
              </span>
            </div>

            <div className="flex items-center gap-5 mb-4">
              <ProgressRing score={health?.score || 0} size={84} strokeWidth={8} />
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Evidence-Locked: {(health?.grounding_ratio || 1) * 100}%</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  <span>Dual Solver: {(health?.solver_verification_rate || 1) * 100}%</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  {health?.open_flags_by_severity.error || 0} Error Flags • {health?.open_flags_by_severity.warning || 0} Warnings
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1.5 text-slate-600">
              <div className="flex justify-between text-[11px]">
                <span>Verified Claims:</span>
                <span className="font-semibold text-slate-800">{health?.verified_claims} / {health?.total_claims}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span>Independent Solver Verified:</span>
                <span className="font-semibold text-slate-800">{health?.verified_questions} / {health?.total_questions}</span>
              </div>
            </div>
          </Card>

          {/* Slot Navigator */}
          <Card>
            <CardHeader
              title="Pack Blueprint Slots"
              subtitle="Select an item to inspect quotes and solver outputs."
            />
            <CardContent className="p-2 space-y-1 max-h-[600px] overflow-y-auto">
              {allSlotItems.map((item, idx) => {
                const isSelected = item.slot.id === selectedSlotId;
                const status = item.asset?.status || 'draft';

                return (
                  <button
                    key={item.slot.id}
                    onClick={() => setSelectedSlotId(item.slot.id)}
                    className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between text-xs ${
                      isSelected
                        ? 'bg-indigo-50 border border-indigo-200 text-indigo-950 font-medium shadow-sm'
                        : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="w-5 h-5 rounded bg-white border border-slate-200 text-slate-600 font-semibold text-[10px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="truncate">
                        <div className="font-semibold capitalize truncate">
                          {item.slot.type.replace('_', ' ')}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          Objective #{item.slot.objective_id}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      <StatusPill status={status} size="sm" />
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Right Column (8 cols): Active Slot & Asset Inspector */}
        <div className="lg:col-span-8 space-y-6">
          {activeItem && activeItem.asset ? (
            <Card>
              <CardHeader
                title={
                  <div className="flex items-center gap-3">
                    <span className="capitalize">{activeItem.slot.type.replace('_', ' ')} Inspector</span>
                    {activeItem.asset.current_version && (
                      <span className="text-xs font-normal text-slate-400">
                        v{activeItem.asset.current_version.version_no} ({activeItem.asset.current_version.variant})
                      </span>
                    )}
                  </div>
                }
                subtitle={`Slot ID #${activeItem.slot.id} • Objective #${activeItem.slot.objective_id}`}
                action={
                  <div className="flex items-center gap-2">
                    <StatusPill status={activeItem.asset.status} />
                    {activeItem.asset.locked && (
                      <span className="p-1 rounded bg-emerald-100 text-emerald-800" title="Locked upon approval">
                        <Lock className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                }
              />

              <CardContent className="space-y-6">
                {/* Content Renderer */}
                <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                  {/* Explanation Content */}
                  {activeItem.slot.type === 'explanation' && activeItem.asset.current_version?.content && (
                    <div className="space-y-3 text-xs leading-relaxed text-slate-800">
                      <h4 className="font-bold text-sm text-slate-900">
                        {activeItem.asset.current_version.content.title}
                      </h4>
                      <p className="text-slate-600 italic">
                        {activeItem.asset.current_version.content.summary}
                      </p>

                      <div className="space-y-2 mt-3">
                        <span className="font-semibold text-slate-700 block">Sentences with Grounded Evidence:</span>
                        {activeItem.asset.current_version.content.sentences?.map((s: any, idx: number) => (
                          <div key={idx} className="p-2.5 bg-white border border-slate-200 rounded-lg">
                            <p className="text-slate-800 font-medium">{s.text}</p>
                            <div className="mt-1.5 text-[11px] text-indigo-700 bg-indigo-50/70 p-1.5 rounded font-mono">
                              &ldquo;{s.quote}&rdquo;
                            </div>
                          </div>
                        ))}
                      </div>

                      {activeItem.asset.current_version.content.glossary?.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-200 space-y-2">
                          <span className="font-semibold text-slate-700 block">Glossary Terms:</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {activeItem.asset.current_version.content.glossary.map((g: any, gIdx: number) => (
                              <div key={gIdx} className="p-2 bg-white border border-slate-200 rounded-lg">
                                <span className="font-bold text-indigo-900 block">{g.term}</span>
                                <span className="text-slate-600 text-[11px] block mt-0.5">{g.definition}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Example Content */}
                  {activeItem.slot.type === 'example' && activeItem.asset.current_version?.content && (
                    <div className="space-y-3 text-xs text-slate-800">
                      <div className="p-3 bg-white border border-slate-200 rounded-lg">
                        <span className="font-bold text-slate-900 block mb-1">Worked Problem:</span>
                        <p>{activeItem.asset.current_version.content.problem}</p>
                      </div>

                      <div className="space-y-2">
                        <span className="font-semibold text-slate-700 block">Step-by-Step Solution:</span>
                        {activeItem.asset.current_version.content.steps?.map((st: any, sIdx: number) => (
                          <div key={sIdx} className="p-2.5 bg-white border border-slate-200 rounded-lg">
                            <span className="font-bold text-slate-700 block">Step {sIdx + 1}:</span>
                            <p className="mt-0.5">{st.text}</p>
                            <div className="mt-1 text-[11px] text-indigo-700 bg-indigo-50/70 p-1.5 rounded font-mono">
                              &ldquo;{st.quote}&rdquo;
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quiz / Practice Items */}
                  {(activeItem.slot.type === 'quiz_item' ||
                    activeItem.slot.type === 'practice_foundation' ||
                    activeItem.slot.type === 'practice_advanced') &&
                    activeItem.asset.current_version?.content && (
                      <div className="space-y-4 text-xs text-slate-800">
                        <div className="p-3 bg-white border border-slate-200 rounded-lg font-medium text-sm text-slate-900">
                          {activeItem.asset.current_version.content.question}
                        </div>

                        <div className="space-y-2">
                          <span className="font-semibold text-slate-700 block">Options:</span>
                          {activeItem.asset.current_version.content.options?.map((opt: string, oIdx: number) => {
                            const isCorrect = oIdx === activeItem.asset?.current_version?.content?.correct_index;
                            return (
                              <div
                                key={oIdx}
                                className={`p-2.5 rounded-lg border flex items-center justify-between ${
                                  isCorrect
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold'
                                    : 'bg-white border-slate-200 text-slate-700'
                                }`}
                              >
                                <span>{String.fromCharCode(65 + oIdx)}. {opt}</span>
                                {isCorrect && (
                                  <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                                    Correct Answer
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-lg text-indigo-950">
                          <span className="font-semibold block mb-0.5">Pedagogical Rationale:</span>
                          <p className="text-slate-700 leading-relaxed">
                            {activeItem.asset.current_version.content.rationale}
                          </p>
                          <div className="mt-2 text-[11px] text-indigo-800 font-mono bg-white p-2 rounded border border-indigo-200">
                            Evidence: &ldquo;{activeItem.asset.current_version.content.quote}&rdquo;
                          </div>
                        </div>
                      </div>
                    )}

                  {/* Revision Content */}
                  {activeItem.slot.type === 'revision' && activeItem.asset.current_version?.content && (
                    <div className="space-y-3 text-xs text-slate-800">
                      <h4 className="font-bold text-sm text-slate-900">Unit Revision & Summary</h4>
                      <div className="space-y-2">
                        {activeItem.asset.current_version.content.key_points?.map((kp: any, kIdx: number) => (
                          <div key={kIdx} className="p-2.5 bg-white border border-slate-200 rounded-lg">
                            <p className="font-medium text-slate-900">{kp.text}</p>
                            <div className="mt-1 text-[11px] text-indigo-700 bg-indigo-50 p-1.5 rounded font-mono">
                              &ldquo;{kp.quote}&rdquo;
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Independent Solver Output */}
                {activeItem.asset.current_version?.verification?.solver && (
                  <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-semibold text-indigo-900">
                        <Sparkles className="w-4 h-4 text-indigo-600" />
                        <span>Independent Solver Verification</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Dual Solved Match
                      </span>
                    </div>
                    <p className="text-slate-600 text-[11px]">
                      A blinded model call independently evaluated the question stem using only source chunks.
                    </p>
                  </div>
                )}
              </CardContent>

              {/* Action Buttons: Status Approval, Regeneration, Versions */}
              <CardFooter className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenVersions(activeItem.asset!.id)}
                    leftIcon={<History className="w-3.5 h-3.5" />}
                  >
                    Version History
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSimplify(activeItem.asset!.id)}
                    leftIcon={<Sparkles className="w-3.5 h-3.5" />}
                  >
                    Generate Simplified Variant
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  {activeItem.asset.status !== 'needs_revision' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSetNeedsRevision(activeItem.asset!.id)}
                      className="border-amber-300 text-amber-800 hover:bg-amber-50"
                    >
                      Mark Needs Revision
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      if (activeItem.asset?.locked) {
                        alert('Asset is locked because it is approved. Please set "Needs Revision" first before regenerating.');
                        return;
                      }
                      setRegenerateModalOpen(true);
                    }}
                    leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                  >
                    Regenerate
                  </Button>

                  <Button
                    size="sm"
                    variant="success"
                    disabled={activeItem.asset.status === 'approved'}
                    onClick={() => handleApprove(activeItem.asset!.id, false)}
                    leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                  >
                    {activeItem.asset.status === 'approved' ? 'Approved & Locked' : 'Approve Asset'}
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ) : (
            <Card className="p-8 text-center text-slate-400 text-xs">
              Select an item from the blueprint list to inspect.
            </Card>
          )}
        </div>
      </div>

      {/* Override Reason Modal (Server Refusal on Unverified Claims) */}
      <Modal
        isOpen={overrideModalOpen}
        onClose={() => setOverrideModalOpen(false)}
        title="Quality Gate Approval Refused"
        subtitle="Unverified claims or error-level flags exist on this asset."
        footer={
          <>
            <Button variant="outline" onClick={() => setOverrideModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!overrideReason.trim()}
              onClick={() => {
                if (activeAssetId) handleApprove(activeAssetId, true);
              }}
            >
              Confirm Override & Log Reason
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900">
            The server blocked approval because one or more claims lack verified quotes or error flags are unresolved.
          </div>
          <div>
            <label className="block font-semibold text-slate-800 mb-1">
              Mandatory Teacher Override Reason:
            </label>
            <textarea
              rows={3}
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Explain why this ungrounded claim or mismatch is acceptable for classroom use..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
          </div>
        </div>
      </Modal>

      {/* Regeneration Modal */}
      <Modal
        isOpen={regenerateModalOpen}
        onClose={() => setRegenerateModalOpen(false)}
        title="Regenerate Pedagogical Slot"
        subtitle="Creates a new AssetVersion with parent_version_id and preserves all other assets."
        footer={
          <>
            <Button variant="outline" onClick={() => setRegenerateModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRegenerate} isLoading={isRegenerating}>
              Regenerate Asset
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <label className="block font-semibold text-slate-800">
            Teacher Feedback / Revision Instructions (Optional):
          </label>
          <textarea
            rows={4}
            value={regenFeedback}
            onChange={(e) => setRegenFeedback(e.target.value)}
            placeholder="e.g. Focus more explicitly on the Calvin cycle enzyme RuBisCO..."
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
          />
        </div>
      </Modal>

      {/* Version History Modal */}
      <Modal
        isOpen={versionsModalOpen}
        onClose={() => setVersionsModalOpen(false)}
        title="Asset Version History & Provenance"
        maxWidth="lg"
      >
        <div className="space-y-4 text-xs">
          {assetVersions.map((ver) => (
            <div key={ver.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">
                  Version #{ver.version_no} ({ver.variant})
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {new Date(ver.created_at).toLocaleString()}
                </span>
              </div>
              <div className="text-[11px] text-slate-600 space-y-0.5">
                <div>Model: <span className="font-mono">{ver.model}</span></div>
                <div>Source SHA256: <span className="font-mono">{ver.source_sha256?.substring(0, 16)}...</span></div>
                {ver.parent_version_id && (
                  <div>Parent Version ID: #{ver.parent_version_id}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* Change Impact Modal */}
      <Modal
        isOpen={impactModalOpen}
        onClose={() => setImpactModalOpen(false)}
        title="Change Impact Analysis"
        subtitle="Calculates which slots must be regenerated when inputs change."
        maxWidth="lg"
      >
        {impactData && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-950">
              Change: <span className="font-mono font-bold">{impactData.change}</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-950">
                <span className="font-bold block mb-1">Affected Slots: {impactData.affected_slots?.length || 0}</span>
                <p className="text-[11px]">These assets depend on the modified setting.</p>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-950">
                <span className="font-bold block mb-1">Unaffected Slots: {impactData.unaffected_slots?.length || 0}</span>
                <p className="text-[11px]">Independent of the change; preserved as-is.</p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-950 text-[11px]">
              <span className="font-semibold block mb-0.5">Safety Rule:</span>
              Regeneration will never overwrite approved assets. Approved items will be marked stale for teacher decision.
            </div>
          </div>
        )}
      </Modal>

      {/* Publish Modal */}
      <Modal
        isOpen={publishModalOpen}
        onClose={() => setPublishModalOpen(false)}
        title="Publish Learning Pack to Class"
        subtitle="Snapshots only approved current versions into an immutable publication."
        footer={
          !publishSuccess ? (
            <>
              <Button variant="outline" onClick={() => setPublishModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handlePublish}>Publish to Students</Button>
            </>
          ) : (
            <Button onClick={() => setPublishModalOpen(false)}>Close</Button>
          )
        }
      >
        {publishSuccess ? (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
            <h4 className="font-bold text-sm text-emerald-950">Unit Published to {classLabel}!</h4>
            <p className="text-xs text-emerald-800">
              Students can now access approved questions and formative assessments via the student portal.
            </p>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-800 mb-1">Target Class / Section:</label>
              <input
                type="text"
                value={classLabel}
                onChange={(e) => setClassLabel(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              />
            </div>
            <p className="text-slate-500 text-[11px]">
              Only approved assets will be student-visible. Answer keys and rationales will be securely hidden until submission.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};
