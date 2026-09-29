import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, ArrowLeft, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { Card, CardHeader, CardContent, CardFooter } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { LoadingState } from '../../components/common/LoadingState';
import { api } from '../../services/api';

export const StudentQuizPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const unitId = parseInt(id || '1');

  const [unitData, setUnitData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [attemptResult, setAttemptResult] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    loadQuiz();
  }, [unitId]);

  const loadQuiz = async () => {
    try {
      setLoading(true);
      const data = await api.getStudentUnit(unitId);
      setUnitData(data);
    } catch (err) {
      console.error('Failed to load quiz', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = (assetId: number, optionIdx: number) => {
    if (submitted) return;
    setSelectedAnswers({
      ...selectedAnswers,
      [assetId]: optionIdx,
    });
  };

  const handleSubmitQuiz = async () => {
    try {
      setIsSubmitting(true);
      const answersPayload = Object.entries(selectedAnswers).map(([assetId, chosenIndex]) => ({
        asset_id: parseInt(assetId),
        chosen_index: chosenIndex,
      }));

      const result = await api.submitQuizAttempt(unitId, answersPayload);
      setAttemptResult(result);
      setSubmitted(true);
    } catch (err: any) {
      alert(err.message || 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <LoadingState message="Loading formative assessment..." />;
  if (!unitData) return <div>Unit not found.</div>;

  const quizAssets = unitData.assets?.filter(
    (a: any) =>
      a.slot_type === 'quiz_item' ||
      a.slot_type === 'practice_foundation' ||
      a.slot_type === 'practice_advanced'
  ) || [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Quiz Top Header */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-indigo-600 font-semibold mb-1">
              <span>{unitData.unit?.target_grade}</span>
              <span>• Formative Assessment</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900">{unitData.unit?.title}</h1>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Evidence-Locked Assessment</span>
          </div>
        </div>
      </Card>

      {/* Post Submission Score Banner */}
      {submitted && attemptResult && (
        <Card className="p-6 bg-emerald-50 border-emerald-200 text-emerald-950">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Assessment Completed
              </h2>
              <p className="text-xs text-emerald-800">
                You scored {attemptResult.score} out of {attemptResult.total} (
                {attemptResult.percentage.toFixed(1)}%). Review the evidence-locked explanations below.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/student')}>
              Back to My Learning
            </Button>
          </div>
        </Card>
      )}

      {/* Question Items */}
      <div className="space-y-6">
        {quizAssets.map((asset: any, qIdx: number) => {
          const chosenIdx = selectedAnswers[asset.asset_id];
          const resultDetail = attemptResult?.results?.find((r: any) => r.asset_id === asset.asset_id);

          return (
            <Card key={asset.asset_id} className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <span className="font-semibold text-sm text-slate-900">
                  Question {qIdx + 1}. {asset.content?.question}
                </span>
                {submitted && resultDetail && (
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0 ${
                      resultDetail.correct
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {resultDetail.correct ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Correct
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5" /> Incorrect
                      </>
                    )}
                  </span>
                )}
              </div>

              {/* Options */}
              <div className="space-y-2">
                {asset.content?.options?.map((optionText: string, optIdx: number) => {
                  const isSelected = chosenIdx === optIdx;
                  const isCorrect = submitted && resultDetail && optIdx === resultDetail.correct_index;

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      disabled={submitted}
                      onClick={() => handleSelectOption(asset.asset_id, optIdx)}
                      className={`w-full text-left p-3.5 rounded-xl border text-xs font-medium transition-all flex items-center justify-between ${
                        isCorrect
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold'
                          : isSelected
                          ? 'bg-indigo-50 border-[#4F46E5] text-indigo-950 ring-1 ring-[#4F46E5]'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      <span>
                        {String.fromCharCode(65 + optIdx)}. {optionText}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Verified Post-Submission Rationale */}
              {submitted && resultDetail && (
                <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-2 text-xs text-indigo-950 mt-3">
                  <span className="font-semibold block">Verified Explanation:</span>
                  <p className="text-slate-700 leading-relaxed">{resultDetail.rationale}</p>
                  {resultDetail.quote && (
                    <div className="text-[11px] text-indigo-800 font-mono bg-white p-2 rounded border border-indigo-200">
                      Source Evidence: &ldquo;{resultDetail.quote}&rdquo;
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Submit Action */}
      {!submitted && (
        <Card className="p-4 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {Object.keys(selectedAnswers).length} of {quizAssets.length} answered
          </span>
          <Button
            size="lg"
            onClick={handleSubmitQuiz}
            isLoading={isSubmitting}
            disabled={Object.keys(selectedAnswers).length === 0}
          >
            Submit Assessment
          </Button>
        </Card>
      )}
    </div>
  );
};
