/**
 * API client for AI Samrat Project Dashboard.
 * Handles SessionAuthentication, CSRF cookies, and DRF endpoint calls.
 */

function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
}

export async function fetchCsrfToken(): Promise<string> {
  try {
    const res = await fetch('/api/auth/csrf/', {
      method: 'GET',
      credentials: 'include',
    });
    if (res.ok) {
      await res.json();
    }
  } catch (err) {
    console.error('Failed to pre-fetch CSRF token:', err);
  }
  return getCookie('csrftoken') || '';
}

export async function request<T = any>(url: string, options: RequestInit = {}, retryCount = 0): Promise<T> {
  const headers = new Headers(options.headers || {});
  const method = (options.method || 'GET').toUpperCase();

  // For mutating methods, read fresh csrftoken cookie at request time
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    let token = getCookie('csrftoken');
    if (!token) {
      await fetchCsrfToken();
      token = getCookie('csrftoken');
    }
    if (token) {
      headers.set('X-CSRFToken', token);
    }
  }

  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    let detailMsg = '';
    let errorMessage = `Request failed with status ${res.status}`;

    try {
      const errorData = await res.json();
      if (errorData.error) {
        detailMsg = errorData.error;
        errorMessage = errorData.error;
      } else if (errorData.detail) {
        detailMsg = errorData.detail;
        errorMessage = errorData.detail;
      } else if (typeof errorData === 'object' && errorData !== null) {
        errorMessage = Object.entries(errorData)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
          .join(' | ');
      }
    } catch {
      // ignore JSON parse error
    }

    // Single retry on CSRF Failed
    if (res.status === 403 && detailMsg.startsWith('CSRF Failed') && retryCount === 0) {
      await fetchCsrfToken();
      return request<T>(url, options, 1);
    }

    const err = new Error(errorMessage) as Error & { status: number };
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) {
    return {} as T;
  }

  return res.json();
}

export interface ProjectFilters {
  search?: string;
  status?: string;
  priority?: string;
  member_id?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export const api = {
  // Authentication
  async login(username: string, password: string) {
    await fetchCsrfToken();
    return request('/api/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  async logout() {
    return request('/api/auth/logout/', { method: 'POST' });
  },

  async getMe() {
    return request('/api/auth/me/');
  },

  // Summary KPI Metrics
  async getSummary() {
    return request('/api/summary/');
  },

  // Employees & Users
  async getEmployees() {
    return request('/api/employees/');
  },

  async getUsers() {
    return request('/api/users/');
  },

  async createUser(data: any) {
    return request('/api/users/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateUser(userId: number, data: any) {
    return request(`/api/users/${userId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deleteUser(userId: number) {
    return request(`/api/users/${userId}/`, { method: 'DELETE' });
  },

  async changeUserPassword(userId: number, password: string) {
    return request(`/api/users/${userId}/password/`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  },

  // Workload & Availability
  async getEmployeesWorkload(params?: {
    active_only?: boolean;
    sort?: string;
    department?: string;
    status?: string;
  }) {
    const q = new URLSearchParams();
    if (params?.active_only !== undefined) q.set('active_only', String(params.active_only));
    if (params?.sort) q.set('sort', params.sort);
    if (params?.department) q.set('department', params.department);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString();
    return request(qs ? `/api/employees/workload/?${qs}` : '/api/employees/workload/');
  },

  async updateAvailability(userId: number, override: string | null, leaveUntil: string | null) {
    return request(`/api/users/${userId}/`, {
      method: 'PATCH',
      body: JSON.stringify({
        availability_override: override,
        leave_until: leaveUntil,
      }),
    });
  },

  // Projects
  async getProjects(filters?: ProjectFilters) {
    const params = new URLSearchParams();
    if (filters?.search) params.set('search', filters.search);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.priority) params.set('priority', filters.priority);
    if (filters?.member_id) params.set('member_id', filters.member_id);
    if (filters?.sort_by) params.set('sort_by', filters.sort_by);
    if (filters?.sort_order) params.set('sort_order', filters.sort_order);
    const queryString = params.toString();
    const url = queryString ? `/api/projects/?${queryString}` : '/api/projects/';
    return request(url);
  },

  async getProject(id: number) {
    return request(`/api/projects/${id}/`);
  },

  async createProject(data: any) {
    return request('/api/projects/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateProject(id: number, data: any) {
    return request(`/api/projects/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deleteProject(id: number) {
    return request(`/api/projects/${id}/`, { method: 'DELETE' });
  },

  async updateProjectStatus(id: number, status: string, progress?: number) {
    return request(`/api/projects/${id}/status/`, {
      method: 'POST',
      body: JSON.stringify({ status, progress }),
    });
  },

  async updateProjectProgress(
    id: number,
    progressData: {
      frontend_progress: number;
      backend_progress: number;
      database_progress: number;
      notes?: string;
    }
  ) {
    return request(`/api/projects/${id}/progress/`, {
      method: 'POST',
      body: JSON.stringify(progressData),
    });
  },

  async addProjectMember(projectId: number, userId: number, role: string) {
    return request(`/api/projects/${projectId}/members/`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, role }),
    });
  },

  async removeProjectMember(projectId: number, userId: number) {
    return request(`/api/projects/${projectId}/members/${userId}/`, { method: 'DELETE' });
  },

  // Work Diary
  async getProjectDiary(projectId: number, params?: { from?: string; to?: string; author?: number }) {
    const q = new URLSearchParams();
    if (params?.from) q.set('from', params.from);
    if (params?.to) q.set('to', params.to);
    if (params?.author) q.set('author', String(params.author));
    const qs = q.toString();
    return request(qs ? `/api/projects/${projectId}/diary/?${qs}` : `/api/projects/${projectId}/diary/`);
  },

  async saveProjectDiary(projectId: number, data: { done: string; in_progress: string; next_up: string; blockers?: string }) {
    return request(`/api/projects/${projectId}/diary/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateDiaryEntry(entryId: number, data: Partial<{ done: string; in_progress: string; next_up: string; blockers: string }>) {
    return request(`/api/diary/${entryId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async reviewDiaryEntry(entryId: number) {
    return request(`/api/diary/${entryId}/review/`, {
      method: 'POST',
    });
  },

  async getMyDiary() {
    return request('/api/diary/my/');
  },

  async getDueDiary() {
    return request('/api/diary/due/');
  },

  // Documents & Files
  async getProjectDocuments(projectId: number) {
    return request(`/api/projects/${projectId}/documents/`);
  },

  async getFiles() {
    return request('/api/files/');
  },

  async uploadDocument(projectId: number, file: File, fileType: string = 'documentation') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('file_type', fileType);
    return request(`/api/projects/${projectId}/upload/`, {
      method: 'POST',
      body: formData,
    });
  },

  async deleteDocument(id: number) {
    return request(`/api/documents/${id}/`, { method: 'DELETE' });
  },

  async downloadDocument(id: number, filename: string) {
    const res = await fetch(`/api/documents/${id}/download/`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  async syncExcel() {
    return request('/api/import/excel/', { method: 'POST' });
  },

  // Team Excel & CSV Upload APIs
  async uploadTeamPreview(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return request<{
      success: boolean;
      filename: string;
      file_type: string;
      total_rows: number;
      valid_count: number;
      existing_count: number;
      rows: any[];
    }>('/api/team/upload-preview/', {
      method: 'POST',
      body: formData,
    });
  },

  async confirmTeamUpload(payload: { rows: any[]; update_existing?: boolean }) {
    return request<{
      success: boolean;
      message: string;
      created_count: number;
      updated_count: number;
      skipped_count: number;
      errors?: string[];
    }>('/api/team/upload-confirm/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async downloadTeamTemplate(format: 'excel' | 'csv' = 'csv') {
    const filename = format === 'excel' ? 'ai_samrat_team_template.xlsx' : 'ai_samrat_team_template.csv';
    const res = await fetch(`/api/team/template/?format=${format}`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Download failed');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  // System & Audit Logs APIs
  async getAdminLogs(params?: { file?: string; level?: string; search?: string; lines?: number }) {
    const q = new URLSearchParams();
    if (params?.file) q.set('file', params.file);
    if (params?.level) q.set('level', params.level);
    if (params?.search) q.set('search', params.search);
    if (params?.lines) q.set('lines', String(params.lines));
    return request<{
      logs: Array<{
        timestamp: string;
        level: string;
        logger: string;
        message: string;
        raw: string;
      }>;
      file_name: string;
      file_size: string;
      total_lines: number;
      levels_count: Record<string, number>;
    }>(`/api/admin/logs/?${q.toString()}`);
  },

  async downloadAdminLogs(file: string = 'app') {
    const filename = file === 'error' ? 'error.log' : 'app.log';
    const res = await fetch(`/api/admin/logs/?file=${file}&download=true`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to download log archive');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  async clearAdminLogs(file: string = 'app') {
    return request<{ success: boolean; message: string }>(`/api/admin/logs/?file=${file}&clear=1`, {
      method: 'POST',
    });
  },
};
