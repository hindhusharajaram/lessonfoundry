import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Users,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  BookOpen,
  Info,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { Card, CardHeader, CardContent, CardFooter } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { ProgressBar, ProgressRing } from '../../components/common/ProgressBar';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { api } from '../../services/api';
import { Unit } from '../../types';

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

  useEffect(() => {
    loadUnits();
  }, []);

  const loadUnits = async () => {
    try {
      const data = await api.listUnits();
      setUnits(data);
      if (data.length > 0) {
        setSelectedUnitId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load units', err);
    }
  };

  useEffect(() => {
    if (selectedUnitId) {
      loadAnalytics(selectedUnitId);
    }
  }, [selectedUnitId]);

  const loadAnalytics = async (unitId: number) => {
    try {
      setLoading(true);
      setError(null);
      setReinforcementSuccess(null);
      const data = await api.getUnitAnalytics(unitId);
      setAnalytics(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load unit analytics');
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in">
      {/* Top Header Card with Unit Selector */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Student Performance & Class Analytics</h1>
            <p className="text-xs text-slate-500 mt-1">
              Real-time formative assessment diagnostics, objective mastery, and AI gap detection.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-slate-600">Unit:</label>
            <select
              value={selectedUnitId || ''}
              onChange={(e) => setSelectedUnitId(parseInt(e.target.value))}
              className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-indigo-500"
            >
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Synthetic Demo Data Alert Badge */}
      {analytics?.has_synthetic_data && (
        <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl flex items-center justify-between text-xs text-indigo-950">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-200 text-indigo-900">
              Synthetic Demo Data
            </span>
            <span>
              Metrics include <strong>{analytics.synthetic_students_count} synthetic students</strong> and {analytics.real_students_count} active classroom submissions.
            </span>
          </div>
          <span className="text-[11px] text-indigo-700 font-medium">Class 10-A Biology</span>
        </div>
      )}

      {loading ? (
        <LoadingState message="Calculating objective mastery and learning diagnostics..." />
      ) : error || !analytics ? (
        <ErrorBanner message={error || 'No analytics data found'} onRetry={() => selectedUnitId && loadAnalytics(selectedUnitId)} />
      ) : (
        <>
          {/* Key Metric Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Students Tested
                </span>
                <Users className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2">{analytics.total_students}</div>
              <div className="text-[11px] text-slate-400 mt-1">{analytics.total_attempts} Total attempts</div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Average Class Score
                </span>
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2">{analytics.average_score}%</div>
              <div className="text-[11px] text-emerald-600 mt-1 font-medium">Across all quiz items</div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Completion Rate
                </span>
                <CheckCircle2 className="w-5 h-5 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-purple-600 mt-2">{analytics.completion_rate}%</div>
              <div className="text-[11px] text-slate-400 mt-1">Submitted formative checks</div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Learning Gap Status
                </span>
                <AlertTriangle className={`w-5 h-5 ${analytics.potential_learning_gap_detected ? 'text-rose-600' : 'text-emerald-600'}`} />
              </div>
              <div className={`text-xl font-bold mt-2 ${analytics.potential_learning_gap_detected ? 'text-rose-600' : 'text-emerald-600'}`}>
                {analytics.potential_learning_gap_detected ? 'Gap Detected' : 'Mastery Met'}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {analytics.gap_summary?.weak_objectives?.length || 0} Weak objective(s)
              </div>
            </Card>
          </div>

          {/* Potential Learning Gap Alert Banner with Action */}
          {analytics.potential_learning_gap_detected && (
            <Card className="p-6 bg-rose-50 border-rose-200 text-rose-950 shadow-sm">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-rose-100 rounded-xl text-rose-600 shrink-0">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-rose-900">Potential Learning Gap Detected</h3>
                    <p className="text-xs text-rose-800 mt-0.5 max-w-xl">
                      Students scored below 70% on objective: &ldquo;{analytics.gap_summary?.weak_objectives?.[0]?.text || 'Objective'}&rdquo; (
                      {analytics.gap_summary?.weak_objectives?.[0]?.accuracy}% accuracy).
                    </p>
                  </div>
                </div>

                <Button
                  variant="danger"
                  isLoading={isGeneratingReinforcement}
                  onClick={handleGenerateReinforcement}
                  leftIcon={<Sparkles className="w-4 h-4" />}
                  className="shrink-0"
                >
                  Generate Reinforcement Practice
                </Button>
              </div>

              {reinforcementSuccess && (
                <div className="mt-4 p-3 bg-white border border-emerald-300 rounded-xl text-emerald-950 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
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

          {/* Performance By Objective */}
          <Card>
            <CardHeader
              title="Formative Accuracy by Learning Objective"
              subtitle="Aggregated student accuracy across all objective-mapped questions."
            />
            <CardContent className="space-y-5 text-xs">
              {analytics.objective_performance?.map((obj: any, idx: number) => {
                const isGap = obj.is_gap;
                return (
                  <div key={obj.objective_id || idx} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">
                          Objective #{idx + 1}:
                        </span>
                        <span className="text-slate-700 font-medium line-clamp-1 max-w-lg">
                          {obj.text}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isGap && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                            Learning Gap
                          </span>
                        )}
                        <span
                          className={`font-bold text-sm ${
                            isGap ? 'text-rose-600' : 'text-emerald-700'
                          }`}
                        >
                          {obj.accuracy}%
                        </span>
                      </div>
                    </div>

                    <ProgressBar
                      progress={obj.accuracy}
                      color={isGap ? 'rose' : 'success'}
                      size="md"
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Per-Question Item Correctness Breakdown */}
          <Card>
            <CardHeader
              title="Per-Question Item Discrimination & Correctness"
              subtitle="Items with correctness under 55% are flagged for review."
            />
            <CardContent className="space-y-3 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {analytics.question_performance?.map((q: any, idx: number) => {
                  const isWeak = q.is_gap;
                  return (
                    <div
                      key={q.slot_id || idx}
                      className={`p-3.5 rounded-xl border flex items-center justify-between ${
                        isWeak
                          ? 'bg-rose-50/60 border-rose-200 text-rose-950'
                          : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="space-y-1 max-w-[70%]">
                        <div className="font-semibold line-clamp-1">
                          Q{idx + 1}. {q.question}
                        </div>
                        <div className="text-[10px] text-slate-400 capitalize">
                          {q.type.replace(/_/g, ' ')} • Bloom: {q.bloom || 'Understand'}
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`text-sm font-bold block ${
                            isWeak ? 'text-rose-600' : 'text-slate-800'
                          }`}
                        >
                          {q.accuracy}%
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {isWeak ? 'Difficult' : 'Mastered'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
