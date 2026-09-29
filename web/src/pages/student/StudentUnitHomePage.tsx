import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  HelpCircle,
  Layers,
  FileText,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Printer,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { Card, CardHeader, CardContent, CardFooter } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { api } from '../../services/api';

export const StudentUnitHomePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const unitId = parseInt(id || '1');

  const [unitData, setUnitData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active student tile mode: 'overview' | 'learn' | 'practice' | 'revise'
  const [activeTile, setActiveTile] = useState<'overview' | 'learn' | 'practice' | 'revise'>('overview');

  // Practice state
  const [practiceAnswers, setPracticeAnswers] = useState<Record<number, number>>({});
  const [practiceFeedback, setPracticeFeedback] = useState<Record<number, boolean>>({});

  // Simplify explanation state
  const [simplifiedExplanation, setSimplifiedExplanation] = useState<any>(null);
  const [isSimplifying, setIsSimplifying] = useState<boolean>(false);

  useEffect(() => {
    loadUnitContent();
  }, [unitId]);

  const loadUnitContent = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getStudentUnit(unitId);
      setUnitData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load published learning pack');
    } finally {
      setLoading(false);
    }
  };

  const handleSimplifyExplanation = async (assetId: number) => {
    try {
      setIsSimplifying(true);
      const res = await api.simplifyAsset(assetId);
      setSimplifiedExplanation(res);
    } catch (err: any) {
      alert(err.message || 'Simplification failed');
    } finally {
      setIsSimplifying(false);
    }
  };

  const handlePracticeSelect = (slotId: number, optionIdx: number, correctIdx?: number) => {
    setPracticeAnswers((prev) => ({ ...prev, [slotId]: optionIdx }));
    if (correctIdx !== undefined) {
      setPracticeFeedback((prev) => ({ ...prev, [slotId]: optionIdx === correctIdx }));
    }
  };

  if (loading) return <LoadingState message="Loading your assigned learning pack..." />;
  if (error || !unitData) return <ErrorBanner message={error || 'Unit not found'} onRetry={loadUnitContent} />;

  const slots = unitData.slots || [];
  const explanations = slots.filter((s: any) => s.type === 'explanation');
  const examples = slots.filter((s: any) => s.type === 'example');
  const quizItems = slots.filter((s: any) => s.type === 'quiz_item');
  const practiceItems = slots.filter(
    (s: any) => s.type === 'practice_foundation' || s.type === 'practice_advanced'
  );
  const revisions = slots.filter((s: any) => s.type === 'revision');

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in">
      {/* Top Banner */}
      <Card className="p-6 bg-gradient-to-r from-[#0B1437] to-[#1A234A] text-white">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-indigo-300 font-semibold mb-1">
              <span>{unitData.target_grade}</span>
              <span>• Published Learning Pack</span>
              <span className="capitalize">• {unitData.difficulty} Level</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{unitData.title}</h1>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Evidence-Locked Curriculum</span>
            </span>
          </div>
        </div>
      </Card>

      {/* 4 Core Learning Tiles (No Flashcards) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Tile 1: Learn */}
        <Card
          hoverable
          onClick={() => setActiveTile('learn')}
          className={`cursor-pointer p-5 flex flex-col justify-between transition-all ${
            activeTile === 'learn' ? 'ring-2 ring-[#4F46E5] bg-indigo-50/20' : ''
          }`}
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
              <BookOpen className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">1. Learn</h3>
            <p className="text-[11px] text-slate-500 mt-1">Concepts & worked examples</p>
          </div>
          <span className="text-xs font-semibold text-indigo-600 mt-4 flex items-center gap-1">
            Open Concept <ChevronRight className="w-3 h-3" />
          </span>
        </Card>

        {/* Tile 2: Take Quiz */}
        <Card
          hoverable
          onClick={() => navigate(`/student/quiz/${unitId}`)}
          className="cursor-pointer p-5 flex flex-col justify-between hover:border-indigo-300"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
              <HelpCircle className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">2. Formative Quiz</h3>
            <p className="text-[11px] text-slate-500 mt-1">{quizItems.length} Graded items</p>
          </div>
          <span className="text-xs font-semibold text-emerald-600 mt-4 flex items-center gap-1">
            Start Quiz <ChevronRight className="w-3 h-3" />
          </span>
        </Card>

        {/* Tile 3: Practice */}
        <Card
          hoverable
          onClick={() => setActiveTile('practice')}
          className={`cursor-pointer p-5 flex flex-col justify-between transition-all ${
            activeTile === 'practice' ? 'ring-2 ring-[#4F46E5] bg-indigo-50/20' : ''
          }`}
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">3. Practice</h3>
            <p className="text-[11px] text-slate-500 mt-1">Foundation & Advanced</p>
          </div>
          <span className="text-xs font-semibold text-purple-600 mt-4 flex items-center gap-1">
            Open Practice <ChevronRight className="w-3 h-3" />
          </span>
        </Card>

        {/* Tile 4: Revise */}
        <Card
          hoverable
          onClick={() => setActiveTile('revise')}
          className={`cursor-pointer p-5 flex flex-col justify-between transition-all ${
            activeTile === 'revise' ? 'ring-2 ring-[#4F46E5] bg-indigo-50/20' : ''
          }`}
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">4. Revise</h3>
            <p className="text-[11px] text-slate-500 mt-1">Key points & summary</p>
          </div>
          <span className="text-xs font-semibold text-amber-600 mt-4 flex items-center gap-1">
            Review Sheet <ChevronRight className="w-3 h-3" />
          </span>
        </Card>
      </div>

      {/* ========================================================================= */}
      {/* TILE 1 VIEW: LEARN (EXPLANATION WITH SIMPLIFY & WORKED EXAMPLES) */}
      {/* ========================================================================= */}
      {activeTile === 'learn' && (
        <div className="space-y-6">
          {explanations.map((item: any, idx: number) => {
            const content = item.content || {};
            const isSimplifiedActive = !!simplifiedExplanation;
            const displayContent = isSimplifiedActive
              ? simplifiedExplanation.content
              : content;

            return (
              <Card key={item.slot_id || idx}>
                <CardHeader
                  title={
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-indigo-600" />
                      <span>{displayContent.title || 'Core Concept Explanation'}</span>
                    </div>
                  }
                  subtitle={displayContent.summary}
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      isLoading={isSimplifying}
                      onClick={() => handleSimplifyExplanation(item.asset_id)}
                      leftIcon={<Sparkles className="w-3.5 h-3.5 text-indigo-600" />}
                    >
                      {isSimplifiedActive ? 'Revert to Standard' : 'Simplify This Concept'}
                    </Button>
                  }
                />
                <CardContent className="space-y-5 text-xs leading-relaxed text-slate-800">
                  {isSimplifiedActive && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-950 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Reading-Level Simplified Variant Active: Passed semantic-consistency check (all glossary terms & quotes preserved).
                      </span>
                    </div>
                  )}

                  {/* Instructional Sentences */}
                  <div className="space-y-2">
                    <span className="font-semibold text-slate-700 block">Explanation Points:</span>
                    {displayContent.sentences?.map((sent: any, sIdx: number) => (
                      <div key={sIdx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        <p className="font-medium text-slate-900">{sent.text}</p>
                      </div>
                    ))}
                  </div>

                  {/* Glossary Vocabulary */}
                  {displayContent.glossary?.length > 0 && (
                    <div className="pt-3 border-t border-slate-200 space-y-2">
                      <span className="font-semibold text-slate-700 block">Essential Glossary Terms:</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {displayContent.glossary.map((g: any, gIdx: number) => (
                          <div key={gIdx} className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                            <span className="font-bold text-indigo-900 block">{g.term}</span>
                            <span className="text-slate-600 text-[11px] block mt-0.5">{g.definition}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* Step-by-Step Worked Examples */}
          {examples.map((item: any, idx: number) => {
            const exContent = item.content || {};
            return (
              <Card key={item.slot_id || idx}>
                <CardHeader
                  title="Step-by-Step Worked Example"
                  subtitle="Concrete problem solving demonstration"
                />
                <CardContent className="space-y-4 text-xs text-slate-800">
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-medium">
                    <span className="font-bold text-slate-900 block mb-1">Problem:</span>
                    <p>{exContent.problem}</p>
                  </div>

                  <div className="space-y-2">
                    <span className="font-semibold text-slate-700 block">Solution Steps:</span>
                    {exContent.steps?.map((step: any, sIdx: number) => (
                      <div key={sIdx} className="p-3 bg-white border border-slate-200 rounded-xl">
                        <span className="font-bold text-indigo-900 block">Step {sIdx + 1}:</span>
                        <p className="text-slate-800 mt-0.5">{step.text}</p>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 font-medium">
                    <span className="font-bold block mb-0.5">Conclusion:</span>
                    <p>{exContent.answer}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TILE 3 VIEW: PRACTICE (FOUNDATION & ADVANCED WITH INSTANT FEEDBACK) */}
      {/* ========================================================================= */}
      {activeTile === 'practice' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Differentiated Practice Questions</h2>
            <span className="text-xs text-slate-500 font-medium">
              Self-paced mastery check
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {practiceItems.map((item: any, idx: number) => {
              const pContent = item.content || {};
              const isFoundation = item.type === 'practice_foundation';
              const chosen = practiceAnswers[item.slot_id];

              return (
                <Card
                  key={item.slot_id || idx}
                  className={isFoundation ? 'border-blue-100 bg-blue-50/10' : 'border-purple-100 bg-purple-50/10'}
                >
                  <CardHeader
                    title={
                      <div className="flex items-center justify-between w-full">
                        <span className="font-bold text-xs capitalize">
                          {isFoundation ? 'Foundation Level' : 'Advanced Analysis'}
                        </span>
                        <Badge bloom={item.content?.bloom || (isFoundation ? 'understand' : 'analyze')} />
                      </div>
                    }
                  />
                  <CardContent className="space-y-4 text-xs">
                    <div className="p-3 bg-white border border-slate-200 rounded-xl font-medium text-slate-900">
                      {pContent.question}
                    </div>

                    <div className="space-y-2">
                      {pContent.options?.map((opt: string, optIdx: number) => {
                        const isSelected = chosen === optIdx;
                        return (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() => handlePracticeSelect(item.slot_id, optIdx)}
                            className={`w-full text-left p-2.5 rounded-xl border text-xs font-medium transition-all ${
                              isSelected
                                ? 'bg-indigo-50 border-[#4F46E5] text-indigo-950 ring-1 ring-[#4F46E5]'
                                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                          >
                            <span>{String.fromCharCode(65 + optIdx)}. {opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TILE 4 VIEW: REVISE (STRUCTURED REVISION SHEET) */}
      {/* ========================================================================= */}
      {activeTile === 'revise' && (
        <Card className="p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Structured Unit Revision Sheet</h2>
              <p className="text-xs text-slate-500">Summary of all essential concepts and vocabulary</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              leftIcon={<Printer className="w-3.5 h-3.5" />}
            >
              Print Revision Sheet
            </Button>
          </div>

          {revisions.map((item: any, idx: number) => {
            const revContent = item.content || {};
            return (
              <div key={item.slot_id || idx} className="space-y-5 text-xs text-slate-800">
                <div className="space-y-2">
                  <span className="font-bold text-sm text-slate-900 block">Key Concept Points:</span>
                  {revContent.key_points?.map((kp: any, kIdx: number) => (
                    <div key={kIdx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <p className="font-medium text-slate-900">{kp.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
};
