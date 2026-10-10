import {
  Unit,
  Source,
  SourceVersion,
  Objective,
  Slot,
  LearningPack,
  PackHealth,
  Asset,
  AssetVersion,
  Claim,
  QualityFlag,
  Role,
  AttendanceRecord,
  SessionAttendanceReport,
  ClassSessionSummary,
} from '../types';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// Global role headers helper
export function getAuthHeaders(): Record<string, string> {
  const role: Role = (localStorage.getItem('lessonfoundry_role') as Role) || 'teacher';
  const studentId = localStorage.getItem('lessonfoundry_student_id') || '1';
  const userId = localStorage.getItem('lessonfoundry_user_id') || '';
  const email = localStorage.getItem('lessonfoundry_email') || '';

  const headers: Record<string, string> = {
    'X-Role': role,
    'X-Student-Id': studentId,
  };
  if (userId) {
    headers['X-User-Id'] = userId;
  }
  if (email) {
    headers['X-User-Email'] = email;
  }

  return headers;
}

// Base API URL configuration (defaults to empty string for relative proxying in dev, or VITE_API_URL in production)
export const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export function getFullUrl(endpoint: string): string {
  const clean = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const path = clean.startsWith('/api') ? clean : `/api${clean}`;
  return `${API_BASE_URL}${path}`;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = getFullUrl(endpoint);
  const headers = {
    ...getAuthHeaders(),
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      let errData: any = null;
      try {
        errData = await response.json();
      } catch {
        const text = await response.text().catch(() => '');
        errData = { detail: text || response.statusText || `HTTP ${response.status}` };
      }
      let message = errData?.detail || errData?.message;
      if (response.status === 404) {
        message = `API endpoint not found (HTTP 404) at ${url}. If using Vercel, ensure your backend server URL is configured in VITE_API_URL, or use the local server at http://localhost:5173.`;
      } else if (!message) {
        message = `Request failed with status ${response.status}`;
      }
      throw new ApiError(response.status, message, errData);
    }
    return await response.json();
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(500, err.message || 'Network error occurred', err);
  }
}

// Normalization Helpers
function normalizeUploadResponse(raw: any): {
  source: Source;
  version: SourceVersion;
  chunks_created: number;
  flagged: boolean;
  flags: any[];
} {
  const isFlagged = Boolean(raw.injection_flags?.flagged || raw.flagged);
  const flagsList = raw.injection_flags?.matches || raw.flags || [];
  const sourceId = raw.source_id || raw.source?.id || 1;
  const versionId = raw.source_version_id || raw.version?.id || 1;
  const versionNo = raw.version_no || raw.version?.version_no || 1;

  return {
    source: {
      id: sourceId,
      title: raw.source_title || raw.source?.title || 'Source Document',
      filename: raw.source?.filename || raw.filename || 'source.txt',
      created_at: raw.source?.created_at || new Date().toISOString(),
    },
    version: {
      id: versionId,
      source_id: sourceId,
      version_no: versionNo,
      text: raw.text || raw.version?.text || '',
      sha256: raw.sha256 || raw.version?.sha256 || '',
      injection_flags: flagsList,
      uploaded_at: raw.uploaded_at || raw.version?.uploaded_at || new Date().toISOString(),
      chunk_count: raw.chunks_count ?? raw.version?.chunk_count ?? 0,
    },
    chunks_created: raw.chunks_count ?? raw.chunks_created ?? 0,
    flagged: isFlagged,
    flags: flagsList,
  };
}

function normalizeUnitResponse(raw: any): Unit {
  return {
    id: raw.id ?? raw.unit_id,
    title: raw.title,
    source_id: raw.source_id,
    pinned_source_version_id: raw.pinned_source_version_id,
    target_grade: raw.target_grade,
    difficulty: raw.difficulty,
    language: raw.language,
    answer_visibility: raw.answer_visibility || 'after_submission',
    constraints: raw.constraints || {},
    quiz_count: raw.quiz_count,
    status: raw.status,
    created_at: raw.created_at || new Date().toISOString(),
    objectives: raw.objectives || [],
    slots: raw.slots || [],
  };
}

function normalizeHealthResponse(raw: any): PackHealth {
  if (!raw) {
    return {
      unit_id: 0,
      score: 0,
      grounding_ratio: 1.0,
      solver_verification_rate: 1.0,
      duplicate_count: 0,
      total_claims: 0,
      verified_claims: 0,
      total_questions: 0,
      verified_questions: 0,
      objective_coverage: {},
      bloom_distribution: {},
      open_flags_by_severity: { error: 0, warning: 0, info: 0 },
      flags: [],
    };
  }

  const groundingPct = typeof raw.grounding_percentage === 'number'
    ? raw.grounding_percentage
    : (typeof raw.grounding_ratio === 'number' ? raw.grounding_ratio : 100.0);
  const groundingRatio = groundingPct > 1.0 ? groundingPct / 100.0 : groundingPct;

  const solverPct = typeof raw.solver_verification_rate === 'number'
    ? raw.solver_verification_rate
    : 1.0;
  const solverRatio = solverPct > 1.0 ? solverPct / 100.0 : solverPct;

  const openFlagsRaw = raw.open_flags || raw.flags || [];
  const flags = openFlagsRaw.map((f: any) => ({
    id: f.id,
    unit_id: f.unit_id || raw.unit_id,
    asset_version_id: f.asset_version_id,
    code: f.code,
    severity: f.severity,
    message: f.message,
    resolved: f.resolved ?? false,
    created_at: f.created_at || new Date().toISOString(),
  }));

  const openFlagsCount = raw.open_flags_count || {};

  return {
    unit_id: raw.unit_id,
    score: raw.health_score ?? raw.score ?? 0,
    grounding_ratio: groundingRatio,
    solver_verification_rate: solverRatio,
    duplicate_count: raw.duplicate_count ?? 0,
    total_claims: raw.total_claims ?? 0,
    verified_claims: raw.verified_claims ?? 0,
    total_questions: raw.total_quiz_slots ?? raw.total_questions ?? 0,
    verified_questions: raw.solver_matched_slots ?? raw.verified_questions ?? 0,
    objective_coverage: raw.objective_coverage ?? {},
    bloom_distribution: raw.bloom_distribution ?? {},
    open_flags_by_severity: {
      error: openFlagsCount.error ?? raw.open_flags_by_severity?.error ?? 0,
      warning: openFlagsCount.warning ?? raw.open_flags_by_severity?.warning ?? 0,
      info: openFlagsCount.info ?? raw.open_flags_by_severity?.info ?? 0,
    },
    flags,
  };
}

function normalizePackResponse(raw: any, healthData?: PackHealth): LearningPack {
  const unitId = raw.unit_id || raw.unit?.id || 0;
  const rawObjectives = raw.objectives || raw.by_objective || [];

  const byObjective = rawObjectives.map((objItem: any) => {
    const objectiveId: number = objItem.objective_id || objItem.objective?.id || objItem.id || 0;
    const objective: Objective = {
      id: objectiveId,
      unit_id: unitId,
      position: objItem.position || objItem.objective?.position || 1,
      text: objItem.text || objItem.objective?.text || '',
      bloom_target: objItem.bloom_target || objItem.objective?.bloom_target || 'understand',
      supported: objItem.supported ?? objItem.objective?.supported ?? true,
      support_note: objItem.support_note ?? objItem.objective?.support_note ?? null,
    };

    const slots = (objItem.slots || []).map((s: any) => {
      // If s already matches frontend slot structure
      if (s.slot) {
        return s;
      }

      const slotObj: Slot = {
        id: s.slot_id ?? s.id,
        unit_id: unitId,
        objective_id: objectiveId,
        objective_position: s.objective_position || objective.position,
        objective_text: s.objective_text || objective.text,
        type: s.type,
        position: s.position,
        difficulty: s.difficulty,
        bloom_tag: s.bloom_tag,
      };

      const assetObj: Asset | null = s.asset ? {
        id: s.asset.asset_id ?? s.asset.id,
        slot_id: slotObj.id,
        status: s.asset.status,
        locked: s.asset.locked ?? false,
        current_version_id: s.asset.version_no ?? s.asset.current_version_id ?? 1,
        current_version: s.asset.current_version || {
          id: s.asset.version_no ?? 1,
          asset_id: s.asset.asset_id ?? s.asset.id,
          version_no: s.asset.version_no ?? 1,
          variant: 'standard',
          content: s.asset.content,
          model: s.asset.model || 'gemini-2.5-flash',
          prompt_version: '1.0',
          settings: {},
          source_version_id: 1,
          source_sha256: '',
          verification: s.asset.verification,
          created_at: new Date().toISOString(),
          claims: s.asset.claims || [],
        },
      } : null;

      const claimsList: Claim[] = s.asset?.claims || s.claims || [];
      const flagsList: QualityFlag[] = (raw.quality_flags || []).filter(
        (qf: any) => qf.asset_version_id === (s.asset?.version_no || s.asset?.current_version_id)
      );

      return {
        slot: slotObj,
        asset: assetObj,
        claims: claimsList,
        flags: flagsList,
      };
    });

    return {
      objective,
      slots,
    };
  });

  const unit: Unit = {
    id: unitId,
    title: raw.title || raw.unit?.title || 'Learning Pack',
    source_id: raw.source_id || raw.unit?.source_id || 0,
    pinned_source_version_id: raw.pinned_source_version_id || raw.unit?.pinned_source_version_id || 0,
    target_grade: raw.target_grade || raw.unit?.target_grade || '',
    difficulty: raw.difficulty || raw.unit?.difficulty || 'medium',
    language: raw.language || raw.unit?.language || 'English',
    answer_visibility: raw.answer_visibility || raw.unit?.answer_visibility || 'after_submission',
    constraints: raw.constraints || raw.unit?.constraints || {},
    quiz_count: raw.quiz_count || raw.unit?.quiz_count || 0,
    status: raw.status || raw.unit?.status || 'draft',
    created_at: raw.created_at || raw.unit?.created_at || new Date().toISOString(),
  };

  const health: PackHealth = healthData || normalizeHealthResponse(raw.health || {
    unit_id: unitId,
    total_claims: raw.total_claims ?? 0,
    verified_claims: raw.verified_claims ?? 0,
    grounding_ratio: raw.overall_verification_ratio ?? 1.0,
    flags: raw.quality_flags || [],
  });

  return {
    unit,
    health,
    by_objective: byObjective,
  };
}

function normalizeAttendanceReport(raw: any): SessionAttendanceReport {
  const records: AttendanceRecord[] = raw.records || [
    ...(Array.isArray(raw.present_students) && typeof raw.present_students[0] === 'object' ? raw.present_students : []),
    ...(Array.isArray(raw.absent_students) && typeof raw.absent_students[0] === 'object' ? raw.absent_students : []),
  ];
  const presentNames: string[] =
    raw.present_student_names ||
    (Array.isArray(raw.present_students)
      ? raw.present_students.map((s: any) => (typeof s === 'string' ? s : s.name))
      : []);
  const absentNames: string[] =
    raw.absent_student_names ||
    (Array.isArray(raw.absent_students)
      ? raw.absent_students.map((s: any) => (typeof s === 'string' ? s : s.name))
      : []);

  const totalStudents = raw.total_students ?? records.length;
  const presentCount = raw.present_count ?? presentNames.length;
  const absentCount = raw.absent_count ?? absentNames.length;
  const percentage =
    raw.attendance_percentage ??
    (totalStudents > 0 ? Math.round((presentCount / totalStudents) * 1000) / 10 : 0);

  return {
    session_id: raw.session_id,
    session_title: raw.session_title,
    class_label: raw.class_label,
    unit_id: raw.unit_id,
    unit_title: raw.unit_title,
    total_students: totalStudents,
    present_count: presentCount,
    absent_count: absentCount,
    attendance_percentage: percentage,
    present_students: presentNames,
    absent_students: absentNames,
    records: records,
    empty_state: Boolean(raw.empty_state || totalStudents === 0 || presentCount === 0),
    empty_message: raw.empty_message,
  };
}

export const api = {
  // Sources
  async uploadSource(params: { file?: File; title?: string; text?: string }): Promise<{
    source: Source;
    version: SourceVersion;
    chunks_created: number;
    flagged: boolean;
    flags: any[];
  }> {
    const formData = new FormData();
    if (params.file) {
      formData.append('file', params.file);
    }
    if (params.title) {
      formData.append('title', params.title);
    }
    if (params.text) {
      formData.append('text', params.text);
    }

    const url = getFullUrl('/sources/upload');
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });
    } catch (networkErr: any) {
      const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');
      const guidance = isVercel
        ? `Backend server not reachable at ${url}. When hosting on Vercel, please set VITE_API_URL to your deployed backend URL (e.g. Render/Railway) in Vercel Project Settings, or run the app locally at http://localhost:5173.`
        : `Cannot connect to the backend server at ${url}. Please ensure the FastAPI backend is running on port 8000.`;
      throw new ApiError(503, guidance, networkErr);
    }

    if (!response.ok) {
      let err: any = null;
      try {
        err = await response.json();
      } catch {
        const text = await response.text().catch(() => '');
        err = { detail: text || response.statusText || `HTTP ${response.status}` };
      }
      let message = err?.detail || err?.message;
      if (response.status === 404) {
        message = `Backend server not reachable at ${url} (HTTP 404). When hosting on Vercel, please set VITE_API_URL to your deployed backend (e.g. Render/Railway) in Vercel Project Settings, or run the app locally at http://localhost:5173.`;
      }
      throw new ApiError(response.status, message || 'Failed to upload source', err);
    }
    const raw = await response.json();
    return normalizeUploadResponse(raw);
  },

  async getSourceVersions(sourceId: number): Promise<{
    source_id: number;
    title: string;
    versions: SourceVersion[];
  }> {
    return request(`/sources/${sourceId}/versions`);
  },

  // Units
  async createUnit(data: {
    title: string;
    source_id: number;
    target_grade: string;
    difficulty: string;
    language?: string;
    answer_visibility?: string;
    constraints?: Record<string, any>;
    quiz_count?: number;
  }): Promise<Unit> {
    const raw = await request('/units', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return normalizeUnitResponse(raw);
  },

  async listUnits(): Promise<Unit[]> {
    const res: any = await request('/units');
    const rawList = Array.isArray(res) ? res : res?.units || [];
    return rawList.map(normalizeUnitResponse);
  },

  async getUnit(unitId: number): Promise<Unit> {
    const raw = await request(`/units/${unitId}`);
    return normalizeUnitResponse(raw);
  },

  async updateObjectives(unitId: number, objectives: Array<{ text: string; bloom_target?: string | null }>): Promise<{
    unit_id: number;
    objectives: Objective[];
  }> {
    return request(`/units/${unitId}/objectives`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(objectives),
    });
  },

  async planUnit(unitId: number): Promise<{
    unit_id: number;
    objectives: Objective[];
    slots_created: number;
    slots: Slot[];
  }> {
    const planRes: any = await request(`/units/${unitId}/plan`, {
      method: 'POST',
    });

    // Follow-up GET /api/units/{id} to get objectives with supported status
    const unitDetails = await api.getUnit(unitId);

    const slots: Slot[] = (planRes.blueprint || []).map((bp: any) => ({
      id: bp.slot_id,
      unit_id: unitId,
      objective_id: bp.objective_id,
      objective_position: bp.objective_position,
      objective_text: bp.objective_text,
      type: bp.type,
      position: bp.position,
      difficulty: bp.difficulty,
      bloom_tag: bp.bloom_tag,
    }));

    return {
      unit_id: unitId,
      objectives: unitDetails.objectives || [],
      slots_created: planRes.slots_count ?? slots.length,
      slots,
    };
  },

  async generatePack(unitId: number): Promise<{
    unit_id: number;
    total_slots: number;
    generated_count: number;
    failed_count: number;
  }> {
    return request(`/units/${unitId}/generate`, {
      method: 'POST',
    });
  },

  async getLearningPack(unitId: number): Promise<LearningPack> {
    const [rawPack, healthData] = await Promise.all([
      request<any>(`/units/${unitId}/pack`),
      api.getUnitHealth(unitId).catch(() => undefined),
    ]);
    return normalizePackResponse(rawPack, healthData);
  },

  async getUnitHealth(unitId: number): Promise<PackHealth> {
    const raw = await request(`/units/${unitId}/health`);
    return normalizeHealthResponse(raw);
  },

  async getUnitSourceText(unitId: number): Promise<{
    unit_id: number;
    source_id: number;
    source_version_id: number;
    version_no: number;
    sha256: string;
    full_text: string;
    chunks: Array<{
      id: number;
      idx: number;
      char_start: number;
      char_end: number;
      page?: number;
      text: string;
    }>;
  }> {
    return request(`/units/${unitId}/source-text`);
  },

  async getUnitAudit(unitId: number): Promise<any> {
    return request(`/units/${unitId}/audit`);
  },

  // Assets
  async getAssetDetail(assetId: number): Promise<any> {
    return request(`/assets/${assetId}`);
  },

  async updateAssetStatus(assetId: number, data: {
    status: string;
    actor: string;
    note?: string;
    override?: boolean;
    override_reason?: string;
  }): Promise<Asset> {
    return request(`/assets/${assetId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async updateBloomTag(assetId: number, data: {
    bloom_tag: string;
    actor?: string;
    reason?: string;
  }): Promise<{ asset_id: number; slot_id: number; bloom_tag: string; message: string }> {
    return request(`/assets/${assetId}/bloom-tag`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async resolveFlag(flagId: number, data: {
    action: 'resolve' | 'override';
    reason?: string;
    actor?: string;
  }): Promise<{ flag_id: number; resolved: boolean; resolved_by?: string; message: string }> {
    return request(`/assets/flags/${flagId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async regenerateAsset(assetId: number, feedback?: string): Promise<{
    asset_id: number;
    version: AssetVersion;
    status: string;
  }> {
    return request(`/assets/${assetId}/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback }),
    });
  },

  async getAssetVersions(assetId: number): Promise<{
    asset_id: number;
    current_version_id: number;
    locked: boolean;
    versions: AssetVersion[];
    diffs?: any[];
  }> {
    return request(`/assets/${assetId}/versions`);
  },

  async simplifyAsset(assetId: number): Promise<{
    asset_id: number;
    version: AssetVersion;
    status: string;
  }> {
    return request(`/assets/${assetId}/simplify`, {
      method: 'POST',
    });
  },

  // Impact Engine
  async getChangeImpact(unitId: number, change: string = 'difficulty:medium->advanced'): Promise<{
    unit_id: number;
    change_descriptor: string;
    total_slots: number;
    affected_count: number;
    unaffected_count: number;
    approved_stale_count: number;
    affected_slots: Array<{
      slot_id: number;
      name?: string;
      type: string;
      position: number;
      objective_id: number;
      is_approved: boolean;
      current_status: string;
      reason: string;
    }>;
    unaffected_slots: Array<{
      slot_id: number;
      name?: string;
      type: string;
      position: number;
      objective_id: number;
      is_approved: boolean;
      current_status: string;
      reason: string;
    }>;
  }> {
    return request(`/units/${unitId}/impact?change=${encodeURIComponent(change)}`);
  },

  async regenerateAffected(unitId: number, change: string): Promise<any> {
    return request(`/units/${unitId}/regenerate-affected`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ change }),
    });
  },

  // Publishing & Export
  async publishUnit(unitId: number, classLabel: string = 'Class 10-A'): Promise<{
    publication_id: number;
    unit_id: number;
    class_label: string;
    approved_assets_count: number;
  }> {
    return request(`/units/${unitId}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ class_label: classLabel }),
    });
  },

  async exportUnit(unitId: number): Promise<{
    unit: Unit;
    approved_assets: any[];
    health: PackHealth;
    html_document: string;
  }> {
    return request(`/units/${unitId}/export`);
  },

  // Student Endpoints
  async getStudentUnits(): Promise<any[]> {
    const res: any = await request('/student/units');
    return Array.isArray(res) ? res : res?.units || [];
  },

  async getStudentUnit(unitId: number): Promise<any> {
    return request(`/student/units/${unitId}`);
  },

  async submitQuizAttempt(unitId: number, answers: Array<{ asset_id: number; chosen_index: number; time_seconds?: number }>): Promise<{
    attempt_id: number;
    score: number;
    total: number;
    percentage: number;
    results: any[];
  }> {
    return request('/student/attempts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unit_id: unitId, answers }),
    });
  },

  async getAttemptResults(attemptId: number): Promise<any> {
    return request(`/student/attempts/${attemptId}/results`);
  },

  async getUnitAnalytics(unitId: number): Promise<any> {
    return request(`/units/${unitId}/analytics`);
  },

  async generateReinforcement(unitId: number, data: { objective_id: number; count?: number }): Promise<{
    unit_id: number;
    objective_id: number;
    objective_text: string;
    slots_created_count: number;
    created_slots: any[];
    message: string;
  }> {
    return request(`/units/${unitId}/reinforcement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async getHealth(): Promise<{ status: string; app: string; version: string }> {
    return request('/health');
  },

  // Attendance Endpoints
  async getTeacherSessions(): Promise<ClassSessionSummary[]> {
    const res: any = await request('/teacher/sessions');
    return Array.isArray(res) ? res : res?.sessions || [];
  },

  async getSessionAttendance(sessionId: number): Promise<SessionAttendanceReport> {
    const raw: any = await request(`/teacher/sessions/${sessionId}/attendance`);
    return normalizeAttendanceReport(raw);
  },

  async createClassSession(data: {
    title: string;
    class_label?: string;
    unit_id?: number;
  }): Promise<ClassSessionSummary> {
    return request('/teacher/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async markAttendance(
    sessionId: number,
    studentId: number,
    status: 'present' | 'absent' = 'present'
  ): Promise<{ status: string; attendance: AttendanceRecord }> {
    return request(`/sessions/${sessionId}/attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: studentId, status }),
    });
  },

  async markAttendanceBulk(
    sessionId: number,
    records: Array<{ student_id: number; status: 'present' | 'absent' }>
  ): Promise<{ status: string; updated_count: number }> {
    return request(`/sessions/${sessionId}/attendance/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records }),
    });
  },

  async studentJoinSession(sessionId: number): Promise<{ status: string; message: string; attendance: any }> {
    return request(`/student/sessions/${sessionId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  },

  async getUnitAttendance(unitId: number): Promise<SessionAttendanceReport> {
    const raw: any = await request(`/teacher/units/${unitId}/attendance`);
    return normalizeAttendanceReport(raw);
  },

  async recordStudentActivity(
    unitId: number,
    data: { asset_id?: number; activity_type?: string } = {}
  ): Promise<any> {
    return request(`/student/units/${unitId}/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unit_id: unitId, ...data }),
    });
  },

  // Auth Endpoints
  async login(credentials: { email: string; password?: string }): Promise<{
    user_id: number;
    name: string;
    email: string;
    role: Role;
    student_id?: number | null;
    token: string;
  }> {
    return request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
  },

  async register(data: {
    name: string;
    email: string;
    password?: string;
    role: 'teacher' | 'student';
    join_code?: string;
  }): Promise<{
    user_id: number;
    name: string;
    email: string;
    role: Role;
    student_id?: number | null;
    token: string;
  }> {
    return request('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },
};

