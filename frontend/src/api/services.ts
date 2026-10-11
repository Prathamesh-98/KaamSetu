// KaamSetu — All API service functions
import api from './client';
import type {
  AuthToken, User, WorkerProfile, EmployerProfile, Job, JobListItem,
  Application, Category, Skill, Conversation, Message, Notification,
  Rating, AdminStats, RegisterPayload, LoginPayload, WorkerProfilePayload,
  JobCreatePayload, JobFilters, PaginatedResponse, SavedJob, SavedWorker, JobMatchResult, CandidateMatch,
  UnreadCountResponse
} from '../types';

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data: RegisterPayload) =>
    api.post<AuthToken>('/auth/register', data).then(r => r.data),
  login: (data: LoginPayload) =>
    api.post<AuthToken>('/auth/login', data).then(r => r.data),
  me: () =>
    api.get<User>('/auth/me').then(r => r.data),
};

// ─── Workers ──────────────────────────────────────────────────────────────────
export const workerApi = {
  createProfile: (data: WorkerProfilePayload) =>
    api.post<WorkerProfile>('/workers/profile', data).then(r => r.data),
  getMyProfile: () =>
    api.get<WorkerProfile>('/workers/profile')
      .then(r => r.data)
      .catch(e => {
        if (e.response?.status === 404) return null;
        throw e;
      }),
  updateProfile: (data: Partial<WorkerProfilePayload>) =>
    api.put<WorkerProfile>('/workers/profile', data).then(r => r.data),
  getById: (id: string) =>
    api.get<WorkerProfile>(`/workers/${id}`).then(r => r.data),
  addSkill: (skillId: string, proficiencyLevel: string, yearsExperience: number) =>
    api.post('/workers/skills', { skill_id: skillId, proficiency_level: proficiencyLevel, years_experience: yearsExperience }).then(r => r.data),
  removeSkill: (skillId: string) =>
    api.delete(`/workers/skills/${skillId}`).then(r => r.data),
  saveJob: (jobId: string) =>
    api.post(`/workers/saved-jobs/${jobId}`).then(r => r.data),
  unsaveJob: (jobId: string) =>
    api.delete(`/workers/saved-jobs/${jobId}`).then(r => r.data),
  getSavedJobs: () =>
    api.get<SavedJob[]>('/workers/me/saved-jobs').then(r => r.data),
};

// ─── Employers ────────────────────────────────────────────────────────────────
export const employerApi = {
  createProfile: (data: Partial<EmployerProfile>) =>
    api.post<EmployerProfile>('/employers/profile', data).then(r => r.data),
  getMyProfile: () =>
    api.get<EmployerProfile>('/employers/profile')
      .then(r => r.data)
      .catch(e => {
        if (e.response?.status === 404) return null;
        throw e;
      }),
  updateProfile: (data: Partial<EmployerProfile>) =>
    api.put<EmployerProfile>('/employers/profile', data).then(r => r.data),
  getById: (id: string) =>
    api.get<EmployerProfile>(`/employers/${id}`).then(r => r.data),
  getSavedWorkers: () =>
    api.get<SavedWorker[]>('/employers/saved-workers').then(r => r.data),
  getSavedWorkerIds: () =>
    api.get<string[]>('/employers/saved-workers/ids').then(r => r.data),
  saveWorker: (workerId: string, notes?: string) =>
    api.post<SavedWorker>(`/employers/saved-workers/${workerId}`, { notes }).then(r => r.data),
  removeSavedWorker: (workerId: string) =>
    api.delete(`/employers/saved-workers/${workerId}`).then(r => r.data),
};

// ─── Jobs ─────────────────────────────────────────────────────────────────────
export const jobsApi = {
  list: (filters: JobFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.append(k, String(v));
    });
    return api.get<PaginatedResponse<JobListItem>>(`/jobs?${params}`).then(r => r.data);
  },
  myJobs: () =>
    api.get<JobListItem[]>('/jobs/my').then(r => r.data),
  get: (id: string) =>
    api.get<Job>(`/jobs/${id}`).then(r => r.data),
  create: (data: JobCreatePayload) =>
    api.post<Job>('/jobs', data).then(r => r.data),
  update: (id: string, data: Partial<JobCreatePayload>) =>
    api.put<Job>(`/jobs/${id}`, data).then(r => r.data),
  delete: (id: string) =>
    api.delete(`/jobs/${id}`).then(r => r.data),
  getApplicants: (jobId: string) =>
    api.get<Application[]>(`/jobs/${jobId}/applicants`).then(r => r.data),
  getCandidates: (jobId: string, page = 1) =>
    api.get<PaginatedResponse<CandidateMatch>>(`/jobs/${jobId}/candidates?page=${page}`).then(r => r.data),
  getMatch: (id: string) =>
    api.get<JobMatchResult>(`/jobs/${id}/match`).then(r => r.data),
};

// ─── Chat ────────────────────────────────────────────────────────────────────
export const chatApi = {
  getConversations: () => 
    api.get<Conversation[]>('/chat/conversations').then(res => res.data),
    
  getOrCreateConversation: (applicationId: string) =>
    api.post<Conversation>(`/chat/conversations/application/${applicationId}`).then(res => res.data),
    
  getMessages: (conversationId: string, page: number = 1, size: number = 50) =>
    api.get<PaginatedResponse<Message>>(`/chat/conversations/${conversationId}/messages`, { params: { page, size } }).then(res => res.data),
    
  sendMessage: (conversationId: string, content: string) =>
    api.post<Message>(`/chat/conversations/${conversationId}/messages`, { content }).then(res => res.data),
    
  markAsRead: (conversationId: string) =>
    api.post<{success: boolean}>(`/chat/conversations/${conversationId}/read`).then(res => res.data),
    
  getUnreadCount: () =>
    api.get<UnreadCountResponse>('/chat/unread-count').then(res => res.data),
};

// ─── Applications ─────────────────────────────────────────────────────────────
export const applicationsApi = {
  apply: (jobId: string, coverNote?: string) =>
    api.post<Application>(`/jobs/${jobId}/apply`, { cover_note: coverNote }).then(r => r.data),
  list: () =>
    api.get<Application[]>('/applications').then(r => r.data),
  updateStatus: (appId: string, status: string, notes?: string) =>
    api.put<Application>(`/applications/${appId}/status`, { status, employer_notes: notes }).then(r => r.data),
  withdraw: (appId: string) =>
    api.delete(`/applications/${appId}`).then(r => r.data),
};

// ─── Categories & Skills ──────────────────────────────────────────────────────
export const categoriesApi = {
  list: () =>
    api.get<Category[]>('/categories').then(r => r.data),
};

export const skillsApi = {
  list: (q?: string) =>
    api.get<Skill[]>(`/skills${q ? `?q=${q}` : ''}`).then(r => r.data),
};

// ─── Notifications ────────────────────────────────────────────────────────────
export const notificationsApi = {
  list: (unreadOnly = false) =>
    api.get<Notification[]>(`/notifications?unread_only=${unreadOnly}`).then(r => r.data),
  markRead: (id: string) =>
    api.put(`/notifications/${id}/read`).then(r => r.data),
  getUnreadCount: () => api.get<{count: number}>('/notifications/unread-count').then(r => r.data),
  markAllRead: () =>
    api.put('/notifications/read-all').then(r => r.data),
};

// ─── Admin ────────────────────────────────────────────────────────────────────
export const adminApi = {
  getStats: () =>
    api.get<AdminStats>('/admin/stats').then(r => r.data),
  listUsers: (page = 1) =>
    api.get<User[]>(`/admin/users?page=${page}`).then(r => r.data),
  toggleUserStatus: (userId: string, isActive: boolean) =>
    api.put(`/admin/users/${userId}/status?is_active=${isActive}`).then(r => r.data),
};

// ─── Uploads ──────────────────────────────────────────────────────────────────
export const uploadApi = {
  uploadImage: (file: File, folder: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    return api.post<{url: string, public_id: string}>('/upload/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }).then(r => r.data);
  }
};

export const ratingsApi = {
  create: (data: { application_id: string; rating: number; review_text?: string; rater_role: string }) => api.post('/ratings', data).then(r => r.data),
  getUserRatings: (userId: string) => api.get(`/ratings/user/${userId}`).then(r => r.data),
};



export const shiftsApi = {
  // Worker Availability
  getMyAvailability: () => api.get('/availability/me').then(res => res.data),
  getWorkerAvailability: (workerId: string) => api.get(`/workers/${workerId}/availability`).then(res => res.data),
  createAvailability: (data: any) => api.post('/availability', data).then(res => res.data),
  updateAvailability: (id: string, data: any) => api.patch(`/availability/${id}`, data).then(res => res.data),
  deleteAvailability: (id: string) => api.delete(`/availability/${id}`).then(res => res.data),
  
  // Shift Bookings
  getMyBookings: () => api.get('/shift-bookings/me').then(res => res.data),
  requestShift: (data: any) => api.post('/shift-bookings', data).then(res => res.data),
  acceptShift: (id: string) => api.post(`/shift-bookings/${id}/accept`).then(res => res.data),
  declineShift: (id: string) => api.post(`/shift-bookings/${id}/decline`).then(res => res.data),
  cancelShift: (id: string) => api.post(`/shift-bookings/${id}/cancel`).then(res => res.data),
}
