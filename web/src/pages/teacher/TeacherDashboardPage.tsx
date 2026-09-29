import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlusCircle,
  BookOpen,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Layers,
  GraduationCap,
} from 'lucide-react';
import { Card, CardHeader, CardContent, CardFooter } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { StatusPill } from '../../components/common/StatusPill';
import { LoadingState } from '../../components/common/LoadingState';
import { api } from '../../services/api';
import { Unit } from '../../types';

export const TeacherDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadUnits();
  }, []);

  const loadUnits = async () => {
    try {
      setLoading(true);
      const data = await api.listUnits();
      setUnits(data);
    } catch (err) {
      console.error('Failed to load units', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-[#0B1437] to-[#1A234A] rounded-2xl p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-[#1A234A]">
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Curriculum Engine</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Evidence-Locked Learning Packs
          </h1>
          <p className="text-slate-300 text-xs leading-relaxed">
            Turn trusted textbooks and lecture notes into rigorous, Bloom-aligned learning packs.
            Every claim is non-LLM verified and dual-solved for 100% hallucination resistance.
          </p>
        </div>

        <Button
          size="lg"
          onClick={() => navigate('/create')}
          leftIcon={<PlusCircle className="w-5 h-5" />}
          className="shadow-lg shadow-indigo-600/30 shrink-0"
        >
          Create New Unit
        </Button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Units
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{units.length}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-[#4F46E5] flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-400">Curriculum units authored</div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Evidence Verifier
              </div>
              <div className="text-2xl font-bold text-emerald-600 mt-1">100%</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-400">Exact & fuzzy quote matching</div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Dual Solver
              </div>
              <div className="text-2xl font-bold text-indigo-600 mt-1">Active</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-400">Blinded answer key validation</div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Active Classes
              </div>
              <div className="text-2xl font-bold text-purple-600 mt-1">Class 10-A</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-400">Live published snapshot</div>
        </Card>
      </div>

      {/* Recent Units Table / Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Your Learning Units</h2>
          <Button variant="outline" size="sm" onClick={() => navigate('/create')}>
            New Unit
          </Button>
        </div>

        {loading ? (
          <LoadingState message="Loading your units..." />
        ) : units.length === 0 ? (
          <Card className="p-10 text-center">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-800">No Learning Units Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
              Upload a source document to generate your first evidence-locked learning pack.
            </p>
            <Button size="sm" onClick={() => navigate('/create')}>
              Create First Unit
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {units.map((unit) => (
              <Card
                key={unit.id}
                hoverable
                className="cursor-pointer flex flex-col justify-between"
                onClick={() => navigate(`/units/${unit.id}`)}
              >
                <div className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                      {unit.target_grade}
                    </span>
                    <span className="text-[11px] capitalize text-slate-500 font-medium">
                      {unit.difficulty}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm mb-2 line-clamp-2">
                    {unit.title}
                  </h3>

                  <div className="space-y-1 text-xs text-slate-500 mb-4">
                    <div className="flex justify-between">
                      <span>Quiz Count:</span>
                      <span className="font-medium text-slate-800">{unit.quiz_count} questions</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Answer Key:</span>
                      <span className="font-medium text-slate-800">{unit.answer_visibility}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-[#FAFBFD] border-t border-[#F0F3F8] rounded-b-[14px] flex items-center justify-between text-xs font-semibold text-[#4F46E5]">
                  <span>Inspect Learning Pack</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
