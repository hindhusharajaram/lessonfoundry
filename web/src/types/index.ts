export type Role = 'teacher' | 'student';

export type UnitDifficulty = 'easy' | 'medium' | 'advanced';
export type AnswerVisibility = 'immediate' | 'after_submission' | 'teacher_only';
export type AssetStatus = 'draft' | 'approved' | 'needs_revision' | 'generation_failed';
export type SlotType = 'explanation' | 'example' | 'quiz_item' | 'practice_foundation' | 'practice_advanced' | 'revision';
export type FlagSeverity = 'info' | 'warning' | 'error';
export type BloomLevel = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';

export interface SourceChunk {
  id: number;
  source_version_id: number;
  idx: number;
  char_start: number;
  char_end: number;
  page?: number | null;
  text: string;
}

export interface InjectionFlag {
  pattern: string;
  char_start: number;
  char_end: number;
  match_text: string;
}

export interface SourceVersion {
  id: number;
  source_id: number;
  version_no: number;
  text: string;
  sha256: string;
  injection_flags: InjectionFlag[];
  uploaded_at: string;
  chunk_count?: number;
}

export interface Source {
  id: number;
  title: string;
  filename: string;
  created_at: string;
  latest_version?: SourceVersion;
  versions?: SourceVersion[];
}

export interface Objective {
  id?: number;
  unit_id?: number;
  position: number;
  text: string;
  bloom_target?: BloomLevel | string | null;
  supported?: boolean;
  support_note?: string | null;
}

export interface UnitConstraints {
  max_words?: number;
  vocabulary_notes?: string;
  quiz_count?: number;
}

export interface Unit {
  id: number;
  title: string;
  source_id: number;
  pinned_source_version_id: number;
  target_grade: string;
  difficulty: UnitDifficulty;
  language: string;
  answer_visibility: AnswerVisibility;
  constraints: UnitConstraints;
  quiz_count: number;
  status: string;
  created_at: string;
  objectives?: Objective[];
  slots?: Slot[];
}

export interface Slot {
  id: number;
  unit_id: number;
  objective_id: number;
  objective_position?: number;
  objective_text?: string;
  type: SlotType;
  position: number;
  difficulty?: string;
  bloom_tag?: string;
  asset?: Asset;
  objective?: Objective;
}

export interface Claim {
  id: number;
  asset_version_id: number;
  text: string;
  source_quote: string;
  chunk_id: number | null;
  char_start: number | null;
  char_end: number | null;
  verified: boolean;
  match_score: number;
}

export interface AssetVersion {
  id: number;
  asset_id: number;
  version_no: number;
  parent_version_id?: number | null;
  variant: 'standard' | 'simplified';
  content: any;
  model: string;
  prompt_version: string;
  settings: Record<string, any>;
  source_version_id: number;
  source_sha256: string;
  verification?: {
    solver?: {
      solved: boolean;
      chosen_index?: number;
      actual_index?: number;
      quote_verified?: boolean;
      mismatch?: boolean;
      model_family_limitation?: string;
    };
    claims_count?: number;
    verified_claims_count?: number;
    grounding_ratio?: number;
  };
  created_at: string;
  claims?: Claim[];
}

export interface QualityFlag {
  id: number;
  unit_id: number;
  asset_version_id?: number | null;
  code: string;
  severity: FlagSeverity;
  message: string;
  resolved: boolean;
  resolved_by?: string | null;
  created_at: string;
}

export interface Asset {
  id: number;
  slot_id: number;
  status: AssetStatus;
  locked: boolean;
  current_version_id?: number | null;
  current_version?: AssetVersion;
  slot?: Slot;
  quality_flags?: QualityFlag[];
}

export interface PackHealth {
  unit_id: number;
  score: number;
  grounding_ratio: number;
  solver_verification_rate: number;
  duplicate_count: number;
  total_claims: number;
  verified_claims: number;
  total_questions: number;
  verified_questions: number;
  objective_coverage: Record<string, number>;
  bloom_distribution: Record<string, number>;
  open_flags_by_severity: {
    error: number;
    warning: number;
    info: number;
  };
  flags: QualityFlag[];
}

export interface LearningPack {
  unit: Unit;
  health: PackHealth;
  by_objective: {
    objective: Objective;
    slots: {
      slot: Slot;
      asset: Asset | null;
      claims: Claim[];
      flags: QualityFlag[];
    }[];
  }[];
}
