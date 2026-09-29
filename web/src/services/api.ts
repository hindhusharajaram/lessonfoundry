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
  Role,
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

  return {
    'X-Role': role,
    'X-Student-Id': studentId,
  };
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`;
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
        errData = { detail: response.statusText };
      }
      const message = errData?.detail || errData?.message || `Request failed with status ${response.status}`;
      throw new ApiError(response.status, message, errData);
    }
    return await response.json();
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(500, err.message || 'Network error occurred');
  }
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

    const response = await fetch('/api/sources/upload', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: response.statusText }));
      throw new ApiError(response.status, err.detail || 'Failed to upload source', err);
    }
    return response.json();
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
    return request('/units', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async listUnits(): Promise<Unit[]> {
    return request('/units');
  },

  async getUnit(unitId: number): Promise<Unit> {
    return request(`/units/${unitId}`);
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
    return request(`/units/${unitId}/plan`, {
      method: 'POST',
    });
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
    return request(`/units/${unitId}/pack`);
  },

  async getUnitHealth(unitId: number): Promise<PackHealth> {
    return request(`/units/${unitId}/health`);
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
  async getChangeImpact(unitId: number, change: string): Promise<{
    unit_id: number;
    change: string;
    affected_slots: number[];
    unaffected_slots: number[];
    reasons: Record<string, string>;
    approved_stale_count: number;
  }> {
    return request(`/units/${unitId}/impact?change=${encodeURIComponent(change)}`);
  },

  async regenerateAffected(unitId: number, change: string): Promise<{
    unit_id: number;
    regenerated_count: number;
    approved_stale_preserved: number;
    stale_asset_ids: number[];
  }> {
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
    return request('/student/units');
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
  }
};

