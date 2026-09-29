import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlusCircle,
  BookOpen,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  FileCheck,
  RotateCcw,
  Activity,
  Layers,
  ChevronRight,
  Send,
  ShieldAlert,
  Search,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { LoadingState } from '../../components/common/LoadingState';
import { DashboardBannerIllustration } from '../../components/DashboardBannerIllustration';
import { useRole } from '../../context/RoleContext';
import { useSearch } from '../../context/SearchContext';
import { api } from '../../services/api';
import { Unit, PackHealth } from '../../types';

function useCountUp(end: number, duration: number = 600): number {
  const [count, setCount] = useState(() => (end > 0 ? 0 : end));

  useEffect(() => {
    let animationFrameId: number;
    let startTime: number | null = null;

    if (!end || end <= 0) {
      return;
    }

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - (1 - progress) * (1 - progress);
      setCount(Math.round(eased * end));

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      }
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [end, duration]);

  return end <= 0 ? 0 : count;
}

function formatRelativeTime(isoString: string): string {
  if (!isoString) return 'Recently';
  try {
    const time = new Date(isoString).getTime();
    const diffSec = Math.floor((Date.now() - time) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

interface ActivityItem {
  id: number;
  action: string;
  actor: string;
  unitTitle: string;
  createdAt: string;
}

export const TeacherDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { teacherName } = useRole();
  const { searchQuery, setSearchQuery } = useSearch();

  const [units, setUnits] = useState<Unit[]>([]);
  const [healthMap, setHealthMap] = useState<Record<number, PackHealth>>({});
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [showAllActivities, setShowAllActivities] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);


  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const unitsData = await api.listUnits();
      const unitList: Unit[] = Array.isArray(unitsData)
        ? unitsData
        : (unitsData as any)?.units || [];
      setUnits(unitList);

      // Fetch health & audit logs for live units concurrently
      if (unitList.length > 0) {
        const healthResults = await Promise.allSettled(
          unitList.map((u) => api.getUnitHealth(u.id))
        );
        const auditResults = await Promise.allSettled(
          unitList.map((u) => api.getUnitAudit(u.id))
        );

        const newHealthMap: Record<number, PackHealth> = {};
        healthResults.forEach((res, idx) => {
          if (res.status === 'fulfilled' && res.value) {
            newHealthMap[unitList[idx].id] = res.value;
          }
        });
        setHealthMap(newHealthMap);

        // Aggregate recent decision logs
        const collectedActivities: ActivityItem[] = [];
        auditResults.forEach((res, idx) => {
          if (res.status === 'fulfilled' && res.value) {
            const audit = res.value;
            const unitTitle = unitList[idx].title;
            const logs = audit.decision_logs || [];
            logs.forEach((log: any) => {
              collectedActivities.push({
                id: log.id,
                action: log.action || 'Updated asset',
                actor: log.actor || 'Teacher',
                unitTitle,
                createdAt: log.created_at || new Date().toISOString(),
              });
            });
          }
        });

        // Sort descending by creation date and take last 6
        collectedActivities.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setActivities(collectedActivities.slice(0, 6));
      }
    } catch (err) {
      console.error('Failed to load dashboard data', err);
      setUnits([]);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  // Real aggregate calculations
  const totalUnits = units.length;
  const healthList = Object.values(healthMap);
  const totalClaims = healthList.reduce((acc, h) => acc + (h.total_claims || 0), 0);
  const verifiedClaims = healthList.reduce((acc, h) => acc + (h.verified_claims || 0), 0);

  const avgGroundingRatio =
    totalClaims > 0
      ? Math.round((verifiedClaims / totalClaims) * 100)
      : healthList.length > 0
      ? 100
      : 100;

  // Animated counters
  const animatedUnits = useCountUp(totalUnits, 600);
  const animatedGrounding = useCountUp(avgGroundingRatio, 600);
  const animatedClaims = useCountUp(verifiedClaims, 700);

  // Filter units using global search query
  const filteredUnits = units.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.title.toLowerCase().includes(q) ||
      (u.target_grade && u.target_grade.toLowerCase().includes(q)) ||
      (u.difficulty && u.difficulty.toLowerCase().includes(q))
    );
  });

  // Check if all recent activities are identical to collapse them
  const allSameActivity =
    activities.length > 1 &&
    activities.every(
      (a) => a.action === activities[0].action && a.unitTitle === activities[0].unitTitle
    );

  // Helper for action icon
  const getActionIcon = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('approve')) return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
    if (act.includes('regen')) return <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />;
    if (act.includes('publish')) return <Send className="w-3.5 h-3.5 text-purple-600" />;
    if (act.includes('override') || act.includes('flag'))
      return <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />;
    return <Activity className="w-3.5 h-3.5 text-slate-500" />;
  };

  // Helper for human-readable action text
  const formatActionText = (action: string, unitTitle: string) => {
    const act = action.toLowerCase();
    if (act.includes('approve')) return `Approved asset in "${unitTitle}"`;
    if (act.includes('regen')) return `Regenerated asset in "${unitTitle}"`;
    if (act.includes('publish')) return `Published unit "${unitTitle}"`;
    if (act.includes('override')) return `Overrode tag in "${unitTitle}"`;
    return `${action} in "${unitTitle}"`;
  };

  if (loading) {
    return (
      <div className="py-20">
        <LoadingState message="Connecting to LessonFoundry engine..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* ================= GREETING HEADER ================= */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
            Hey {teacherName || 'Teacher'} 👋
          </h1>
        </div>
      </div>

      {/* ================= MAIN DASHBOARD GRID ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT / CENTER COLUMN (8 of 12 columns) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* 1. LARGE HERO BANNER (Indigo Gradient Card with Line-Art Illustration) */}
          <div className="relative rounded-3xl bg-gradient-to-r from-[#4F46E5] via-[#4338CA] to-[#3730A3] p-6 sm:p-8 text-white shadow-xl shadow-indigo-950/20 overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-6 border border-indigo-400/20">
            {/* Subtle background glow */}
            <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-white/10 blur-3xl pointer-events-none" />

            {/* Left Banner Text: Pill badge + Headline only per minimization pass */}
            <div className="space-y-3.5 z-10 max-w-md">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-[11px] font-semibold tracking-wide">
                <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
                <span>Zero Hallucination Guaranteed</span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-snug">
                {totalUnits > 0
                  ? `Your curriculum is ${animatedGrounding}% evidence-locked across ${animatedUnits} unit${
                      totalUnits > 1 ? 's' : ''
                    }.`
                  : 'Evidence-locked curriculum with 100% source verifiability.'}
              </h2>
            </div>

            {/* Right Banner Illustration */}
            <div className="z-10 w-full sm:w-64 max-w-[260px] shrink-0">
              <DashboardBannerIllustration className="w-full h-auto drop-shadow-xl" />
            </div>
          </div>

          {/* 2. "YOUR LEARNING UNITS" CARD (Clean Table/List replacing Submitted Tests) */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-sm transition-all duration-200 hover:shadow-md">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">Your Learning Units</h2>
                <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {totalUnits}
                </span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/create')}
                leftIcon={<PlusCircle className="w-3.5 h-3.5" />}
                className="text-xs rounded-xl"
              >
                New Unit
              </Button>
            </div>

            {units.length === 0 ? (
              /* Intentional Empty State with Line-Art Aesthetic */
              <div className="text-center py-10 px-4">
                <div className="w-48 mx-auto mb-4 opacity-80">
                  <DashboardBannerIllustration className="w-full h-auto" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">No learning units yet</h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1 mb-5">
                  Upload a textbook chapter or syllabus to generate your first evidence-locked pack.
                </p>
                <Button
                  size="sm"
                  onClick={() => navigate('/create')}
                  leftIcon={<PlusCircle className="w-4 h-4" />}
                  className="rounded-xl shadow-md shadow-indigo-600/20"
                >
                  Create First Unit
                </Button>
              </div>
            ) : filteredUnits.length === 0 ? (
              /* Search Empty State */
              <div className="text-center py-10 px-4">
                <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-slate-800">
                  No units matching &ldquo;{searchQuery}&rdquo;
                </h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1 mb-4">
                  Check the spelling or try searching for another curriculum topic.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSearchQuery('')}
                  className="rounded-xl text-xs"
                >
                  Clear search
                </Button>
              </div>
            ) : (
              /* Units Table */
              <div className="divide-y divide-slate-100">
                {filteredUnits.map((unit) => (
                  <div
                    key={unit.id}
                    onClick={() => navigate(`/units/${unit.id}`)}
                    className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4 group cursor-pointer hover:bg-slate-50/80 -mx-4 px-4 rounded-2xl transition-all duration-150"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100/80 text-[#4F46E5] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-150">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">
                          {unit.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] font-medium text-slate-400 capitalize">
                            {unit.target_grade || 'All Grades'} • {unit.difficulty || 'Medium'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. "RECENT ACTIVITY" PANEL (Replaces Groups with real DecisionLog data) */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-sm transition-all duration-200 hover:shadow-md">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">Recent Activity</h2>
                <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  Audit Trail
                </span>
              </div>
              <span className="text-xs text-slate-400">Live DecisionLog</span>
            </div>

            {activities.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--text-muted)]">
                No recent governance actions recorded yet.
              </div>
            ) : allSameActivity && !showAllActivities ? (
              /* Collapsed Repeated Activity Row */
              <div className="p-3.5 rounded-2xl bg-[var(--bg-card-secondary)] border border-[var(--border-color)] flex items-center justify-between text-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xs flex items-center justify-center shrink-0">
                    {getActionIcon(activities[0].action)}
                  </div>
                  <span className="font-semibold text-[var(--text-primary)] truncate">
                    {activities.length} assets approved in &ldquo;{activities[0].unitTitle}&rdquo; &mdash;{' '}
                    <span className="font-normal text-[var(--text-muted)]">
                      {formatRelativeTime(activities[0].createdAt)}
                    </span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAllActivities(true)}
                  className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 transition-colors shrink-0 ml-3 cursor-pointer"
                >
                  Show all ({activities.length})
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {allSameActivity && (
                  <div className="flex justify-end pb-1">
                    <button
                      type="button"
                      onClick={() => setShowAllActivities(false)}
                      className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] font-medium underline cursor-pointer"
                    >
                      Collapse group
                    </button>
                  </div>
                )}
                {activities.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-[var(--bg-card-secondary)] border border-[var(--border-color)] text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xs flex items-center justify-center shrink-0">
                        {getActionIcon(item.action)}
                      </div>
                      <span className="font-medium text-[var(--text-primary)] truncate">
                        {formatActionText(item.action, item.unitTitle)}
                      </span>
                    </div>
                    <span className="text-[11px] text-[var(--text-muted)] font-medium shrink-0 ml-3">
                      {formatRelativeTime(item.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* RIGHT SIDEBAR COLUMN (4 of 12 columns) */}
        <div className="lg:col-span-4 space-y-6">

          {/* 1. TEACHER PROFILE CARD */}
          <div className="bg-[var(--bg-card)] rounded-3xl p-6 border border-[var(--border-color)] shadow-sm flex items-center gap-4 transition-all duration-200 hover:shadow-md">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] flex items-center justify-center text-white font-bold text-lg shadow-md shadow-indigo-600/20 shrink-0">
              {teacherName ? teacherName.slice(0, 2).toUpperCase() : 'TC'}
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="font-extrabold text-sm text-[var(--text-primary)] truncate">
                {teacherName || 'Monica Howard'}
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 font-medium">Teacher</p>
            </div>
          </div>

          {/* 2. COMPACT "SYSTEM STATUS" CARD */}
          <div className="bg-[var(--bg-card)] rounded-3xl p-6 border border-[var(--border-color)] shadow-sm space-y-4 transition-all duration-200 hover:shadow-md">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                System Status
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Evidence Verifier */}
              <div className="p-3.5 rounded-2xl bg-[var(--bg-card-secondary)] border border-[var(--border-color)]">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mb-2">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="text-xl font-black text-[var(--text-primary)]">
                  {animatedGrounding}%
                </div>
                <div className="text-[11px] text-[var(--text-muted)] font-medium">Evidence Verifier</div>
              </div>

              {/* Dual Solver */}
              <div className="p-3.5 rounded-2xl bg-[var(--bg-card-secondary)] border border-[var(--border-color)]">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mb-2">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="text-xl font-black text-[var(--text-primary)]">Active</div>
                <div className="text-[11px] text-[var(--text-muted)] font-medium">Dual Solver</div>
              </div>

              {/* Verified Claims */}
              <div className="p-3.5 rounded-2xl bg-[var(--bg-card-secondary)] border border-[var(--border-color)]">
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center mb-2">
                  <FileCheck className="w-4 h-4" />
                </div>
                <div className="text-xl font-black text-[var(--text-primary)]">
                  {animatedClaims}
                </div>
                <div className="text-[11px] text-[var(--text-muted)] font-medium">Anchored Claims</div>
              </div>

              {/* Active Units */}
              <div className="p-3.5 rounded-2xl bg-[var(--bg-card-secondary)] border border-[var(--border-color)]">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mb-2">
                  <Layers className="w-4 h-4" />
                </div>
                <div className="text-xl font-black text-[var(--text-primary)]">
                  {animatedUnits}
                </div>
                <div className="text-[11px] text-[var(--text-muted)] font-medium">Active Units</div>
              </div>
            </div>
          </div>

          {/* 3. "CREATE NEW UNIT" CTA CARD */}
          <div className="rounded-3xl bg-gradient-to-br from-[#111827] via-[#1E293B] to-[#0F172A] dark:from-[#0E1526] dark:via-[#162238] dark:to-[#0B101E] p-6 text-white shadow-xl flex flex-col justify-between border border-[var(--border-color)] transition-all duration-200 hover:-translate-y-0.5">
            <div className="w-10 h-10 rounded-2xl bg-[#4F46E5]/30 border border-[#4F46E5]/40 flex items-center justify-center text-indigo-300 mb-4">
              <PlusCircle className="w-5 h-5" />
            </div>

            <div>
              <h3 className="font-extrabold text-sm text-white">Create Learning Unit</h3>
            </div>

            <Button
              onClick={() => navigate('/create')}
              className="mt-5 w-full bg-[#4F46E5] hover:bg-[#4338CA] active:scale-[0.99] rounded-2xl text-xs font-semibold py-3 shadow-lg shadow-indigo-600/30"
            >
              Create New Unit
            </Button>
          </div>

        </div>

      </div>
    </div>
  );
};
export default TeacherDashboardPage;
