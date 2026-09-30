import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  FileText,
  X,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ShieldAlert,
  ShieldCheck,
  FileCheck,
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
  const [uploadMode, setUploadMode] = useState<'file' | 'paste' | null>(null);
  const [sourceTitle, setSourceTitle] = useState<string>('');
  const [pastedText, setPastedText] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadedSource, setUploadedSource] = useState<Source | null>(null);
  const [uploadedVersion, setUploadedVersion] = useState<SourceVersion | null>(null);
  const [uploadStats, setUploadStats] = useState<{ chunks: number; flagged: boolean; flags: any[] } | null>(null);
  const [expandedRules, setExpandedRules] = useState<Record<string, boolean>>({});

  // Mode Switch Handler - Exclusive Selection with automatic clearing
  const handleModeChange = (mode: 'file' | 'paste') => {
    if (mode === uploadMode) return;
    setUploadMode(mode);
    setError(null);
    setErrorDetails(null);
    // Exclusive selection: Clear the other input to prevent accidental submission of both
    if (mode === 'paste') {
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } else {
      setPastedText('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setErrorDetails(null);
    const file = e.target.files?.[0] || null;
    if (!file) {
      setSelectedFile(null);
      return;
    }
    const lowerName = file.name.toLowerCase();
    const isAllowed = lowerName.endsWith('.pdf') || lowerName.endsWith('.txt') || lowerName.endsWith('.md');
    if (!isAllowed) {
      setError('Invalid file type. Please upload a PDF (.pdf) or Text (.txt, .md) file.');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }
    if (file.size === 0) {
      setError('The selected file is empty (0 bytes). Please select a valid document.');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
      setError('File size exceeds the 10MB limit. Please upload a smaller document.');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }
    setSelectedFile(file);
    if (!sourceTitle.trim()) {
      setSourceTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '));
    }
  };

  const handleClearSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // STEP 2: Objectives & Customization State
  const [targetGrade, setTargetGrade] = useState<string>('');
  const [difficulty, setDifficulty] = useState<UnitDifficulty | ''>('');
  const [language, setLanguage] = useState<string>('');
  const [answerVisibility, setAnswerVisibility] = useState<AnswerVisibility | ''>('');
  const [quizCount, setQuizCount] = useState<number | ''>('');
  const [maxWords, setMaxWords] = useState<number | ''>('');
  const [vocabNotes] = useState<string>('');

  const [objectives, setObjectives] = useState<Array<{ id?: number; text: string; bloom_target: string; supported?: boolean; support_note?: string | null }>>([
    {
      text: '',
      bloom_target: '',
    },
    {
      text: '',
      bloom_target: '',
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

    if (!sourceTitle.trim()) {
      setError('Please enter a Unit Title / Source Label before proceeding.');
      return;
    }

    if (!uploadMode) {
      setError('Please choose an input method (Upload File or Paste Text).');
      return;
    }

    if (uploadMode === 'paste') {
      const trimmed = pastedText.trim();
      if (!trimmed) {
        setError('Please enter or paste source text before proceeding.');
        return;
      }
      if (trimmed.length < 50) {
        setError('Source text is too short. Please provide at least 50 characters of educational content.');
        return;
      }
      if (trimmed.length > 150000) {
        setError('Source text exceeds the maximum allowed limit of 150,000 characters.');
        return;
      }
    } else if (uploadMode === 'file') {
      if (!selectedFile) {
        setError('Please select a file to upload before proceeding.');
        return;
      }
      const lowerName = selectedFile.name.toLowerCase();
      const isAllowed = lowerName.endsWith('.pdf') || lowerName.endsWith('.txt') || lowerName.endsWith('.md');
      if (!isAllowed) {
        setError('Unsupported file format. Please upload a PDF (.pdf) or Text (.txt, .md) file.');
        return;
      }
      if (selectedFile.size === 0) {
        setError('The selected file is empty (0 bytes).');
        return;
      }
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('File size exceeds the 10MB limit.');
        return;
      }
    }

    setIsUploading(true);
    try {
      // Send strictly ONLY the selected input method to the backend
      const payload = uploadMode === 'paste'
        ? {
            title: sourceTitle.trim() || 'Pasted Source Text',
            text: pastedText.trim(),
          }
        : {
            title: sourceTitle.trim() || selectedFile!.name.replace(/\.[^/.]+$/, ''),
            file: selectedFile!,
          };

      const res = await api.uploadSource(payload);

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
      { text: '', bloom_target: '' },
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

    const missingBloom = validObjectives.some((o) => !o.bloom_target);
    if (missingBloom) {
      setError('Please select a target Bloom level for each learning objective.');
      return;
    }

    if (!targetGrade.trim()) {
      setError('Please enter a target grade.');
      return;
    }

    if (!difficulty) {
      setError('Please select a target difficulty.');
      return;
    }

    if (!language.trim()) {
      setError('Please enter a language.');
      return;
    }

    if (!answerVisibility) {
      setError('Please select student answer key visibility.');
      return;
    }

    const parsedQuizCount = typeof quizCount === 'number' ? quizCount : parseInt(String(quizCount), 10);
    if (isNaN(parsedQuizCount) || parsedQuizCount < 5) {
      setError('Please enter at least 5 formative quiz items.');
      return;
    }

    const parsedMaxWords = typeof maxWords === 'number' ? maxWords : parseInt(String(maxWords), 10);
    if (isNaN(parsedMaxWords) || parsedMaxWords <= 0) {
      setError('Please enter max words for explanation.');
      return;
    }

    setIsPlanning(true);
    try {
      // 1. Create Unit
      const unit = await api.createUnit({
        title: sourceTitle || 'Unit Plan',
        source_id: uploadedSource.id,
        target_grade: targetGrade.trim(),
        difficulty: difficulty as UnitDifficulty,
        language: language.trim(),
        answer_visibility: answerVisibility as AnswerVisibility,
        constraints: {
          max_words: parsedMaxWords,
          vocabulary_notes: vocabNotes,
        },
        quiz_count: Math.max(5, parsedQuizCount),
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
      <Card className="p-6 sm:p-7">
        <div className="mb-6">
          <h2
            title="Generate evidence-locked learning packs from verified source texts."
            className="text-xl sm:text-2xl font-black tracking-tight text-[var(--text-primary)] cursor-help inline-block"
          >
            Create New Learning Unit
          </h2>
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
                title={
                  <span className="flex items-center gap-2">
                    <span>Ground Truth Source Document</span>
                    <span
                      title="Source is the untrusted, immutable knowledge boundary."
                      className="inline-flex items-center text-slate-400 hover:text-indigo-600 transition-colors cursor-help"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </span>
                  </span>
                }
              />
              <CardContent className="space-y-5 p-6">
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

                {/* Input Options: Exclusive Selection */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Input Method <span className="text-indigo-600 font-normal lowercase">(choose one)</span>
                    </label>
                    <span className="text-[11px] font-medium text-slate-500">
                      Active mode:{' '}
                      <span className="font-semibold text-indigo-600">
                        {uploadMode === 'file' ? 'Upload File' : uploadMode === 'paste' ? 'Paste Text' : 'None (select one)'}
                      </span>
                    </span>
                  </div>

                  <div
                    role="tablist"
                    aria-label="Source Input Method"
                    className="grid grid-cols-2 gap-3 p-1.5 bg-slate-100/80 rounded-2xl mb-4 border border-slate-200/80"
                  >
                    <button
                      type="button"
                      role="tab"
                      id="tab-upload-file"
                      aria-selected={uploadMode === 'file'}
                      onClick={() => handleModeChange('file')}
                      className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                        uploadMode === 'file'
                          ? 'bg-[#4F46E5] text-white shadow-md shadow-indigo-600/25 scale-[1.01]'
                          : 'bg-white/90 hover:bg-white text-slate-700 hover:text-indigo-600 border border-slate-200/60'
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                          uploadMode === 'file' ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-600'
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                      </div>
                      <span>Upload File (PDF / Text)</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      id="tab-paste-text"
                      aria-selected={uploadMode === 'paste'}
                      onClick={() => handleModeChange('paste')}
                      className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                        uploadMode === 'paste'
                          ? 'bg-[#4F46E5] text-white shadow-md shadow-indigo-600/25 scale-[1.01]'
                          : 'bg-white/90 hover:bg-white text-slate-700 hover:text-indigo-600 border border-slate-200/60'
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                          uploadMode === 'paste' ? 'bg-white/20 text-white' : 'bg-purple-50 text-purple-600'
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <span>Paste Text</span>
                    </button>
                  </div>

                  {uploadMode === null && (
                    <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-7 text-center bg-slate-50/50 dark:bg-slate-800/20 flex flex-col items-center justify-center gap-2">
                      <Upload className="w-5 h-5 text-slate-400" />
                      <p className="text-xs font-medium text-slate-500">Choose a method above</p>
                    </div>
                  )}

                  {uploadMode === 'paste' && (
                    <div>
                      <div className="flex justify-between items-center mb-1 text-xs text-slate-500">
                        <span className="font-medium text-slate-700">Raw Source Text</span>
                        <span className={`${pastedText.length > 0 && pastedText.trim().length < 50 ? 'text-amber-600 font-medium' : 'text-slate-500'}`}>
                          {pastedText.length} characters {pastedText.length > 0 && pastedText.trim().length < 50 ? '(min 50 required)' : ''}
                        </span>
                      </div>
                      <textarea
                        id="source-paste-textarea"
                        rows={10}
                        value={pastedText}
                        onChange={(e) => setPastedText(e.target.value)}
                        placeholder="Paste trusted textbook chapter, curriculum excerpt, or lecture notes here (minimum 50 characters)..."
                        className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs leading-relaxed text-slate-900 font-mono focus:bg-white focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] placeholder:text-slate-400"
                      />
                      {pastedText && (
                        <div className="flex justify-end mt-1.5">
                          <button
                            type="button"
                            onClick={() => setPastedText('')}
                            className="text-xs text-slate-400 hover:text-rose-600 transition-colors"
                          >
                            Clear text
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {uploadMode === 'file' && (
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.txt,.md"
                        id="source-file-input"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                      {selectedFile ? (
                        <div className="border border-indigo-200 bg-indigo-50/40 rounded-xl p-5 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                <span>{selectedFile.name}</span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-indigo-100 text-indigo-700">
                                  {selectedFile.name.split('.').pop()}
                                </span>
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                {(selectedFile.size / 1024).toFixed(1)} KB &bull; Ready to ingest
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleClearSelectedFile}
                            title="Remove file"
                            aria-label="Remove selected file"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label
                          htmlFor="source-file-input"
                          className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50 hover:bg-slate-100/60 hover:border-indigo-400 transition-all cursor-pointer block"
                        >
                          <Upload className="w-10 h-10 text-indigo-500 mx-auto mb-3" />
                          <span className="text-sm font-semibold text-slate-800 block">
                            Click to browse or drag &amp; drop PDF / TXT
                          </span>
                          <span className="text-xs text-slate-500 block mt-1">
                            Supported formats: .pdf, .txt, .md &bull; Maximum file size: 10MB
                          </span>
                        </label>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>

              <CardFooter className="flex justify-between items-center">
                <div
                  className="text-xs text-slate-500 flex items-center gap-1.5 cursor-help whitespace-nowrap shrink-0"
                  title="Source will be chunked into ~600-900 char offset-indexed segments"
                >
                  <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Offset-Indexed Chunks</span>
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
              <CardContent className="space-y-3 text-xs">
                {/* Rule 1: Untrusted Boundary */}
                <div
                  onClick={() =>
                    setExpandedRules((prev) => ({ ...prev, boundary: !prev.boundary }))
                  }
                  className="p-3.5 bg-indigo-50/70 hover:bg-indigo-50 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl cursor-pointer transition-all duration-150"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-indigo-950 dark:text-indigo-200">
                      <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span>Untrusted Boundary Isolation</span>
                    </div>
                    <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold shrink-0 hover:underline">
                      {expandedRules.boundary ? 'Hide' : 'Explain'}
                    </span>
                  </div>
                  {expandedRules.boundary && (
                    <p className="text-[11px] text-indigo-800 dark:text-indigo-300 mt-2.5 pt-2.5 border-t border-indigo-200/60 dark:border-indigo-800/40 leading-relaxed">
                      Source text is strictly isolated in delimiters to block prompt hijacking. The model is instructed that source text is untrusted data, ensuring instruction injection cannot hijack prompts or leak internal secrets.
                    </p>
                  )}
                </div>

                {/* Rule 2: Immutable Versioning */}
                <div
                  onClick={() =>
                    setExpandedRules((prev) => ({ ...prev, versioning: !prev.versioning }))
                  }
                  className="p-3.5 bg-slate-50 hover:bg-slate-100/70 dark:bg-slate-800/40 dark:hover:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl cursor-pointer transition-all duration-150"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                      <FileCheck className="w-4 h-4 text-slate-600 dark:text-slate-400 shrink-0" />
                      <span>SHA-256 Immutable Versioning</span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold shrink-0 hover:underline">
                      {expandedRules.versioning ? 'Hide' : 'Explain'}
                    </span>
                  </div>
                  {expandedRules.versioning && (
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-2.5 pt-2.5 border-t border-slate-200 dark:border-slate-700/60 leading-relaxed">
                      Every uploaded source version receives a cryptographic SHA-256 hash. Subsequent uploads create version numbers and preserve old assets without overwriting history.
                    </p>
                  )}
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
                          <option value="">Select an option</option>
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
                />
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Target Grade</label>
                    <input
                      type="text"
                      value={targetGrade}
                      onChange={(e) => setTargetGrade(e.target.value)}
                      placeholder="e.g. Grade 10 Biology"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Target Difficulty</label>
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value as UnitDifficulty)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:border-[#4F46E5]"
                    >
                      <option value="">Select an option</option>
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
                      placeholder="e.g. English"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Student Answer Key Visibility</label>
                    <select
                      value={answerVisibility}
                      onChange={(e) => setAnswerVisibility(e.target.value as AnswerVisibility)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:border-[#4F46E5]"
                    >
                      <option value="">Select an option</option>
                      <option value="after_submission">Show only after student submission</option>
                      <option value="teacher_only">Teacher Only (Never student visible)</option>
                      <option value="immediate">Immediate feedback</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Formative Quiz Items <span className="text-slate-400 font-normal">(min 5)</span>
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={15}
                      value={quizCount}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setQuizCount(raw === '' ? '' : parseInt(raw, 10));
                      }}
                      placeholder="e.g. 5"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Max Words (Explanation)</label>
                    <input
                      type="number"
                      step={50}
                      value={maxWords}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setMaxWords(raw === '' ? '' : parseInt(raw, 10));
                      }}
                      placeholder="e.g. 200"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Generation target for the explanatory body. Aims for 90–100% of this target while remaining strictly evidence-locked.
                    </p>
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
                        {generationSummary.done} / {blueprintSlots.length} Slots Generated
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
                      const objNumber =
                        slot.objective_position ||
                        (plannedObjectives.findIndex((o) => o.id === slot.objective_id) !== -1
                          ? plannedObjectives.findIndex((o) => o.id === slot.objective_id) + 1
                          : index % Math.max(1, plannedObjectives.length) + 1);
                      const objText =
                        slot.objective_text ||
                        plannedObjectives.find((o) => o.id === slot.objective_id)?.text ||
                        (plannedObjectives[objNumber - 1]?.text);

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
                                Objective #{objNumber}
                                {objText ? `: ${objText.slice(0, 48)}${objText.length > 48 ? '...' : ''}` : ''}
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
                <CardHeader title="Pack Health Diagnostics" />
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
