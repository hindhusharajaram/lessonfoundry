import React from 'react';
import { BarChart3, Award, CheckCircle2, Clock } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';

export const StudentProgressPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h1 className="text-xl font-bold text-slate-900">My Progress & Mastery</h1>
        <p className="text-xs text-slate-500 mt-1">
          Review your quiz attempt scores, verified feedback, and key concept mastery.
        </p>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Assessments Taken
            </span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">4</div>
          <div className="text-[11px] text-slate-400 mt-1">Completed formative checks</div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Average Score
            </span>
            <Award className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-indigo-600 mt-2">87.5%</div>
          <div className="text-[11px] text-slate-400 mt-1">Mastery level</div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Study Time
            </span>
            <Clock className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-purple-600 mt-2">1.8 hrs</div>
          <div className="text-[11px] text-slate-400 mt-1">Active practice time</div>
        </Card>
      </div>
    </div>
  );
};

export const PlaceholderPage: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => {
  return (
    <Card className="p-8 text-center">
      <h2 className="text-lg font-bold text-slate-900 mb-1">{title}</h2>
      <p className="text-xs text-slate-500 max-w-sm mx-auto">{subtitle}</p>
    </Card>
  );
};
