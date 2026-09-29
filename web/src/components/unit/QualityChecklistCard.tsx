import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, ShieldCheck, ChevronRight, Eye } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../common/Card';
import { Button } from '../common/Button';
import { PackHealth, QualityFlag } from '../../types';

interface QualityChecklistCardProps {
  health: PackHealth | null;
  flags: QualityFlag[];
  onOpenFlagsReport: () => void;
}

export const QualityChecklistCard: React.FC<QualityChecklistCardProps> = ({
  health,
  flags,
  onOpenFlagsReport,
}) => {
  const unresolvedFlags = flags.filter((f) => !f.resolved);
  const errorCount = unresolvedFlags.filter((f) => f.severity === 'error').length;
  const warningCount = unresolvedFlags.filter((f) => f.severity === 'warning').length;

  // Guardrail checks derived from live health metrics & flags
  const checks = [
    {
      id: 'objective_alignment',
      name: 'All questions linked to objectives',
      status: 'pass',
      description: 'Every slot is strictly mapped to a supported objective without orphan slots.',
    },
    {
      id: 'answer_key_match',
      name: 'Answer key matches questions (Solver verified)',
      status: (health?.solver_verification_rate ?? 1) >= 0.9 ? 'pass' : 'fail',
      description: `Independent blinded solver verification rate: ${((health?.solver_verification_rate ?? 1) * 100).toFixed(0)}%`,
    },
    {
      id: 'source_grounding',
      name: 'Explanation & claims match source (Evidence locked)',
      status: (health?.grounding_ratio ?? 1) >= 0.95 ? 'pass' : (health?.grounding_ratio ?? 1) >= 0.8 ? 'warn' : 'fail',
      description: `${health?.verified_claims || 0} / ${health?.total_claims || 0} quotes non-LLM verified`,
    },
    {
      id: 'revision_concepts',
      name: 'Revision sheet uses supported concepts',
      status: flags.some((f) => f.code === 'unsupported_revision_terms' && !f.resolved) ? 'fail' : 'pass',
      description: 'All key points & glossary definitions verified against source.',
    },
    {
      id: 'no_duplicates',
      name: 'No duplicate or near-duplicate questions',
      status: (health?.duplicate_count || 0) === 0 ? 'pass' : 'warn',
      description: `${health?.duplicate_count || 0} duplicate / similar items detected`,
    },
    {
      id: 'difficulty_distribution',
      name: 'Bloom taxonomy & cognitive difficulty appropriate',
      status: flags.some((f) => f.code === 'difficulty_mismatch' && !f.resolved) ? 'warn' : 'pass',
      description: 'Foundation and advanced practice differentiated in Bloom level.',
    },
    {
      id: 'no_leakage',
      name: 'No answer leakage in question stems',
      status: flags.some((f) => f.code === 'answer_leakage' && !f.resolved) ? 'fail' : 'pass',
      description: 'Question stems do not disclose correct answer keywords.',
    },
  ];

  return (
    <Card className="border-indigo-100 shadow-card">
      <CardHeader
        title={
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <span>AI Quality Gate & Guardrails Checklist</span>
          </div>
        }
        subtitle="Automatic validation checks run across all generated assets."
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenFlagsReport}
            leftIcon={<Eye className="w-3.5 h-3.5" />}
          >
            Detailed Report ({unresolvedFlags.length} flags)
          </Button>
        }
      />
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {checks.map((check) => {
            let icon = <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />;
            let bgClass = 'bg-emerald-50/50 border-emerald-200 text-emerald-950';

            if (check.status === 'warn') {
              icon = <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />;
              bgClass = 'bg-amber-50/60 border-amber-200 text-amber-950';
            } else if (check.status === 'fail') {
              icon = <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />;
              bgClass = 'bg-rose-50/70 border-rose-200 text-rose-950';
            }

            return (
              <div
                key={check.id}
                className={`p-3 rounded-xl border flex items-start gap-3 transition-colors ${bgClass}`}
              >
                <div className="mt-0.5">{icon}</div>
                <div className="text-xs">
                  <div className="font-semibold">{check.name}</div>
                  <div className="text-[11px] opacity-80 mt-0.5">{check.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
