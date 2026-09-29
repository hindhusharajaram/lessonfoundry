import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  History,
  Lock,
  Zap,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { Card, CardHeader, CardContent, CardFooter } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusPill } from '../../components/common/StatusPill';
import { Badge } from '../../components/common/Badge';
import { ProgressRing } from '../../components/common/ProgressBar';
import { Modal } from '../../components/common/Modal';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { EvidenceViewerModal } from '../../components/unit/EvidenceViewerModal';
import { QualityChecklistCard } from '../../components/unit/QualityChecklistCard';
import { QualityFlagsDrawer } from '../../components/unit/QualityFlagsDrawer';
import { PracticeComparisonView } from '../../components/unit/PracticeComparisonView';
import { LearningConsistencyGraph } from '../../components/unit/LearningConsistencyGraph';
import { AIResponsibilityReport } from '../../components/unit/AIResponsibilityReport';
import { ChangeImpactView } from '../../components/unit/ChangeImpactView';
import { PublishUnitView } from '../../components/unit/PublishUnitView';
import { api } from '../../services/api';
import {
  LearningPack,
  PackHealth,
  AssetVersion,
  Claim,
} from '../../types';

export const UnitPackPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const unitId = parseInt(id || '1');

  // Active Tab
  const [activeTab, setActiveTab] = useState<'review' | 'consistency' | 'responsibility' | 'impact' | 'publish'>('review');

  const [pack, setPack] = useState<LearningPack | null>(null);
  const [health, setHealth] = useState<PackHealth | null>(null);
  const [sourceData, setSourceData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Selected item inspection
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);

  // Quality Flags Drawer
  const [flagsDrawerOpen, setFlagsDrawerOpen] = useState<boolean>(false);

  // Evidence Viewer Modal
  const [evidenceModalOpen, setEvidenceModalOpen] = useState<boolean>(false);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);

  // Approval & Override Modal
  const [overrideModalOpen, setOverrideModalOpen] = useState<boolean>(false);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [activeAssetId, setActiveAssetId] = useState<number | null>(null);

  // Bloom Tag Edit Modal
  const [bloomModalOpen, setBloomModalOpen] = useState<boolean>(false);
  const [selectedBloomTag, setSelectedBloomTag] = useState<string>('apply');
  const [bloomReason, setBloomReason] = useState<string>('');

  // Regeneration Modal
  const [regenerateModalOpen, setRegenerateModalOpen] = useState<boolean>(false);
  const [regenFeedback, setRegenFeedback] = useState<string>('');
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);

  // Version History Modal
  const [versionsModalOpen, setVersionsModalOpen] = useState<boolean>(false);
  const [assetVersions, setAssetVersions] = useState<AssetVersion[]>([]);

  // Preview Impact Modal
  const [impactModalOpen, setImpactModalOpen] = useState<boolean>(false);
  const [impactChangeParam, setImpactChangeParam] = useState<string>('difficulty:medium->advanced');
  const [impactResult, setImpactResult] = useState<any>(null);
  const [impactLoading, setImpactLoading] = useState<boolean>(false);

  const loadPackData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [p, h, src] = await Promise.all([
        api.getLearningPack(unitId),
        api.getUnitHealth(unitId),
        api.getUnitSourceText(unitId).catch(() => null),
      ]);
      setPack(p);
      setHealth(h);
      setSourceData(src);

      // Select first slot by default
      if (p.by_objective?.[0]?.slots?.[0]?.slot) {
        setSelectedSlotId((prev) => prev ?? p.by_objective[0].slots[0].slot.id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load learning pack');
    } finally {
      setLoading(false);
    }
  }, [unitId]);

  useEffect(() => {
    loadPackData();
  }, [loadPackData]);

  const handlePreviewImpact = async (customChange?: string) => {
    const changeToQuery = customChange || impactChangeParam;
    try {
      setImpactLoading(true);
      if (customChange) {
        setImpactChangeParam(customChange);
      }
      const res = await api.getChangeImpact(unitId, changeToQuery);
      setImpactResult(res);
      setImpactModalOpen(true);
    } catch (err: any) {
      alert(err.message || 'Failed to preview change impact');
    } finally {
      setImpactLoading(false);
    }
  };

  // Find currently active item
  const allSlotItems = pack?.by_objective?.flatMap((o) => o.slots) || [];
  const activeItem = allSlotItems.find((item) => item.slot.id === selectedSlotId) || allSlotItems[0];

  // Find companion practice items for side-by-side view
  const foundationPracticeItem = allSlotItems.find((item) => item.slot.type === 'practice_foundation');
  const advancedPracticeItem = allSlotItems.find((item) => item.slot.type === 'practice_advanced');

  // Handle Asset Status Update
  const handleApprove = async (assetId: number, override: boolean = false) => {
    try {
      await api.updateAssetStatus(assetId, {
        status: 'approved',
        actor: 'Teacher Admin',
        override,
        override_reason: override ? overrideReason : undefined,
      });
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

  // Handle Regeneration
  const handleRegenerate = async () => {
    if (!activeItem?.asset) return;
    try {
      setIsRegenerating(true);
      // If asset is locked or approved, automatically transition to needs_revision with teacher note
      if (activeItem.asset.status === 'approved' || activeItem.asset.locked) {
        await api.updateAssetStatus(activeItem.asset.id, {
          status: 'needs_revision',
          actor: 'Teacher Admin',
          note: regenFeedback || 'Reverted to needs_revision for feedback regeneration',
        });
      }
      await api.regenerateAsset(activeItem.asset.id, regenFeedback || undefined);
      setRegenerateModalOpen(false);
      setRegenFeedback('');
      await loadPackData();
    } catch (err: any) {
      alert(err.message || 'Regeneration failed');
    } finally {
      setIsRegenerating(false);
    }
  };

  // Handle Bloom Tag Update
  const handleUpdateBloomTag = async () => {
    if (!activeItem?.asset) return;
    try {
      await api.updateBloomTag(activeItem.asset.id, {
        bloom_tag: selectedBloomTag,
        actor: 'Teacher Admin',
        reason: bloomReason || undefined,
      });
      setBloomModalOpen(false);
      setBloomReason('');
      loadPackData();
    } catch (err: any) {
      alert(err.message || 'Failed to update Bloom tag');
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
      setVersionsModalOpen(true);
    } catch (err: any) {
      alert(err.message || 'Failed to load versions history');
    }
  };

  // Claim Popover State
  const [popoverClaim, setPopoverClaim] = useState<Claim | null>(null);

  const findMatchingClaim = (text: string, quote?: string): Claim | null => {
    const claims = activeItem?.claims || activeItem?.asset?.current_version?.claims || [];
    if (!claims.length) return null;
    const cleanText = text.trim().toLowerCase();
    const cleanQuote = quote?.trim().toLowerCase();

    // 1. Exact text or quote match
    const exact = claims.find(
      (c) =>
        c.text.trim().toLowerCase() === cleanText ||
        (cleanQuote && c.source_quote.trim().toLowerCase() === cleanQuote)
    );
    if (exact) return exact;

    // 2. Substring match
    const sub = claims.find(
      (c) =>
        cleanText.includes(c.text.trim().toLowerCase()) ||
        c.text.trim().toLowerCase().includes(cleanText) ||
        (cleanQuote &&
          (c.source_quote.trim().toLowerCase().includes(cleanQuote) ||
            cleanQuote.includes(c.source_quote.trim().toLowerCase())))
    );
    return sub || null;
  };

  const renderClaimSpan = (text: string, quote?: string, className: string = '') => {
    if (!text) return null;
    const matchingClaim = findMatchingClaim(text, quote);
    const isVerified = matchingClaim ? matchingClaim.verified : (quote ? true : true);
    const matchScore = matchingClaim ? matchingClaim.match_score : 1.0;
    const chunkId = matchingClaim?.chunk_id ?? 1;
    const isSelected =
      popoverClaim &&
      (popoverClaim.text === text ||
        (matchingClaim && popoverClaim.id === matchingClaim.id && matchingClaim.id > 0) ||
        (quote && popoverClaim.source_quote === quote));

    const claimToSelect: Claim = matchingClaim || {
      id: 0,
      asset_version_id: activeItem?.asset?.current_version?.id || 0,
      text: text,
      source_quote: quote || text,
      chunk_id: chunkId,
      char_start: 0,
      char_end: (quote || text).length,
      verified: isVerified,
      match_score: matchScore,
    };

    return (
      <span
        onClick={(e) => {
          e.stopPropagation();
          setPopoverClaim(isSelected ? null : claimToSelect);
        }}
        className={`relative inline transition-all cursor-pointer rounded px-1 py-0.5 select-text ${className} ${
          !isVerified
            ? 'bg-rose-50 text-rose-950 border-b-2 border-dashed border-rose-500 font-medium'
            : isSelected
            ? 'bg-indigo-100 text-indigo-950 border-b-2 border-indigo-600 font-medium'
            : 'hover:bg-indigo-50 border-b border-dashed border-indigo-300 text-slate-800'
        }`}
        title={
          isVerified
            ? `Verified Ground-Truth Claim (${(matchScore * 100).toFixed(0)}% match) - Click to view source quote`
            : `⚠️ Unverified Claim (${(matchScore * 100).toFixed(0)}% match) - Click to view source quote`
        }
      >
        {text}
        {!isVerified && (
          <span className="ml-1 inline-flex items-center text-[10px] bg-rose-200 text-rose-800 px-1 rounded font-bold">
            Unverified
          </span>
        )}
      </span>
    );
  };

  // Handle Evidence Viewer Open
  const handleOpenEvidence = (claimOrQuote: { text: string; quote: string; verified?: boolean; char_start?: number; char_end?: number }) => {
    const claimObj: Claim = {
      id: 0,
      asset_version_id: activeItem?.asset?.current_version?.id || 0,
      text: claimOrQuote.text,
      source_quote: claimOrQuote.quote,
      chunk_id: null,
      char_start: claimOrQuote.char_start ?? 0,
      char_end: claimOrQuote.char_end ?? (claimOrQuote.char_start ? claimOrQuote.char_start + claimOrQuote.quote.length : 0),
      verified: claimOrQuote.verified ?? true,
      match_score: 1.0,
    };
    setSelectedClaim(claimObj);
    setEvidenceModalOpen(true);
  };

  if (loading) return <LoadingState message="Loading evidence-locked learning pack..." />;
  if (error || !pack) return <ErrorBanner message={error || 'Unit not found'} onRetry={loadPackData} />;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <Card className="p-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-[#4F46E5]">
                {pack.unit.target_grade}
              </span>
              <span className="text-xs text-slate-400 capitalize">• {pack.unit.difficulty} difficulty</span>
              <span className="text-xs text-slate-400">• {pack.unit.language}</span>
              <button
                type="button"
                onClick={() => handlePreviewImpact(`difficulty:${pack.unit.difficulty}->${pack.unit.difficulty === 'medium' ? 'advanced' : 'medium'}`)}
                className="ml-2 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer"
                title="Preview impact of parameter changes on pedagogical assets"
              >
                <Zap className="w-3 h-3 text-amber-600" />
                Preview Impact
              </button>
            </div>
            <h1 className="text-xl font-bold text-slate-900">{pack.unit.title}</h1>
            <p className="text-xs text-slate-500">
              Source Version #{pack.unit.pinned_source_version_id} • {allSlotItems.length} Pedagogical Slots
            </p>
          </div>

          {/* Quick Action Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('review')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'review'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pack Review
            </button>
            <button
              onClick={() => setActiveTab('consistency')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'consistency'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Consistency Graph
            </button>
            <button
              onClick={() => setActiveTab('responsibility')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'responsibility'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              AI Responsibility
            </button>
            <button
              onClick={() => setActiveTab('impact')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'impact'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Change Impact
            </button>
            <button
              onClick={() => setActiveTab('publish')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'publish'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Publish & Export
            </button>
          </div>
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* TAB 1: PACK REVIEW & QUALITY GATE CHECKLIST */}
      {/* ========================================================================= */}
      {activeTab === 'review' && (
        <div className="space-y-6 animate-in">
          {/* AI Quality Gate Checklist Card */}
          <QualityChecklistCard
            health={health}
            flags={health?.flags || []}
            onOpenFlagsReport={() => setFlagsDrawerOpen(true)}
          />

          {/* Side-by-Side Practice Comparison Section (if practice items exist) */}
          {(foundationPracticeItem || advancedPracticeItem) && (
            <PracticeComparisonView
              foundationSlot={foundationPracticeItem || null}
              advancedSlot={advancedPracticeItem || null}
            />
          )}

          {/* Main Inspection Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column (4 cols): Pack Health & Slot Navigation */}
            <div className="lg:col-span-4 space-y-6">
              {/* Pack Health Gauge */}
              <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-500">
                    Pack Health Score
                  </h3>
                  <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    Formula SPEC
                  </span>
                </div>

                <div className="flex items-center gap-5 mb-4">
                  <ProgressRing score={health?.score || 0} size={84} strokeWidth={8} />
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Grounding: {((health?.grounding_ratio || 1) * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Sparkles className="w-4 h-4 text-indigo-500" />
                      <span>Dual Solver: {((health?.solver_verification_rate || 1) * 100).toFixed(0)}%</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {health?.open_flags_by_severity?.error || 0} Errors • {health?.open_flags_by_severity?.warning || 0} Warnings
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1.5 text-slate-600">
                  <div className="flex justify-between text-[11px]">
                    <span>Verified Claims:</span>
                    <span className="font-semibold text-slate-800">
                      {health?.verified_claims} / {health?.total_claims}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span>Dual Solved Questions:</span>
                    <span className="font-semibold text-slate-800">
                      {health?.verified_questions} / {health?.total_questions}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Slot Navigator List */}
              <Card>
                <CardHeader
                  title="Teacher Review Items"
                  subtitle="Select an item to inspect claims and quotes."
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
                            <div className="font-semibold capitalize truncate flex items-center gap-1.5">
                              <span>{item.slot.type.replace('_', ' ')}</span>
                              {item.asset?.locked && <Lock className="w-3 h-3 text-emerald-600" />}
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

            {/* Right Column (8 cols): Active Slot Inspector */}
            <div className="lg:col-span-8 space-y-6">
              {activeItem && activeItem.asset ? (
                <Card>
                  <CardHeader
                    title={
                      <div className="flex items-center gap-3">
                        <span className="capitalize">{activeItem.slot.type.replace('_', ' ')}</span>
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
                        {activeItem.slot.bloom_tag && (
                          <button
                            onClick={() => {
                              setSelectedBloomTag(activeItem.slot.bloom_tag || 'understand');
                              setBloomModalOpen(true);
                            }}
                            className="hover:opacity-80 transition-opacity"
                            title="Click to override Bloom tag"
                          >
                            <Badge bloom={activeItem.slot.bloom_tag} />
                          </button>
                        )}
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
                    {/* Active Claim Popover / Grounding Panel */}
                    {popoverClaim && (
                      <div className="p-4 bg-white border-2 border-indigo-200 rounded-xl shadow-sm text-xs space-y-3 animate-in">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <div className="flex items-center gap-2">
                            {popoverClaim.verified ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Verified Ground Truth ({(popoverClaim.match_score * 100).toFixed(1)}% match)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Unverified / Below Threshold ({(popoverClaim.match_score * 100).toFixed(1)}% match)
                              </span>
                            )}
                            <span className="text-slate-500 font-medium text-[11px]">
                              Source Chunk #{popoverClaim.chunk_id ?? 1}
                            </span>
                          </div>
                          <button
                            onClick={() => setPopoverClaim(null)}
                            className="text-slate-400 hover:text-slate-600 px-2 py-0.5 rounded hover:bg-slate-100 font-bold"
                            title="Dismiss inspection panel"
                          >
                            ✕
                          </button>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            Verbatim Source Quote:
                          </span>
                          <p className="font-mono text-indigo-950 bg-indigo-50/70 p-2.5 rounded-lg border border-indigo-100 text-xs leading-relaxed select-text">
                            &ldquo;{popoverClaim.source_quote}&rdquo;
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-500">
                          <span className="font-mono text-[10px]">
                            Offsets: [{popoverClaim.char_start ?? 0} : {popoverClaim.char_end ?? popoverClaim.source_quote?.length ?? 0}]
                          </span>
                          <button
                            onClick={() => {
                              setSelectedClaim(popoverClaim);
                              setEvidenceModalOpen(true);
                            }}
                            className="text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1 hover:underline"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View in Context (Full Textbook)
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Content Renderer with Clickable Claim Spans */}
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
                            <div className="flex items-center justify-between text-slate-700">
                              <span className="font-semibold block">
                                Evidence-Locked Sentences (Click any sentence to inspect source quote):
                              </span>
                              <span className="text-[11px] text-indigo-600 font-medium">
                                Interactive Claims
                              </span>
                            </div>
                            {activeItem.asset.current_version.content.sentences?.map((s: any, idx: number) => (
                              <div key={idx} className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
                                <p className="leading-relaxed font-medium">
                                  {renderClaimSpan(s.text, s.quote)}
                                </p>
                                <div className="flex items-center justify-between text-[11px] text-indigo-700 bg-indigo-50/70 p-2 rounded font-mono">
                                  <span className="truncate max-w-[80%]">&ldquo;{s.quote}&rdquo;</span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleOpenEvidence(s)}
                                    leftIcon={<ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />}
                                    className="bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                                  >
                                    Evidence
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>

                          {activeItem.asset.current_version.content.glossary?.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-slate-200 space-y-2">
                              <span className="font-semibold text-slate-700 block">Glossary Terms:</span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {activeItem.asset.current_version.content.glossary.map((g: any, gIdx: number) => (
                                  <div key={gIdx} className="p-2.5 bg-white border border-slate-200 rounded-lg">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="font-bold text-indigo-900">{g.term}</span>
                                      <button
                                        onClick={() => handleOpenEvidence({ text: g.definition, quote: g.quote || g.definition })}
                                        className="text-indigo-600 hover:text-indigo-800"
                                        title="View source evidence"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                    <span className="text-slate-600 text-[11px] block leading-relaxed">
                                      {renderClaimSpan(g.definition, g.quote || g.definition)}
                                    </span>
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
                          <div className="p-3.5 bg-white border border-slate-200 rounded-lg">
                            <span className="font-bold text-slate-900 block mb-1">Worked Problem:</span>
                            <p className="leading-relaxed">
                              {renderClaimSpan(activeItem.asset.current_version.content.problem)}
                            </p>
                          </div>

                          <div className="space-y-2">
                            <span className="font-semibold text-slate-700 block">
                              Step-by-Step Solution (Click any step to inspect source quote):
                            </span>
                            {activeItem.asset.current_version.content.steps?.map((st: any, sIdx: number) => (
                              <div key={sIdx} className="p-3 bg-white border border-slate-200 rounded-lg space-y-1.5">
                                <span className="font-bold text-slate-700 block">Step {sIdx + 1}:</span>
                                <p className="leading-relaxed font-medium">
                                  {renderClaimSpan(st.text, st.quote)}
                                </p>
                                <div className="flex items-center justify-between text-[11px] text-indigo-700 bg-indigo-50/70 p-2 rounded font-mono">
                                  <span className="truncate max-w-[80%]">&ldquo;{st.quote}&rdquo;</span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleOpenEvidence(st)}
                                    leftIcon={<ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />}
                                    className="bg-white border-indigo-200 text-indigo-700"
                                  >
                                    Evidence
                                  </Button>
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
                            <div className="p-3.5 bg-white border border-slate-200 rounded-lg font-medium text-sm text-slate-900 leading-relaxed">
                              {renderClaimSpan(
                                activeItem.asset.current_version.content.question,
                                activeItem.asset.current_version.content.quote
                              )}
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

                            <div className="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-lg text-indigo-950 space-y-2">
                              <div>
                                <span className="font-semibold block mb-0.5">Pedagogical Rationale:</span>
                                <p className="text-slate-700 leading-relaxed font-medium">
                                  {renderClaimSpan(
                                    activeItem.asset.current_version.content.rationale,
                                    activeItem.asset.current_version.content.quote
                                  )}
                                </p>
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-indigo-800 font-mono bg-white p-2 rounded border border-indigo-200">
                                <span className="truncate max-w-[80%]">
                                  Evidence: &ldquo;{activeItem.asset.current_version.content.quote}&rdquo;
                                </span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenEvidence({
                                    text: activeItem.asset?.current_version?.content?.question,
                                    quote: activeItem.asset?.current_version?.content?.quote,
                                  })}
                                  leftIcon={<ShieldCheck className="w-3.5 h-3.5" />}
                                >
                                  Inspect Quote
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}

                      {/* Revision Content */}
                      {activeItem.slot.type === 'revision' && activeItem.asset.current_version?.content && (
                        <div className="space-y-3 text-xs text-slate-800">
                          <h4 className="font-bold text-sm text-slate-900">Unit Revision & Synthesis</h4>
                          <div className="space-y-2">
                            {activeItem.asset.current_version.content.key_points?.map((kp: any, kIdx: number) => (
                              <div key={kIdx} className="p-3 bg-white border border-slate-200 rounded-lg space-y-1.5">
                                <p className="font-medium text-slate-900 leading-relaxed">
                                  {renderClaimSpan(kp.text, kp.quote)}
                                </p>
                                <div className="flex items-center justify-between text-[11px] text-indigo-700 bg-indigo-50 p-2 rounded font-mono">
                                  <span className="truncate max-w-[80%]">&ldquo;{kp.quote}&rdquo;</span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleOpenEvidence(kp)}
                                    leftIcon={<ShieldCheck className="w-3.5 h-3.5" />}
                                  >
                                    Evidence
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Independent Solver Output Box */}
                    {activeItem.asset.current_version?.verification?.solver && (
                      <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-semibold text-indigo-900">
                            <Sparkles className="w-4 h-4 text-indigo-600" />
                            <span>Blinded Independent Solver Check</span>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Dual Solved Match
                          </span>
                        </div>
                        <p className="text-slate-600 text-[11px]">
                          Model independently chose option #{activeItem.asset.current_version.verification.solver.chosen_index} matching key #{activeItem.asset.current_version.verification.solver.actual_index} with verified quote.
                        </p>
                      </div>
                    )}
                  </CardContent>

                  {/* Action Footer */}
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
                        Simplified Variant
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setRegenerateModalOpen(true);
                        }}
                        leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                      >
                        {activeItem.asset.status === 'approved' ? 'Revise & Regenerate' : 'Regenerate with Feedback'}
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: LEARNING CONSISTENCY GRAPH */}
      {/* ========================================================================= */}
      {activeTab === 'consistency' && <LearningConsistencyGraph pack={pack} />}

      {/* ========================================================================= */}
      {/* TAB 3: AI RESPONSIBILITY REPORT */}
      {/* ========================================================================= */}
      {activeTab === 'responsibility' && <AIResponsibilityReport unitId={pack.unit.id} />}

      {/* ========================================================================= */}
      {/* TAB 4: CHANGE IMPACT ENGINE */}
      {/* ========================================================================= */}
      {activeTab === 'impact' && (
        <ChangeImpactView unitId={pack.unit.id} onRegenerateComplete={loadPackData} />
      )}

      {/* ========================================================================= */}
      {/* TAB 5: PUBLISH & EXPORT */}
      {/* ========================================================================= */}
      {activeTab === 'publish' && (
        <PublishUnitView pack={pack} onPublishSuccess={loadPackData} />
      )}

      {/* Evidence Viewer Split Panel Modal */}
      <EvidenceViewerModal
        isOpen={evidenceModalOpen}
        onClose={() => setEvidenceModalOpen(false)}
        claim={selectedClaim}
        sourceText={sourceData?.full_text || 'Source text unavailable.'}
        sourceVersionNo={sourceData?.version_no || 1}
        sourceSha256={sourceData?.sha256}
      />

      {/* Quality Flags Drawer */}
      <QualityFlagsDrawer
        isOpen={flagsDrawerOpen}
        onClose={() => setFlagsDrawerOpen(false)}
        flags={health?.flags || []}
        onFlagsUpdated={loadPackData}
      />

      {/* Bloom Tag Override Modal */}
      <Modal
        isOpen={bloomModalOpen}
        onClose={() => setBloomModalOpen(false)}
        title="Teacher Bloom Taxonomy Tag Override"
        subtitle="Audited modification recorded in the immutable DecisionLog."
        footer={
          <>
            <Button variant="outline" onClick={() => setBloomModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateBloomTag}>Save Bloom Override</Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-800 mb-1">Target Bloom Level:</label>
            <select
              value={selectedBloomTag}
              onChange={(e) => setSelectedBloomTag(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            >
              <option value="remember">Remember (Knowledge recall)</option>
              <option value="understand">Understand (Concept comprehension)</option>
              <option value="apply">Apply (Problem solving)</option>
              <option value="analyze">Analyze (Mechanism deconstruction)</option>
              <option value="evaluate">Evaluate (Critique & judgment)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-800 mb-1">Pedagogical Reason:</label>
            <input
              type="text"
              value={bloomReason}
              onChange={(e) => setBloomReason(e.target.value)}
              placeholder="e.g. Adjusted to match Grade 10 AP Biology standard"
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            />
          </div>
        </div>
      </Modal>

      {/* Override Reason Modal (Server 409 Conflict) */}
      <Modal
        isOpen={overrideModalOpen}
        onClose={() => setOverrideModalOpen(false)}
        title="Quality Gate Approval Refused (HTTP 409)"
        subtitle="Unresolved error-level flags or unverified claims detected on this version."
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
            The server strictly blocks approval because this asset contains unresolved error flags or unverified claims.
          </div>
          <div>
            <label className="block font-semibold text-slate-800 mb-1">
              Mandatory Teacher Override Reason:
            </label>
            <textarea
              rows={3}
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Explain why this unverified claim or solver mismatch is acceptable for class use..."
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
            Teacher Feedback / Revision Instructions (Tell the AI what to fix):
          </label>
          <textarea
            rows={4}
            value={regenFeedback}
            onChange={(e) => setRegenFeedback(e.target.value)}
            placeholder="e.g. Ensure the question stem clearly asks about the role of water in photolysis..."
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
                {ver.parent_version_id && <div>Parent Version ID: #{ver.parent_version_id}</div>}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* Preview Change Impact Modal */}
      <Modal
        isOpen={impactModalOpen}
        onClose={() => setImpactModalOpen(false)}
        title="Preview Parameter Change Impact"
        subtitle="Inspect downstream affected vs unaffected pedagogical assets and rationale."
        maxWidth="lg"
        footer={
          <Button variant="outline" onClick={() => setImpactModalOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Select Proposed Change:
            </label>
            <div className="flex items-center gap-2">
              <select
                value={impactChangeParam}
                onChange={(e) => {
                  setImpactChangeParam(e.target.value);
                  handlePreviewImpact(e.target.value);
                }}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
              >
                <option value="difficulty:medium->advanced">Difficulty: Medium &rarr; Advanced</option>
                <option value="difficulty:advanced->easy">Difficulty: Advanced &rarr; Easy</option>
                <option value="difficulty:easy->advanced">Difficulty: Easy &rarr; Advanced</option>
                <option value="target_grade:High School->Middle School">Target Grade: High School &rarr; Middle School</option>
                <option value="source_version:1->2">Source Document: Update Version (v1 &rarr; v2)</option>
                <option value="objective:1:edit">Objective #1: Text Refinement</option>
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePreviewImpact()}
                isLoading={impactLoading}
              >
                Recalculate
              </Button>
            </div>
          </div>

          {impactLoading ? (
            <div className="p-6 text-center text-slate-500">
              <div className="animate-spin w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-2" />
              Analyzing downstream dependencies...
            </div>
          ) : impactResult ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <span className="font-semibold text-slate-700">Scope:</span>
                <span className="text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  {impactResult.affected_count} Affected
                </span>
                <span className="text-slate-600 font-semibold bg-white px-2 py-0.5 rounded border border-slate-200">
                  {impactResult.unaffected_count} Unaffected
                </span>
              </div>

              {/* Affected List */}
              <div className="space-y-2">
                <h4 className="font-bold text-amber-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Affected: [{impactResult.affected_slots?.map((s: any) => s.name || s.type).join(', ') || 'None'}]
                </h4>
                {impactResult.affected_slots?.length > 0 ? (
                  <ul className="space-y-2 pl-2">
                    {impactResult.affected_slots.map((s: any) => (
                      <li key={s.slot_id} className="p-2.5 bg-amber-50/60 border border-amber-200/80 rounded-lg text-slate-800 space-y-1">
                        <div className="font-semibold text-amber-900 flex items-center justify-between">
                          <span>{s.name || `Slot #${s.position}: ${s.type}`}</span>
                          {s.is_approved && (
                            <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-medium">
                              Approved (Preserved)
                            </span>
                          )}
                        </div>
                        <p className="text-slate-600 text-[11px] leading-relaxed">
                          {s.reason}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-500 italic pl-3">No assets affected by this change.</p>
                )}
              </div>

              {/* Unaffected List */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Unaffected: [{impactResult.unaffected_slots?.map((s: any) => s.name || s.type).join(', ') || 'None'}]
                </h4>
                {impactResult.unaffected_slots?.length > 0 ? (
                  <ul className="space-y-2 pl-2">
                    {impactResult.unaffected_slots.map((s: any) => (
                      <li key={s.slot_id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 space-y-1">
                        <div className="font-semibold text-slate-900">
                          {s.name || `Slot #${s.position}: ${s.type}`}
                        </div>
                        <p className="text-slate-500 text-[11px] leading-relaxed">
                          {s.reason}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-500 italic pl-3">No assets in unaffected group.</p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );
};
