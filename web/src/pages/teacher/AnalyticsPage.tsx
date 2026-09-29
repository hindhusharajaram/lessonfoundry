import React from 'react';
import { BarChart3, Users, CheckCircle2, TrendingUp, Sparkles, BookOpen } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';

export const AnalyticsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h1 className="text-xl font-bold text-slate-900">Class Performance & Mastery Analytics</h1>
        <p className="text-xs text-slate-500 mt-1">
          Track objective mastery, formative assessment attempts, and error analysis across classes.
        </p>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Enrolled Students
            </span>
            <Users className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">28</div>
          <div className="text-[11px] text-slate-400 mt-1">Class 10-A Biology</div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Average Mastery Score
            </span>
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-2">84.2%</div>
          <div className="text-[11px] text-slate-400 mt-1">+6.5% vs. previous unit</div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Quizzes Submitted
            </span>
            <CheckCircle2 className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-purple-600 mt-2">42</div>
          <div className="text-[11px] text-slate-400 mt-1">Formative check-ins</div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Objective Mastery Breakdown"
          subtitle="Formative diagnostic accuracy per curriculum objective."
        />
        <CardContent className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <div className="flex justify-between font-medium text-slate-700">
              <span>Objective #1: Light-dependent Reactions (Thylakoid & Photolysis)</span>
              <span className="font-bold text-emerald-700">89% Mastery</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: '89%' }} />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between font-medium text-slate-700">
              <span>Objective #2: Calvin Cycle (Carbon Fixation & RuBisCO)</span>
              <span className="font-bold text-indigo-700">78% Mastery</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div className="bg-indigo-500 h-full rounded-full" style={{ width: '78%' }} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
