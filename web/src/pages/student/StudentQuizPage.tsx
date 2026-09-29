import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Clock,
  RotateCcw,
  Check,
  FileCheck,
  HelpCircle,
  Eye,
} from 'lucide-react';
import { Card, CardHeader, CardContent, CardFooter } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { ProgressBar, ProgressRing } from '../../components/common/ProgressBar';
import { LoadingState } from '../../components/common/LoadingState';
import { api } from '../../services/api';

export const StudentQuizPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const unitId = parseInt(id || '1');

  const [unitData, setUnitData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Question navigation state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [questionTimes, setQuestionTimes] = useState<Record<number, number>>({});

  // Review step before submit
  const [isReviewMode, setIsReviewMode] = useState<boolean>(false);

  // Post-submit state
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [attemptResult, setAttemptResult] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showAnswerReview, setShowAnswerReview] = useState<boolean>(false);

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

  if (loading) return <LoadingState message="Loading formative assessment questions..." />;
  if (!unitData) return <div>Assessment not available.</div>;

  const formativeQuizItems = unitData.slots?.filter((a: any) => a.type === 'quiz_item') || [];
  const quizAssets = formativeQuizItems.length > 0 ? formativeQuizItems : (unitData.slots?.filter(
    (a: any) =>
      a.type === 'quiz_item' ||
      a.type === 'practice_foundation' ||
      a.type === 'practice_advanced'
  ) || []);

  const totalQuestions = quizAssets.length;
  const currentAsset = quizAssets[currentQuestionIndex];
  const answeredCount = Object.keys(selectedAnswers).length;

  const handleSelectOption = (assetId: number, optionIdx: number) => {
    if (submitted || isSubmitting) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [assetId]: optionIdx,
    }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      setIsReviewMode(true);
    }
  };

  const handlePrevious = () => {
    if (isReviewMode) {
      setIsReviewMode(false);
    } else if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmitQuiz = async () => {
    if (isSubmitting || submitted) return;
    try {
      setIsSubmitting(true);
      const answersPayload = Object.entries(selectedAnswers).map(([assetId, chosenIndex]) => ({
        asset_id: parseInt(assetId),
        chosen_index: chosenIndex,
        time_seconds: questionTimes[parseInt(assetId)] || 30,
      }));

      const result = await api.submitQuizAttempt(unitId, answersPayload);
      const fullResults = await api.getAttemptResults(result.attempt_id).catch(() => null);

      setAttemptResult(fullResults || result);
      setSubmitted(true);
      setIsReviewMode(false);
    } catch (err: any) {
      alert(err.message || 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto animate-in">
      {/* Quiz Top Navigation Bar */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/student/units/${unitId}`)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
              title="Back to Learning Unit"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <span className="text-[11px] font-semibold text-indigo-600 block">
                {unitData.target_grade} • Formative Quiz
              </span>
              <h1 className="text-base font-bold text-slate-900">{unitData.title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Evidence-Locked Assessment</span>
            </span>
          </div>
        </div>

        {!submitted && (
          <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
            <div className="flex justify-between items-center text-xs font-semibold text-slate-600">
              <span>
                {isReviewMode
                  ? 'Review Answers Before Submission'
                  : `Question ${currentQuestionIndex + 1} of ${totalQuestions}`}
              </span>
              <span>{answeredCount} of {totalQuestions} answered</span>
            </div>
            <ProgressBar
              progress={isReviewMode ? 100 : ((currentQuestionIndex + 1) / totalQuestions) * 100}
              size="sm"
              color="brand"
            />
          </div>
        )}
      </Card>

      {/* ========================================================================= */}
      {/* 1. SINGLE QUESTION ACTIVE VIEW */}
      {/* ========================================================================= */}
      {!submitted && !isReviewMode && currentAsset && (
        <Card className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Question #{currentQuestionIndex + 1}
            </span>
            <div className="flex items-center gap-2">
              {currentAsset.content?.bloom && <Badge bloom={currentAsset.content.bloom} />}
              <span className="text-xs text-slate-400 capitalize">
                • {currentAsset.content?.difficulty || 'Medium'}
              </span>
            </div>
          </div>

          <div className="font-semibold text-sm text-slate-900 leading-relaxed">
            {currentAsset.content?.question}
          </div>

          {/* Options */}
          <div className="space-y-2.5">
            {currentAsset.content?.options?.map((optionText: string, optIdx: number) => {
              const isSelected = selectedAnswers[currentAsset.asset_id] === optIdx;

              return (
                <button
                  key={optIdx}
                  type="button"
                  onClick={() => handleSelectOption(currentAsset.asset_id, optIdx)}
                  className={`w-full text-left p-4 rounded-xl border text-xs font-medium transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-indigo-50 border-[#4F46E5] text-indigo-950 ring-2 ring-[#4F46E5] shadow-sm'
                      : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <span>
                    <strong className="mr-2 text-indigo-900">{String.fromCharCode(65 + optIdx)}.</strong>
                    {optionText}
                  </span>
                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                      isSelected ? 'border-[#4F46E5] bg-[#4F46E5] text-white' : 'border-slate-300'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </button>
              );
            })}
          </div>

          <CardFooter className="flex items-center justify-between pt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={currentQuestionIndex === 0}
              onClick={handlePrevious}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Previous
            </Button>

            <Button
              size="sm"
              onClick={handleNext}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              {currentQuestionIndex === totalQuestions - 1 ? 'Review & Submit' : 'Next Question'}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* 2. REVIEW BEFORE SUBMISSION VIEW */}
      {/* ========================================================================= */}
      {!submitted && isReviewMode && (
        <Card className="p-6 space-y-6">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900">Review Your Answers</h2>
            <p className="text-xs text-slate-500">
              Check that you have selected an answer for each question before finalizing submission.
            </p>
          </div>

          <div className="space-y-2">
            {quizAssets.map((asset: any, idx: number) => {
              const isAnswered = selectedAnswers[asset.asset_id] !== undefined;
              const chosenOptIdx = selectedAnswers[asset.asset_id];

              return (
                <div
                  key={asset.asset_id}
                  onClick={() => {
                    setCurrentQuestionIndex(idx);
                    setIsReviewMode(false);
                  }}
                  className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 cursor-pointer flex items-center justify-between text-xs transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] ${
                        isAnswered
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="font-medium text-slate-800 line-clamp-1 max-w-md">
                      {asset.content?.question}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        isAnswered
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {isAnswered
                        ? `Option ${String.fromCharCode(65 + chosenOptIdx)} Selected`
                        : 'Unanswered'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <CardFooter className="flex items-center justify-between">
            <Button variant="outline" onClick={handlePrevious} leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Back to Questions
            </Button>
            <Button
              onClick={handleSubmitQuiz}
              isLoading={isSubmitting}
              disabled={answeredCount === 0}
              rightIcon={<Check className="w-4 h-4" />}
            >
              Submit Assessment ({answeredCount}/{totalQuestions})
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* 3. POST-SUBMISSION RESULTS SCREEN */}
      {/* ========================================================================= */}
      {submitted && attemptResult && (
        <div className="space-y-6">
          <Card className="p-8 text-center flex flex-col items-center space-y-4 bg-white">
            <ProgressRing score={attemptResult.score || 0} size={110} strokeWidth={10} />

            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-900">Assessment Completed!</h2>
              <p className="text-xs text-slate-500">
                You scored {attemptResult.score}% ({attemptResult.results?.filter((r: any) => r.correct).length || 0} of {totalQuestions} correct).
              </p>
            </div>

            <div className="flex justify-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowAnswerReview(!showAnswerReview)}
                leftIcon={<Eye className="w-4 h-4" />}
              >
                {showAnswerReview ? 'Hide Explanations' : 'Review Verified Explanations'}
              </Button>
              <Button onClick={() => navigate(`/student/units/${unitId}`)}>
                Back to Unit Learning
              </Button>
            </div>
          </Card>

          {/* Answer Breakdown & Explanations */}
          {showAnswerReview && (
            <div className="space-y-4">
              <h3 className="font-bold text-sm text-slate-900">Detailed Feedback & Grounding Evidence</h3>

              {attemptResult.results?.map((res: any, idx: number) => (
                <Card key={idx} className="p-5 space-y-3 text-xs">
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-semibold text-slate-900 text-sm">
                      Question {idx + 1}. {res.question}
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-full font-bold text-xs flex items-center gap-1 shrink-0 ${
                        res.correct
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {res.correct ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Correct
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3.5 h-3.5" /> Incorrect
                        </>
                      )}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {res.options?.map((opt: string, oIdx: number) => {
                      const isCorrectKey = oIdx === res.correct_index;
                      const isChosen = oIdx === res.chosen_index;

                      return (
                        <div
                          key={oIdx}
                          className={`p-2.5 rounded-lg border flex items-center justify-between text-xs ${
                            isCorrectKey
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold'
                              : isChosen
                              ? 'bg-rose-50 border-rose-300 text-rose-950 font-medium'
                              : 'bg-white border-slate-200 text-slate-600'
                          }`}
                        >
                          <span>
                            {String.fromCharCode(65 + oIdx)}. {opt}
                          </span>
                          {isCorrectKey && (
                            <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                              Correct Key
                            </span>
                          )}
                          {isChosen && !isCorrectKey && (
                            <span className="text-[10px] uppercase font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                              Your Answer
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-1.5 text-indigo-950">
                    <span className="font-semibold block">Pedagogical Rationale:</span>
                    <p className="text-slate-700 leading-relaxed">{res.rationale}</p>
                    {res.supporting_quote && (
                      <div className="mt-1.5 text-[11px] text-indigo-800 font-mono bg-white p-2 rounded border border-indigo-200">
                        Evidence Grounding: &ldquo;{res.supporting_quote}&rdquo;
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
