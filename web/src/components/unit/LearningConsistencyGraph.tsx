import React from 'react';
import { GitCommit, ArrowRight, CheckCircle2, AlertTriangle, Layers, BookOpen } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../common/Card';
import { LearningPack, Slot } from '../../types';

interface LearningConsistencyGraphProps {
  pack: LearningPack;
}

export const LearningConsistencyGraph: React.FC<LearningConsistencyGraphProps> = ({ pack }) => {
  return (
    <Card className="shadow-card">
      <CardHeader
        title={
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            <span>Learning Consistency & Alignment Graph</span>
          </div>
        }
        subtitle="End-to-end topological mapping connecting curriculum objectives to generated pedagogical artifacts."
      />
      <CardContent className="space-y-6">
        {pack.by_objective?.map((objGroup, idx) => {
          const obj = objGroup.objective;
          const slots = objGroup.slots;

          const explanations = slots.filter((s) => s.slot.type === 'explanation');
          const examples = slots.filter((s) => s.slot.type === 'example');
          const quizzes = slots.filter((s) => s.slot.type === 'quiz_item');
          const practices = slots.filter(
            (s) => s.slot.type === 'practice_foundation' || s.slot.type === 'practice_advanced'
          );
          const revisions = slots.filter((s) => s.slot.type === 'revision');

          const hasFlags = slots.some((s) => s.flags && s.flags.length > 0 && s.flags.some((f) => !f.resolved));

          return (
            <div
              key={obj.id || idx}
              className="p-5 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-4"
            >
              {/* Objective Header Node */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                      hasFlags
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    }`}
                  >
                    O{idx + 1}
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-900 line-clamp-1">{obj.text}</h4>
                    <span className="text-[10px] text-slate-500 font-medium">
                      Bloom Target: {obj.bloom_target || 'Understand'}
                    </span>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    hasFlags
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {hasFlags ? 'Needs Review' : 'Aligned'}
                </span>
              </div>

              {/* DAG Pipeline Flow */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-2">
                {/* 1. Explanations */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    1. Concept
                  </span>
                  <div className="font-semibold text-xs text-slate-800">
                    {explanations.length} Explanation
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                    <CheckCircle2 className="w-3 h-3" /> Grounded
                  </div>
                </div>

                {/* 2. Examples */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    2. Example
                  </span>
                  <div className="font-semibold text-xs text-slate-800">
                    {examples.length} Worked Problem
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                    <CheckCircle2 className="w-3 h-3" /> Step Verified
                  </div>
                </div>

                {/* 3. Formative Quizzes */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    3. Formative
                  </span>
                  <div className="font-semibold text-xs text-slate-800">
                    {quizzes.length} Quiz Items
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-indigo-600 font-medium">
                    <GitCommit className="w-3 h-3" /> Dual Solved
                  </div>
                </div>

                {/* 4. Practice Items */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    4. Practice
                  </span>
                  <div className="font-semibold text-xs text-slate-800">
                    {practices.length} Differentiated
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-purple-600 font-medium">
                    <Layers className="w-3 h-3" /> Bloom Graded
                  </div>
                </div>

                {/* 5. Revision */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    5. Synthesis
                  </span>
                  <div className="font-semibold text-xs text-slate-800">
                    {revisions.length} Revision Summary
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                    <CheckCircle2 className="w-3 h-3" /> Key Terms
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
