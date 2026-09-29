import React from 'react';
import { Sparkles, Layers, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../common/Card';
import { Badge } from '../common/Badge';
import { Slot, Asset } from '../../types';

interface PracticeComparisonViewProps {
  foundationSlot: { slot: Slot; asset: Asset | null } | null;
  advancedSlot: { slot: Slot; asset: Asset | null } | null;
}

export const PracticeComparisonView: React.FC<PracticeComparisonViewProps> = ({
  foundationSlot,
  advancedSlot,
}) => {
  const fContent = foundationSlot?.asset?.current_version?.content;
  const aContent = advancedSlot?.asset?.current_version?.content;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-600" />
          <h3 className="font-bold text-sm text-slate-900">
            Differentiated Practice Comparison (Side-by-Side)
          </h3>
        </div>
        <span className="text-xs text-slate-500 font-medium">
          Differentiated Bloom Depth & Cognitive Complexity
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Foundation Practice Card */}
        <Card className="border-blue-100 bg-blue-50/20">
          <CardHeader
            title={
              <div className="flex items-center justify-between w-full">
                <span className="text-sm font-bold text-blue-900">Foundation Practice</span>
                <Badge bloom={foundationSlot?.slot.bloom_tag || 'understand'} />
              </div>
            }
            subtitle="Focus on direct concept reinforcement and recall"
          />
          <CardContent className="space-y-4 text-xs">
            {fContent ? (
              <>
                <div className="p-3.5 bg-white border border-blue-200 rounded-xl font-medium text-slate-900">
                  {fContent.question}
                </div>

                <div className="space-y-2">
                  <span className="font-semibold text-slate-700 block">Options:</span>
                  {fContent.options?.map((opt: string, idx: number) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-lg border text-xs ${
                        idx === fContent.correct_index
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      {String.fromCharCode(65 + idx)}. {opt}
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-white border border-blue-100 rounded-lg text-slate-700">
                  <span className="font-semibold text-blue-900 block mb-1">Rationale:</span>
                  <p>{fContent.rationale}</p>
                </div>
              </>
            ) : (
              <div className="p-6 text-center text-slate-400">Foundation practice item not yet generated.</div>
            )}
          </CardContent>
        </Card>

        {/* Advanced Practice Card */}
        <Card className="border-purple-100 bg-purple-50/20">
          <CardHeader
            title={
              <div className="flex items-center justify-between w-full">
                <span className="text-sm font-bold text-purple-900">Advanced Practice</span>
                <Badge bloom={advancedSlot?.slot.bloom_tag || 'analyze'} />
              </div>
            }
            subtitle="Requires mechanism analysis, synthesis, or evaluation"
          />
          <CardContent className="space-y-4 text-xs">
            {aContent ? (
              <>
                <div className="p-3.5 bg-white border border-purple-200 rounded-xl font-medium text-slate-900">
                  {aContent.question}
                </div>

                <div className="space-y-2">
                  <span className="font-semibold text-slate-700 block">Options:</span>
                  {aContent.options?.map((opt: string, idx: number) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-lg border text-xs ${
                        idx === aContent.correct_index
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      {String.fromCharCode(65 + idx)}. {opt}
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-white border border-purple-100 rounded-lg text-slate-700">
                  <span className="font-semibold text-purple-900 block mb-1">Rationale:</span>
                  <p>{aContent.rationale}</p>
                </div>
              </>
            ) : (
              <div className="p-6 text-center text-slate-400">Advanced practice item not yet generated.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
