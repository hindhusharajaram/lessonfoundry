import React from 'react';
import { UserCheck, ShieldCheck } from 'lucide-react';
import { AttendanceTracker } from '../../components/attendance/AttendanceTracker';

export const AttendancePage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Student Attendance
            </h1>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              Verified Rosters
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time verification of student presence, enrollment records, and classroom engagement rates.
          </p>
        </div>
      </div>

      {/* Attendance Tracker Core Component */}
      <AttendanceTracker />
    </div>
  );
};

export default AttendancePage;
