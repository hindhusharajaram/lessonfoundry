import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  Percent,
  Search,
  CheckCircle2,
  XCircle,
  PlusCircle,
  RefreshCw,
  Calendar,
  ChevronDown,
  Info,
  BookOpen,
  Award,
} from 'lucide-react';
import { api } from '../../services/api';
import { ClassSessionSummary, SessionAttendanceReport, AttendanceRecord } from '../../types';
import { Button } from '../common/Button';
import { LoadingState } from '../common/LoadingState';

function formatAttendedAt(isoString: string | null): string {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '—';
  }
}

export const AttendanceTracker: React.FC<{
  embedded?: boolean;
}> = ({ embedded = false }) => {
  const [sessions, setSessions] = useState<ClassSessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [report, setReport] = useState<SessionAttendanceReport | null>(null);
  const [loadingSessions, setLoadingSessions] = useState<boolean>(true);
  const [loadingReport, setLoadingReport] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'absent'>('all');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // New session modal state
  const [showNewSessionModal, setShowNewSessionModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newClassLabel, setNewClassLabel] = useState<string>('Grade 9');
  const [creatingSession, setCreatingSession] = useState<boolean>(false);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoadingSessions(true);
      const list = await api.getTeacherSessions();
      setSessions(list);
      if (list.length > 0) {
        setSelectedSessionId(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load teacher sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  };

  // Load report when selected session changes
  useEffect(() => {
    if (selectedSessionId) {
      loadAttendance(selectedSessionId);
    }
  }, [selectedSessionId]);

  const loadAttendance = async (sessionId: number) => {
    try {
      setLoadingReport(true);
      const data = await api.getSessionAttendance(sessionId);
      setReport(data);
    } catch (err) {
      console.error('Failed to fetch attendance report:', err);
    } finally {
      setLoadingReport(false);
    }
  };

  // Toggle single student status
  const handleToggleStatus = async (record: AttendanceRecord) => {
    if (!selectedSessionId || isUpdating) return;
    const newStatus = record.status === 'present' ? 'absent' : 'present';

    // Optimistic UI update
    setReport((prev) => {
      if (!prev) return prev;
      const updatedRecords = prev.records.map((r) =>
        r.student_id === record.student_id
          ? {
              ...r,
              status: newStatus as 'present' | 'absent',
              attended_at: newStatus === 'present' ? new Date().toISOString() : null,
            }
          : r
      );
      const presentCount = updatedRecords.filter((r) => r.status === 'present').length;
      const absentCount = updatedRecords.length - presentCount;
      const pct = updatedRecords.length > 0 ? Math.round((presentCount / updatedRecords.length) * 1000) / 10 : 0;
      const presentNames = updatedRecords.filter((r) => r.status === 'present').map((r) => r.name);
      const absentNames = updatedRecords.filter((r) => r.status === 'absent').map((r) => r.name);

      return {
        ...prev,
        records: updatedRecords,
        present_count: presentCount,
        absent_count: absentCount,
        attendance_percentage: pct,
        present_students: presentNames,
        absent_students: absentNames,
      };
    });

    try {
      setIsUpdating(true);
      await api.markAttendance(selectedSessionId, record.student_id, newStatus);
    } catch (err) {
      console.error('Failed to update attendance:', err);
      // Revert from backend on error
      if (selectedSessionId) {
        await loadAttendance(selectedSessionId);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  // Bulk update all students
  const handleBulkUpdate = async (targetStatus: 'present' | 'absent') => {
    if (!selectedSessionId || !report || isUpdating) return;

    const payload = report.records.map((r) => ({
      student_id: r.student_id,
      status: targetStatus,
    }));

    // Optimistic update
    setReport((prev) => {
      if (!prev) return prev;
      const updatedRecords = prev.records.map((r) => ({
        ...r,
        status: targetStatus,
        attended_at: targetStatus === 'present' ? new Date().toISOString() : null,
      }));
      const presentCount = targetStatus === 'present' ? updatedRecords.length : 0;
      const absentCount = targetStatus === 'absent' ? updatedRecords.length : 0;
      const pct = targetStatus === 'present' ? 100.0 : 0.0;

      return {
        ...prev,
        records: updatedRecords,
        present_count: presentCount,
        absent_count: absentCount,
        attendance_percentage: pct,
        present_students: targetStatus === 'present' ? updatedRecords.map((r) => r.name) : [],
        absent_students: targetStatus === 'absent' ? updatedRecords.map((r) => r.name) : [],
      };
    });

    try {
      setIsUpdating(true);
      await api.markAttendanceBulk(selectedSessionId, payload);
    } catch (err) {
      console.error('Failed bulk attendance update:', err);
      if (selectedSessionId) {
        await loadAttendance(selectedSessionId);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  // Create new session
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      setCreatingSession(true);
      const created = await api.createClassSession({
        title: newTitle.trim(),
        class_label: newClassLabel.trim() || undefined,
      });
      setSessions((prev) => [created, ...prev]);
      setSelectedSessionId(created.id);
      setShowNewSessionModal(false);
      setNewTitle('');
    } catch (err) {
      console.error('Failed to create session:', err);
    } finally {
      setCreatingSession(false);
    }
  };

  // Filtered records
  const filteredRecords = useMemo(() => {
    if (!report?.records) return [];

    return report.records.filter((rec) => {
      // Status filter
      if (statusFilter !== 'all' && rec.status !== statusFilter) {
        return false;
      }
      // Search filter (name or email)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = rec.name.toLowerCase().includes(query);
        const matchesEmail = (rec.email || '').toLowerCase().includes(query);
        return matchesName || matchesEmail;
      }
      return true;
    });
  }, [report, statusFilter, searchQuery]);

  if (loadingSessions) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm flex items-center justify-center min-h-[300px]">
        <LoadingState message="Loading class attendance records..." />
      </div>
    );
  }

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-sm transition-all duration-200 hover:shadow-md space-y-6">
      {/* Top Header & Session Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100/80 text-[#4F46E5] flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Attendance</h2>
              {selectedSession?.class_label && (
                <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full">
                  {selectedSession.class_label}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Live classroom attendance &amp; verification roster
            </p>
          </div>
        </div>

        {/* Session Dropdown & Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {sessions.length > 0 && (
            <div className="relative">
              <select
                id="session-select"
                aria-label="Select class session"
                value={selectedSessionId || ''}
                onChange={(e) => setSelectedSessionId(Number(e.target.value))}
                className="appearance-none text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-700 py-2 pl-3 pr-8 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} {s.class_label ? `(${s.class_label})` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => selectedSessionId && loadAttendance(selectedSessionId)}
            title="Refresh Attendance"
            aria-label="Refresh attendance data"
            className="rounded-xl px-2.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingReport ? 'animate-spin' : ''}`} />
          </Button>

          <Button
            size="sm"
            onClick={() => setShowNewSessionModal(true)}
            leftIcon={<PlusCircle className="w-3.5 h-3.5" />}
            className="rounded-xl text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            New Session
          </Button>
        </div>
      </div>

      {/* REAL-TIME EMPTY STATE BANNER */}
      {report?.empty_state && report?.empty_message && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
            <Info className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-xs">{report.empty_message}</div>
            <p className="text-[11px] text-amber-700/80 mt-0.5">
              Attendance records reflect real-time student interactions saved in the database.
            </p>
          </div>
        </div>
      )}

      {/* SUMMARY CARDS (Top summary exactly matching requested metrics) */}
      {report && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* 1. Present Summary Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                Students Present
              </span>
              <div className="text-2xl font-black text-slate-900 tracking-tight">
                {report.present_count} / {report.total_students} Present
              </div>
              <p className="text-[11px] text-emerald-600 font-medium">
                {report.present_count} attended out of {report.total_students} enrolled
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 flex items-center justify-center shrink-0">
              <UserCheck className="w-6 h-6" />
            </div>
          </div>

          {/* 2. Attendance Percentage Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent border border-indigo-500/20 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">
                Attendance Rate
              </span>
              <div className="text-2xl font-black text-indigo-900 tracking-tight">
                {report.attendance_percentage}% Attendance
              </div>
              <p className="text-[11px] text-indigo-600 font-medium">
                Verified classroom engagement rate
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-600 flex items-center justify-center shrink-0">
              <Percent className="w-6 h-6" />
            </div>
          </div>

          {/* 3. Absent Summary Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-transparent border border-rose-500/20 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">
                Absent Students
              </span>
              <div className="text-2xl font-black text-slate-900 tracking-tight">
                {report.absent_count} Absent
              </div>
              <p className="text-[11px] text-rose-600 font-medium">
                {report.absent_count === 0 ? 'Full attendance achieved' : 'Pending attendance check-in'}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-600 flex items-center justify-center shrink-0">
              <UserX className="w-6 h-6" />
            </div>
          </div>
        </div>
      )}

      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        {/* Search by Name or Email */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="attendance-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student by name or email..."
            className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-800 rounded-xl pl-9 pr-8 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
              title="Clear search"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills & Bulk Actions */}
        <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end">
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/80">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All ({report?.total_students ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('present')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'present'
                  ? 'bg-white text-emerald-700 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Present ({report?.present_count ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('absent')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'absent'
                  ? 'bg-white text-rose-700 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Absent ({report?.absent_count ?? 0})
            </button>
          </div>

          {/* Quick Bulk Action Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => handleBulkUpdate('present')}
              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
              title="Mark all students present"
            >
              Mark All Present
            </button>
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => handleBulkUpdate('absent')}
              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-xl border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors disabled:opacity-50"
              title="Mark all students absent"
            >
              Mark All Absent
            </button>
          </div>
        </div>
      </div>

      {/* STUDENT ATTENDANCE TABLE */}
      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th scope="col" className="py-3 px-4">
                  Student
                </th>
                <th scope="col" className="py-3 px-4">
                  Email
                </th>
                <th scope="col" className="py-3 px-4 text-center">
                  Status
                </th>
                <th scope="col" className="py-3 px-4 text-center">
                  Attended At
                </th>
                <th scope="col" className="py-3 px-4 text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700 text-sm">No students match filter</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {searchQuery
                        ? `No students found matching "${searchQuery}"`
                        : 'No student records in this session roster.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => {
                  const isPresent = record.status === 'present';
                  const initials = record.name
                    ? record.name
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()
                    : 'ST';

                  return (
                    <tr
                      key={record.student_id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Student Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                              isPresent
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-xs">{record.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              ID: #{record.student_id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        {record.email || '—'}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4 text-center">
                        {isPresent ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Present
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
                            <XCircle className="w-3.5 h-3.5 text-rose-500" />
                            Absent
                          </span>
                        )}
                      </td>

                      {/* Attended At & Activity Details */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="font-medium text-slate-700">
                          {formatAttendedAt(record.attended_at)}
                        </div>
                        {record.activity_type && (
                          <div className="text-[10px] text-slate-400 capitalize mt-0.5 flex items-center justify-center gap-1">
                            {record.activity_type === 'completed_quiz' ? (
                              <span className="text-indigo-600 font-semibold flex items-center gap-0.5">
                                <Award className="w-3 h-3" />
                                Quiz {record.score !== null && record.score !== undefined ? `(${record.score}%)` : 'Done'}
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                                <BookOpen className="w-3 h-3" />
                                Viewed Notes
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Toggle Action */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleToggleStatus(record)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                            isPresent
                              ? 'border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200'
                              : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          {isPresent ? 'Mark Absent' : 'Mark Present'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ATTENDANCE SUMMARY DETAILS: LIST OF PRESENT AND ABSENT STUDENTS */}
      {report && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Attended Students List */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Students Who Attended ({report.present_students.length})
              </span>
            </div>
            {report.present_students.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No students marked present yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                {report.present_students.map((name, i) => (
                  <span
                    key={i}
                    className="text-[11px] font-medium px-2 py-0.5 rounded-lg bg-emerald-100/70 text-emerald-800 border border-emerald-200"
                  >
                    {name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Absent Students List */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-rose-500" />
                Students Who Were Absent ({report.absent_students.length})
              </span>
            </div>
            {report.absent_students.length === 0 ? (
              <p className="text-xs text-emerald-600 font-medium italic">
                All enrolled students are present!
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                {report.absent_students.map((name, i) => (
                  <span
                    key={i}
                    className="text-[11px] font-medium px-2 py-0.5 rounded-lg bg-rose-100/70 text-rose-800 border border-rose-200"
                  >
                    {name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE SESSION MODAL */}
      {showNewSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-base text-slate-900">New Class Session</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewSessionModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
                aria-label="Close modal"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label
                  htmlFor="session-title-input"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1"
                >
                  Session Title *
                </label>
                <input
                  id="session-title-input"
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Biology Period 2 - Cellular Respiration"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label
                  htmlFor="session-grade-input"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1"
                >
                  Class / Grade Label
                </label>
                <input
                  id="session-grade-input"
                  type="text"
                  value={newClassLabel}
                  onChange={(e) => setNewClassLabel(e.target.value)}
                  placeholder="e.g. Grade 9, Period 3"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewSessionModal(false)}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={creatingSession || !newTitle.trim()}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {creatingSession ? 'Creating...' : 'Create Session'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceTracker;
