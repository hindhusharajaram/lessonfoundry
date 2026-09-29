import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  AlertTriangle,
  X,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { api } from '../../services/api';
import { Unit } from '../../types';

const truncateWords = (str: string, count: number = 6) => {
  if (!str) return '';
  const words = str.trim().split(/\s+/);
  if (words.length <= count) return str;
  return words.slice(0, count).join(' ') + '...';
};

const getMasteryStatus = (accuracy: number) => {
  if (accuracy >= 75) {
    return { label: 'Mastered', color: 'emerald' };
  }
  if (accuracy >= 55) {
    return { label: 'Needs Review', color: 'amber' };
  }
  return { label: 'Difficult', color: 'rose' };
};

export const AnalyticsPage: React.FC = () => {
  const navigate = useNavigate();
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Reinforcement generation state
  const [isGeneratingReinforcement, setIsGeneratingReinforcement] = useState<boolean>(false);
  const [reinforcementSuccess, setReinforcementSuccess] = useState<string | null>(null);
  const [showGapDetails, setShowGapDetails] = useState<boolean>(false);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number | null>(null);

  const loadUnits = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.listUnits();
      const unitList = Array.isArray(data) ? data : (data as any)?.units || [];
      setUnits(unitList);
      if (unitList.length > 0) {
        setSelectedUnitId(unitList[0].id);
      } else {
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Failed to load units', err);
      setError(err.message || 'Failed to load units');
      setLoading(false);
    }
  };

  const loadAnalytics = async (unitId: number) => {
    try {
      setLoading(true);
      setError(null);
      setReinforcementSuccess(null);
      const data = await api.getUnitAnalytics(unitId);
      setAnalytics(data);
      // Auto-select first difficult question if one exists, otherwise default to first item
      if (data?.question_performance?.length > 0) {
        const firstWeakIdx = data.question_performance.findIndex((q: any) => q.accuracy < 55);
        setSelectedQuestionIndex(firstWeakIdx >= 0 ? firstWeakIdx : 0);
      } else {
        setSelectedQuestionIndex(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load unit analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUnits();
  }, []);

  useEffect(() => {
    if (selectedUnitId) {
      loadAnalytics(selectedUnitId);
    }
  }, [selectedUnitId]);

  const handleGenerateReinforcement = async () => {
    if (!analytics || !selectedUnitId) return;
    const weakObjId = analytics.gap_summary?.recommended_objective_id;
    if (!weakObjId) return;

    try {
      setIsGeneratingReinforcement(true);
      setReinforcementSuccess(null);
      const res = await api.generateReinforcement(selectedUnitId, {
        objective_id: weakObjId,
        count: 2,
      });
      setReinforcementSuccess(res.message);
      // Reload analytics
      loadAnalytics(selectedUnitId);
    } catch (err: any) {
      alert(err.message || 'Failed to generate reinforcement');
    } finally {
      setIsGeneratingReinforcement(false);
    }
  };

  const weakObj = analytics?.gap_summary?.weak_objectives?.[0];

  return (
    <div className="space-y-6 max-w-6xl mx-auto font-sans">
      {/* Top Header Card with Unit Selector */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">
              Student Performance & Class Analytics
            </h1>
          </div>

          {units.length > 0 && (
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-[var(--text-muted)]">Unit:</label>
              <select
                value={selectedUnitId || ''}
                onChange={(e) => setSelectedUnitId(parseInt(e.target.value, 10))}
                className="p-2 bg-[var(--bg-card-secondary)] border border-[var(--border-color)] rounded-lg text-xs font-medium text-[var(--text-primary)] focus:ring-1 focus:ring-indigo-500"
              >
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </Card>

      {/* Synthetic Demo Data Alert Badge (kept as-is) */}
      {analytics?.has_synthetic_data && (
        <div className="p-3 bg-[var(--bg-card)] border border-[var(--border-color)] border-l-4 border-l-indigo-500 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[var(--text-secondary)] shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
              Synthetic Demo Data
            </span>
            <span>
              Metrics include <strong className="text-[var(--text-primary)]">{analytics.synthetic_students_count} synthetic students</strong> and {analytics.real_students_count} active classroom submissions.
            </span>
          </div>
          <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold shrink-0">
            Class 10-A Biology
          </span>
        </div>
      )}

      {loading ? (
        <LoadingState message="Calculating objective mastery and learning diagnostics..." />
      ) : units.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
            No Learning Units Available Yet
          </h2>
          <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto mb-6">
            Create and publish a learning unit or generate assessments to start tracking student mastery diagnostics and class performance.
          </p>
          <Button onClick={() => navigate('/wizard')} variant="primary">
            Create Learning Unit
          </Button>
        </Card>
      ) : error || !analytics ? (
        <ErrorBanner
          message={error || 'No analytics data found'}
          onRetry={() => selectedUnitId && loadAnalytics(selectedUnitId)}
        />
      ) : (
        <>
          {/* Key Metric Overview Cards - Shortened captions with tooltips */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card
              className="p-5 cursor-help"
              title={`${analytics.total_attempts} total test attempts recorded`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  Students Tested
                </span>
                <Users className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="text-2xl font-black text-[var(--text-primary)] mt-2">
                {analytics.total_students}
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  Average Score
                </span>
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="text-2xl font-black text-[var(--text-primary)] mt-2">
                {analytics.average_score}%
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  Completion Rate
                </span>
                <CheckCircle2 className="w-5 h-5 text-purple-500" />
              </div>
              <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-2">
                {analytics.completion_rate}%
              </div>
            </Card>

            <Card
              className="p-5 cursor-help"
              title={`${analytics.gap_summary?.weak_objectives?.length || 0} weak objective(s) identified`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  Learning Gap
                </span>
                <AlertTriangle
                  className={`w-5 h-5 ${
                    analytics.potential_learning_gap_detected ? 'text-rose-500' : 'text-emerald-500'
                  }`}
                />
              </div>
              <div
                className={`text-xl font-bold mt-2 ${
                  analytics.potential_learning_gap_detected
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {analytics.potential_learning_gap_detected ? 'Gap Detected' : 'Mastery Met'}
              </div>
            </Card>
          </div>

          {/* Potential Learning Gap Alert Banner with Action */}
          {analytics.potential_learning_gap_detected && (
            <Card className="p-5 sm:p-6 bg-[var(--bg-card)] border border-[var(--border-color)] border-l-4 border-l-rose-500 rounded-2xl shadow-sm transition-all">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-600 dark:text-rose-400 shrink-0 mt-0.5">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-extrabold text-base text-[var(--text-primary)]">
                        Learning Gap Detected
                      </h3>
                      <span className="text-2xl font-black text-rose-600 dark:text-rose-400">
                        {weakObj?.accuracy || 0}%
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
                      <span className="font-medium truncate max-w-sm sm:max-w-md" title={weakObj?.text}>
                        Objective: &ldquo;{truncateWords(weakObj?.text || 'Target Objective', 6)}&rdquo;
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowGapDetails(!showGapDetails)}
                        className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer ml-1"
                      >
                        {showGapDetails ? 'Hide' : 'Read more'}
                      </button>
                    </div>

                    {showGapDetails && (
                      <div className="mt-2.5 p-3 rounded-xl bg-[var(--bg-card-secondary)] border border-[var(--border-color)] text-xs text-[var(--text-secondary)] space-y-1">
                        <p className="font-semibold text-[var(--text-primary)]">
                          {weakObj?.text}
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          Diagnostic analysis indicates student comprehension fell below 70% on this objective. Generating reinforcement practice will provision targeted remediation slots.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  variant="danger"
                  isLoading={isGeneratingReinforcement}
                  onClick={handleGenerateReinforcement}
                  leftIcon={<Sparkles className="w-4 h-4" />}
                  className="shrink-0 shadow-sm"
                >
                  Generate Reinforcement Practice
                </Button>
              </div>

              {reinforcementSuccess && (
                <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>{reinforcementSuccess}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/units/${selectedUnitId}`)}
                  >
                    Inspect in Unit Pack
                  </Button>
                </div>
              )}
            </Card>
          )}

          {/* Performance By Objective - Clean horizontal bars */}
          <Card>
            <CardHeader
              title="Formative Accuracy by Learning Objective"
            />
            <CardContent className="space-y-3.5 text-xs">
              {analytics.objective_performance?.map((obj: any, idx: number) => {
                const acc = obj.accuracy;
                const barColor =
                  acc < 60
                    ? 'bg-rose-500'
                    : acc < 75
                    ? 'bg-amber-500'
                    : 'bg-emerald-500';

                return (
                  <div
                    key={obj.objective_id || idx}
                    className="p-3.5 rounded-2xl bg-[var(--bg-card-secondary)] border border-[var(--border-color)] flex items-center justify-between gap-4 transition-all duration-150 hover:bg-[var(--bg-card)]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 max-w-[200px] sm:max-w-xs shrink-0">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-200/70 dark:bg-slate-700/60 text-[var(--text-secondary)] shrink-0">
                        Obj #{idx + 1}
                      </span>
                      <span
                        className="text-[var(--text-primary)] font-semibold text-xs truncate cursor-help"
                        title={obj.text}
                      >
                        {truncateWords(obj.text, 5)}
                      </span>
                    </div>

                    {/* Clean Horizontal Bar */}
                    <div className="w-full bg-slate-200/80 dark:bg-slate-700/50 h-2.5 rounded-full overflow-hidden flex-1">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${barColor}`}
                        style={{ width: `${Math.min(100, Math.max(0, acc))}%` }}
                      />
                    </div>

                    {/* Percentage at end */}
                    <span className="font-extrabold text-sm text-[var(--text-primary)] w-12 text-right shrink-0">
                      {acc}%
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Per-Question Item Discrimination & Correctness - Compact Heatmap Grid */}
          <Card>
            <CardHeader
              title={
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
                  <div>
                    <h3 className="font-semibold text-[var(--text-primary)] text-base">
                      Per-Question Item Discrimination
                    </h3>
                  </div>

                  {/* Single Clean Legend */}
                  <div className="flex items-center gap-4 text-[11px] text-[var(--text-muted)] font-medium">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                      <span>Mastered (≥75%)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                      <span>Needs Review (55–74%)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                      <span>Difficult (&lt;55%)</span>
                    </div>
                  </div>
                </div>
              }
            />
            <CardContent className="space-y-4">
              {/* Heatmap Grid of Tiles */}
              <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2.5 sm:gap-3">
                {analytics.question_performance?.map((q: any, idx: number) => {
                  const qStatus = getMasteryStatus(q.accuracy);
                  const isSelected = selectedQuestionIndex === idx;

                  return (
                    <button
                      key={q.slot_id || idx}
                      type="button"
                      onClick={() =>
                        setSelectedQuestionIndex(isSelected ? null : idx)
                      }
                      title={`Q${idx + 1} (${q.accuracy}% • ${qStatus.label}): ${q.question}`}
                      className={`relative flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-200 cursor-pointer text-center group ${
                        q.accuracy >= 75
                          ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300 hover:border-emerald-500/50'
                          : q.accuracy >= 55
                          ? 'bg-amber-500/10 border-amber-500/25 text-amber-700 dark:text-amber-300 hover:border-amber-500/50'
                          : 'bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-300 hover:border-rose-500/50'
                      } ${
                        isSelected
                          ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900 shadow-md scale-105'
                          : 'hover:-translate-y-0.5 hover:shadow-xs'
                      }`}
                    >
                      <span className="text-xs font-black tracking-tight">
                        Q{idx + 1}
                      </span>
                      <span className="text-[11px] font-bold mt-0.5">
                        {q.accuracy}%
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Selected Question Detail Card */}
              {selectedQuestionIndex !== null &&
                analytics.question_performance?.[selectedQuestionIndex] && (() => {
                  const selQ = analytics.question_performance[selectedQuestionIndex];
                  const selStatus = getMasteryStatus(selQ.accuracy);
                  const borderLeftClass =
                    selQ.accuracy >= 75
                      ? 'border-l-emerald-500'
                      : selQ.accuracy >= 55
                      ? 'border-l-amber-500'
                      : 'border-l-rose-500';

                  return (
                    <div
                      className={`mt-4 p-4.5 rounded-2xl bg-[var(--bg-card-secondary)] border border-[var(--border-color)] border-l-4 ${borderLeftClass} shadow-sm transition-all animate-in`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider bg-slate-200/70 dark:bg-slate-700/60 text-[var(--text-primary)]">
                              Question #{selectedQuestionIndex + 1}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                selQ.accuracy >= 75
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                                  : selQ.accuracy >= 55
                                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                                  : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/20'
                              }`}
                            >
                              {selStatus.label} ({selQ.accuracy}%)
                            </span>
                            <span className="text-[11px] text-[var(--text-muted)] font-medium capitalize">
                              {selQ.type.replace(/_/g, ' ')} • Bloom: {selQ.bloom || 'Understand'}
                            </span>
                          </div>

                          <p className="text-sm font-semibold text-[var(--text-primary)] leading-relaxed">
                            {selQ.question}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedQuestionIndex(null)}
                          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                          aria-label="Close question detail"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })()}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default AnalyticsPage;
