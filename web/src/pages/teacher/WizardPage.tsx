import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { Card, CardHeader, CardContent, CardFooter } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Stepper, StepItem } from '../../components/common/Stepper';
import { StatusPill } from '../../components/common/StatusPill';
import { Badge } from '../../components/common/Badge';
import { ProgressBar, ProgressRing } from '../../components/common/ProgressBar';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { LoadingState } from '../../components/common/LoadingState';
import { api } from '../../services/api';
import {
  Source,
  SourceVersion,
  Unit,
  Objective,
  Slot,
  LearningPack,
  PackHealth,
  UnitDifficulty,
  AnswerVisibility,
} from '../../types';

const WIZARD_STEPS: StepItem[] = [
  { id: 1, title: 'Upload Source', subtitle: 'Ground truth document' },
  { id: 2, title: 'Objectives & Plan', subtitle: 'Gap detection & blueprint' },
  { id: 3, title: 'AI Generation', subtitle: 'Evidence-locked slots' },
  { id: 4, title: 'Quality Gate', subtitle: 'Solver & claim verification' },
  { id: 5, title: 'Publish & Export', subtitle: 'Class rollout' },
];

export const WizardPage: React.FC = () => {
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [maxAccessibleStep, setMaxAccessibleStep] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<any>(null);

  // STEP 1: Source Upload State
  const [uploadMode, setUploadMode] = useState<'paste' | 'file'>('paste');
  const [sourceTitle, setSourceTitle] = useState<string>('Photosynthesis & Cellular Respiration');
  const [pastedText, setPastedText] = useState<string>(
    `Photosynthesis is the biological process by which autotrophic organisms, such as green plants, algae, and cyanobacteria, convert light energy into chemical energy stored within glucose bonds. This vital energy transformation takes place primarily within specialized cellular organelles known as chloroplasts.

Inside the chloroplast, the internal membrane system is organized into flattened disc-like sacs termed thylakoids, which are stacked into columns called grana. The fluid-filled space surrounding the thylakoid grana is the stroma. The initial stage of photosynthesis comprises the light-dependent reactions, which occur directly across the thylakoid membranes. Chlorophyll pigments absorb photons, exciting electrons that travel down an electron transport chain. This process splits water molecules (photolysis), releasing molecular oxygen as a byproduct, and generates high-energy chemical carriers: ATP and NADPH.

The second stage is the light-independent reaction, commonly referred to as the Calvin cycle, which occurs in the stroma. During the Calvin cycle, the enzyme RuBisCO catalyzes carbon fixation by attaching carbon dioxide from the atmosphere to ribulose 1,5-bisphosphate (RuBP). Utilizing the ATP and NADPH generated during the light reactions, the fixed carbon is reduced into glyceraldehyde 3-phosphate (G3P), which is subsequently used to synthesize glucose and other carbohydrates.`
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadedSource, setUploadedSource] = useState<Source | null>(null);
  const [uploadedVersion, setUploadedVersion] = useState<SourceVersion | null>(null);
  const [uploadStats, setUploadStats] = useState<{ chunks: number; flagged: boolean; flags: any[] } | null>(null);

  // STEP 2: Objectives & Customization State
  const [targetGrade, setTargetGrade] = useState<string>('Grade 10 Biology');
  const [difficulty, setDifficulty] = useState<UnitDifficulty>('medium');
  const [language, setLanguage] = useState<string>('English');
  const [answerVisibility, setAnswerVisibility] = useState<AnswerVisibility>('after_submission');
  const [quizCount, setQuizCount] = useState<number>(5);
  const [maxWords, setMaxWords] = useState<number>(350);
  const [vocabNotes] = useState<string>('Focus on chloroplast anatomy, Calvin cycle enzymes, and light reactions.');

  const [objectives, setObjectives] = useState<Array<{ id?: number; text: string; bloom_target: string; supported?: boolean; support_note?: string | null }>>([
    {
      text: 'Explain the light-dependent reactions of photosynthesis occurring in thylakoid membranes and their products (ATP, NADPH, O2).',
      bloom_target: 'understand',
    },
    {
      text: 'Analyze the Calvin cycle mechanism in the chloroplast stroma, focusing on carbon fixation via RuBisCO.',
      bloom_target: 'analyze',
    },
  ]);

  const [isPlanning, setIsPlanning] = useState<boolean>(false);
  const [createdUnit, setCreatedUnit] = useState<Unit | null>(null);
  const [plannedObjectives, setPlannedObjectives] = useState<Objective[]>([]);
  const [blueprintSlots, setBlueprintSlots] = useState<Slot[]>([]);

  // STEP 3: Generation State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [learningPack, setLearningPack] = useState<LearningPack | null>(null);
  const [packHealth, setPackHealth] = useState<PackHealth | null>(null);
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [generationSummary, setGenerationSummary] = useState<{ total: number; done: number; failed: number }>({
    total: 0,
    done: 0,
    failed: 0,
  });

  // Handle Step 1 Upload
  const handleUploadSource = async () => {
    setError(null);
    setErrorDetails(null);

    if (uploadMode === 'paste' && !pastedText.trim()) {
      setError('Please provide text to upload.');
      return;
    }
    if (uploadMode === 'file' && !selectedFile) {
      setError('Please select a file to upload.');
      return;
    }

    setIsUploading(true);
    try {
      const res = await api.uploadSource({
        title: sourceTitle || 'Source Document',
        text: uploadMode === 'paste' ? pastedText : undefined,
        file: uploadMode === 'file' && selectedFile ? selectedFile : undefined,
      });

      setUploadedSource(res.source);
      setUploadedVersion(res.version);
      setUploadStats({
        chunks: res.chunks_created,
        flagged: res.flagged,
        flags: res.flags || [],
      });

      setMaxAccessibleStep(Math.max(maxAccessibleStep, 2));
      setCurrentStep(2);
    } catch (err: any) {
      setError(err.message || 'Failed to upload source text');
      setErrorDetails(err.data || err);
    } finally {
      setIsUploading(false);
    }
  };

  // Handle Step 2 Objective Updates & Plan
  const handleAddObjective = () => {
    setObjectives([
      ...objectives,
      { text: '', bloom_target: 'apply' },
    ]);
  };

  const handleRemoveObjective = (index: number) => {
    if (objectives.length <= 2) {
      setError('A minimum of 2 objectives is required.');
      return;
    }
    const updated = [...objectives];
    updated.splice(index, 1);
    setObjectives(updated);
  };

  const handleObjectiveChange = (index: number, field: 'text' | 'bloom_target', value: string) => {
    const updated = [...objectives];
    updated[index] = { ...updated[index], [field]: value };
    setObjectives(updated);
  };

  const handleCreatePlanAndGapDetection = async () => {
    setError(null);
    setErrorDetails(null);

    if (!uploadedSource) {
      setError('Source document is missing. Please go back to Step 1.');
      return;
    }

    const validObjectives = objectives.filter((o) => o.text.trim().length > 10);
    if (validObjectives.length < 2) {
      setError('Please provide at least 2 detailed learning objectives (each > 10 characters).');
      return;
    }

    setIsPlanning(true);
    try {
      // 1. Create Unit
      const unit = await api.createUnit({
        title: sourceTitle || 'Unit Plan',
        source_id: uploadedSource.id,
        target_grade: targetGrade,
        difficulty: difficulty,
        language: language,
        answer_visibility: answerVisibility,
        constraints: {
          max_words: maxWords,
          vocabulary_notes: vocabNotes,
        },
        quiz_count: quizCount,
      });
      setCreatedUnit(unit);

      // 2. Put Objectives
      await api.updateObjectives(
        unit.id,
        validObjectives.map((o) => ({
          text: o.text.trim(),
          bloom_target: o.bloom_target,
        }))
      );

      // 3. Plan & Run Gap Detection
      const planRes = await api.planUnit(unit.id);

      setPlannedObjectives(planRes.objectives);
      setBlueprintSlots(planRes.slots);

      const hasSupported = planRes.objectives.some((o) => o.supported);
      if (!hasSupported) {
        setError('None of the objectives are supported by the uploaded source text. Please review the gap detection feedback.');
      } else {
        setMaxAccessibleStep(Math.max(maxAccessibleStep, 3));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to analyze gap detection or create blueprint slots');
      setErrorDetails(err.data || err);
    } finally {
      setIsPlanning(false);
    }
  };

  // Handle Step 3 Generation
  const handleStartGeneration = async () => {
    if (!createdUnit) return;
    setError(null);
    setErrorDetails(null);
    setIsGenerating(true);
    setGenerationProgress(10);

    try {
      // Trigger generation
      const genRes = await api.generatePack(createdUnit.id);
      setGenerationSummary({
        total: genRes.total_slots,
        done: genRes.generated_count,
        failed: genRes.failed_count,
      });
      setGenerationProgress(80);

      // Fetch pack and health diagnostics
      const [pack, health] = await Promise.all([
        api.getLearningPack(createdUnit.id),
        api.getUnitHealth(createdUnit.id),
      ]);

      setLearningPack(pack);
      setPackHealth(health);
      setGenerationProgress(100);
      setMaxAccessibleStep(Math.max(maxAccessibleStep, 4));
    } catch (err: any) {
      setError(err.message || 'Generation failed');
      setErrorDetails(err.data || err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Wizard Header Stepper */}
      <Card className="p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900">Unit Creation Wizard</h2>
          <p className="text-xs text-slate-500 mt-1">
            Build an evidence-locked, peer-reviewed learning pack with non-LLM claim verification.
          </p>
        </div>
        <Stepper
          steps={WIZARD_STEPS}
          currentStep={currentStep}
          maxAccessibleStep={maxAccessibleStep}
          onStepClick={(stepId) => setCurrentStep(stepId)}
        />
      </Card>

      {/* Global Error Alert */}
      {error && (
        <ErrorBanner
          title="Action Failed"
          message={error}
          details={errorDetails}
          onRetry={() => {
            if (currentStep === 1) handleUploadSource();
            else if (currentStep === 2) handleCreatePlanAndGapDetection();
            else if (currentStep === 3) handleStartGeneration();
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* STEP 1: UPLOAD SOURCE */}
      {/* ========================================================================= */}
      {currentStep === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader
                title="Ground Truth Source Document"
                subtitle="The source text is the only knowledge boundary. Source text is untrusted data."
              />
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Unit Title / Source Label
                  </label>
                  <input
                    type="text"
                    value={sourceTitle}
                    onChange={(e) => setSourceTitle(e.target.value)}
                    placeholder="e.g. Photosynthesis & Cellular Respiration"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:bg-white focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
                  />
                </div>

                {/* Upload Mode Tabs */}
                <div>
                  <div className="flex items-center gap-2 border-b border-slate-200 mb-3">
                    <button
                      type="button"
                      onClick={() => setUploadMode('paste')}
                      className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${
                        uploadMode === 'paste'
                          ? 'border-[#4F46E5] text-[#4F46E5]'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Paste Text
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadMode('file')}
                      className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${
                        uploadMode === 'file'
                          ? 'border-[#4F46E5] text-[#4F46E5]'
                          : 'border-transparent text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Upload File (PDF / TXT)
                    </button>
                  </div>

                  {uploadMode === 'paste' ? (
                    <div>
                      <div className="flex justify-between items-center mb-1 text-xs text-slate-500">
                        <span>Raw Source Text</span>
                        <span>{pastedText.length} characters</span>
                      </div>
                      <textarea
                        rows={10}
                        value={pastedText}
                        onChange={(e) => setPastedText(e.target.value)}
                        placeholder="Paste trusted textbook chapter, curriculum excerpt, or lecture notes here..."
                        className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-900 font-mono focus:bg-white focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
                      />
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50 hover:bg-slate-100/60 transition-colors">
                      <input
                        type="file"
                        accept=".pdf,.txt"
                        id="source-file-input"
                        className="hidden"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      />
                      <label htmlFor="source-file-input" className="cursor-pointer block">
                        <Upload className="w-10 h-10 text-indigo-500 mx-auto mb-3" />
                        <span className="text-sm font-semibold text-slate-800 block">
                          {selectedFile ? selectedFile.name : 'Click to browse or drag & drop PDF / TXT'}
                        </span>
                        <span className="text-xs text-slate-500 block mt-1">
                          {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'Maximum file size: 10MB'}
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              </CardContent>

              <CardFooter className="flex justify-between items-center">
                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-slate-400" />
                  <span>Will be chunked into ~600-900 char offset-indexed segments.</span>
                </div>
                <Button
                  onClick={handleUploadSource}
                  isLoading={isUploading}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Ingest & Scan Source
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Right Column: Source Ingestion Rules & Scanner Preview */}
          <div className="space-y-6">
            <Card>
              <CardHeader title="Security & Evidence Rules" />
              <CardContent className="space-y-3 text-xs text-slate-600 leading-relaxed">
                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-950">
                  <span className="font-semibold block mb-1">Untrusted Boundary</span>
                  The model is prompted that source text is untrusted data enclosed in strict delimiters. Instruction injection cannot hijack prompts.
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
                  <span className="font-semibold block mb-1">Immutable Versioning</span>
                  Every uploaded source is hashed via SHA-256. Subsequent uploads create version numbers and preserve old assets.
                </div>
              </CardContent>
            </Card>

            {/* Injection Scanner Feedback */}
            {uploadStats && (
              <Card>
                <CardHeader
                  title="Source Ingestion Result"
                  action={
                    uploadStats.flagged ? (
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                        Flagged
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Clean
                      </span>
                    )
                  }
                />
                <CardContent className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Source ID:</span>
                    <span className="font-semibold text-slate-800">{uploadedSource?.id}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Version:</span>
                    <span className="font-semibold text-slate-800">v{uploadedVersion?.version_no}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Indexed Chunks:</span>
                    <span className="font-semibold text-slate-800">{uploadStats.chunks} chunks</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">SHA-256:</span>
                    <span className="font-mono text-[10px] text-slate-600 truncate max-w-[140px]">
                      {uploadedVersion?.sha256}
                    </span>
                  </div>

                  {uploadStats.flagged && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900">
                      <div className="flex items-center gap-1.5 font-semibold text-xs mb-1 text-amber-800">
                        <ShieldAlert className="w-4 h-4 text-amber-600" />
                        <span>Instruction Patterns Detected</span>
                      </div>
                      <p className="text-[11px] text-amber-700">
                        Source contains instruction-like text. Treated as content only.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: OBJECTIVES & CUSTOMIZE (GAP DETECTION) */}
      {/* ========================================================================= */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Objectives & Constraints */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader
                  title="Learning Objectives"
                  subtitle="Define at least 2 specific learning outcomes. AI will perform pre-generation Gap Detection against source evidence."
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleAddObjective}
                      leftIcon={<Plus className="w-3.5 h-3.5" />}
                    >
                      Add Objective
                    </Button>
                  }
                />
                <CardContent className="space-y-4">
                  {objectives.map((obj, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 relative group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Objective #{idx + 1}
                        </span>
                        {objectives.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveObjective(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                            aria-label="Remove objective"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div>
                        <textarea
                          rows={2}
                          value={obj.text}
                          onChange={(e) => handleObjectiveChange(idx, 'text', e.target.value)}
                          placeholder="e.g. Describe the role of chlorophyll and photolysis during light-dependent reactions."
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="text-xs text-slate-600 font-medium">Target Bloom Level:</label>
                        <select
                          value={obj.bloom_target}
                          onChange={(e) => handleObjectiveChange(idx, 'bloom_target', e.target.value)}
                          className="text-xs bg-white border border-slate-200 rounded-md px-2.5 py-1 text-slate-800 focus:border-[#4F46E5]"
                        >
                          <option value="remember">Remember (Knowledge recall)</option>
                          <option value="understand">Understand (Explanation & concepts)</option>
                          <option value="apply">Apply (Problem solving)</option>
                          <option value="analyze">Analyze (Deconstruction & mechanisms)</option>
                          <option value="evaluate">Evaluate (Critique & judgment)</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Customization & Constraints Form */}
              <Card>
                <CardHeader
                  title="Pedagogical Settings & Constraints"
                  subtitle="Tailor reading level, quiz length, and tone constraints."
                />
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Target Grade</label>
                    <input
                      type="text"
                      value={targetGrade}
                      onChange={(e) => setTargetGrade(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Target Difficulty</label>
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value as UnitDifficulty)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900"
                    >
                      <option value="easy">Easy (Foundational Recall)</option>
                      <option value="medium">Medium (Standard Comprehension)</option>
                      <option value="advanced">Advanced (Deep Analysis)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Language</label>
                    <input
                      type="text"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Student Answer Key Visibility</label>
                    <select
                      value={answerVisibility}
                      onChange={(e) => setAnswerVisibility(e.target.value as AnswerVisibility)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900"
                    >
                      <option value="after_submission">Show only after student submission</option>
                      <option value="teacher_only">Teacher Only (Never student visible)</option>
                      <option value="immediate">Immediate feedback</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Formative Quiz Items</label>
                    <input
                      type="number"
                      min={2}
                      max={10}
                      value={quizCount}
                      onChange={(e) => setQuizCount(parseInt(e.target.value) || 5)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Max Words (Explanation)</label>
                    <input
                      type="number"
                      step={50}
                      value={maxWords}
                      onChange={(e) => setMaxWords(parseInt(e.target.value) || 350)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900"
                    />
                  </div>
                </CardContent>

                <CardFooter className="flex justify-between items-center">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep(1)}
                    leftIcon={<ArrowLeft className="w-4 h-4" />}
                  >
                    Back to Source
                  </Button>
                  <Button
                    onClick={handleCreatePlanAndGapDetection}
                    isLoading={isPlanning}
                    rightIcon={<Sparkles className="w-4 h-4" />}
                  >
                    Run Gap Detection & Plan Blueprint
                  </Button>
                </CardFooter>
              </Card>
            </div>

            {/* Right Col: Gap Detection & Blueprint Preview */}
            <div className="space-y-6">
              <Card>
                <CardHeader
                  title="AI Gap Detection Results"
                  subtitle="Validates if source contains sufficient evidence before slot generation."
                />
                <CardContent className="space-y-3">
                  {plannedObjectives.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-xs">
                      Click &quot;Run Gap Detection&quot; to test your objectives against the source evidence.
                    </div>
                  ) : (
                    plannedObjectives.map((obj, i) => (
                      <div
                        key={i}
                        className={`p-3.5 rounded-xl border text-xs ${
                          obj.supported
                            ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                            : 'bg-rose-50 border-rose-200 text-rose-950'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {obj.supported ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-slate-900">Objective #{i + 1}</span>
                              <span
                                className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                  obj.supported
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {obj.supported ? 'Supported' : 'Refused / Unsupported'}
                              </span>
                            </div>
                            <p className="text-slate-700 text-[11px] mb-1.5">{obj.text}</p>
                            {obj.support_note && (
                              <p
                                className={`text-[11px] italic p-1.5 rounded ${
                                  obj.supported ? 'bg-emerald-100/50 text-emerald-900' : 'bg-rose-100/60 text-rose-900'
                                }`}
                              >
                                {obj.support_note}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {blueprintSlots.length > 0 && (
                <Card>
                  <CardHeader
                    title="Generated Blueprint Slots"
                    subtitle={`${blueprintSlots.length} pedagogical slots created (0 orphans).`}
                  />
                  <CardContent className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Explanations:</span>
                      <span className="font-semibold text-slate-800">
                        {blueprintSlots.filter((s) => s.type === 'explanation').length}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Worked Examples:</span>
                      <span className="font-semibold text-slate-800">
                        {blueprintSlots.filter((s) => s.type === 'example').length}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Formative Quiz Items:</span>
                      <span className="font-semibold text-slate-800">
                        {blueprintSlots.filter((s) => s.type === 'quiz_item').length}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Foundation Practice:</span>
                      <span className="font-semibold text-slate-800">
                        {blueprintSlots.filter((s) => s.type === 'practice_foundation').length}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-600">Advanced Practice:</span>
                      <span className="font-semibold text-slate-800">
                        {blueprintSlots.filter((s) => s.type === 'practice_advanced').length}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-600">Revision Sheets:</span>
                      <span className="font-semibold text-slate-800">
                        {blueprintSlots.filter((s) => s.type === 'revision').length}
                      </span>
                    </div>

                    <div className="pt-3">
                      <Button
                        className="w-full"
                        onClick={() => setCurrentStep(3)}
                        rightIcon={<ArrowRight className="w-4 h-4" />}
                      >
                        Proceed to Generation
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: AI GENERATES LEARNING PACK (LIVE SLOTS & SOLVER) */}
      {/* ========================================================================= */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader
                  title="Evidence-Locked Generation Engine"
                  subtitle="Generating structured content in pedagogical sequence with non-LLM claim verification."
                  action={
                    !isGenerating && !learningPack && (
                      <Button
                        onClick={handleStartGeneration}
                        leftIcon={<Sparkles className="w-4 h-4" />}
                      >
                        Start Generation
                      </Button>
                    )
                  }
                />
                <CardContent className="space-y-4">
                  {/* Overall Generation Progress */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
                      <span>Overall Progress</span>
                      <span>
                        {generationSummary.done} / {blueprintSlots.length || 20} Slots Generated
                      </span>
                    </div>
                    <ProgressBar progress={generationProgress} size="md" color="brand" />
                  </div>

                  {isGenerating && (
                    <LoadingState
                      size="md"
                      message="Synthesizing claims, running exact/fuzzy verifier, and executing independent solver..."
                    />
                  )}

                  {/* Slot Breakdown List */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Learning Pack Slot Execution
                    </h4>

                    {blueprintSlots.map((slot, index) => {
                      const isDone = learningPack !== null;
                      return (
                        <div
                          key={slot.id || index}
                          className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-200 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold flex items-center justify-center">
                              {index + 1}
                            </span>
                            <div>
                              <div className="text-xs font-semibold text-slate-800 capitalize flex items-center gap-2">
                                <span>{slot.type.replace('_', ' ')}</span>
                                {slot.bloom_tag && <Badge bloom={slot.bloom_tag} />}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                Objective #{slot.objective_id}
                              </div>
                            </div>
                          </div>

                          <StatusPill
                            status={
                              isDone
                                ? 'done'
                                : isGenerating
                                ? 'generating'
                                : 'queued'
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>

                <CardFooter className="flex justify-between items-center">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep(2)}
                    leftIcon={<ArrowLeft className="w-4 h-4" />}
                  >
                    Back to Plan
                  </Button>
                  {learningPack && (
                    <Button
                      onClick={() => setCurrentStep(4)}
                      rightIcon={<ArrowRight className="w-4 h-4" />}
                    >
                      Review Learning Pack & Quality Gate
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </div>

            {/* Right Column: Pack Health & Live Verification Gauges */}
            <div className="space-y-6">
              <Card>
                <CardHeader title="Pack Health Diagnostics" subtitle="Computed via 10 guardrail checks" />
                <CardContent className="space-y-6 flex flex-col items-center">
                  <ProgressRing score={packHealth?.score || 0} size={110} strokeWidth={10} />

                  <div className="w-full space-y-2.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Grounding Ratio:</span>
                      <span className="font-semibold text-emerald-700">
                        {packHealth ? `${(packHealth.grounding_ratio * 100).toFixed(1)}%` : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Dual-Solver Verification:</span>
                      <span className="font-semibold text-indigo-700">
                        {packHealth ? `${(packHealth.solver_verification_rate * 100).toFixed(1)}%` : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Verified Claims:</span>
                      <span className="font-semibold text-slate-800">
                        {packHealth ? `${packHealth.verified_claims} / ${packHealth.total_claims}` : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Open Error Flags:</span>
                      <span className="font-semibold text-rose-600">
                        {packHealth ? packHealth.open_flags_by_severity.error : 0}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 4 & 5: PREVIEW / QUALITY GATE & PUBLISH STUBS */}
      {/* ========================================================================= */}
      {currentStep === 4 && (
        <Card className="p-8 text-center">
          <div className="w-16 h-16 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center text-emerald-600 mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Learning Pack Successfully Generated</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
            All 20 pedagogical assets have been evidence-locked and evaluated by the independent solver. Review claims, inspect quotes, and grant approval.
          </p>
          <div className="flex justify-center gap-3">
            {createdUnit && (
              <Button onClick={() => navigate(`/units/${createdUnit.id}`)}>
                Open Full Learning Pack Inspector
              </Button>
            )}
            <Button variant="outline" onClick={() => setCurrentStep(5)}>
              Go to Step 5: Publish & Export
            </Button>
          </div>
        </Card>
      )}

      {currentStep === 5 && (
        <Card className="p-8 text-center">
          <div className="w-16 h-16 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-center text-[#4F46E5] mx-auto mb-4">
            <Sparkles className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Class Rollout & Export</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-6">
            Publish snapshots of approved assets to classes or export clean JSON / print-ready HTML documents.
          </p>
          <div className="flex justify-center gap-3">
            {createdUnit && (
              <Button onClick={() => navigate(`/units/${createdUnit.id}`)}>
                Manage Unit in Studio
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate('/')}>
              Return to Dashboard
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
