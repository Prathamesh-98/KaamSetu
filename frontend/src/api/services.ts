// KaamSetu — All API service functions
import api from './client';
import type {
  AuthToken, User, WorkerProfile, EmployerProfile, Job, JobListItem,
  Application, Category, Skill, Conversation, Message, Notification,
  Rating, AdminStats, RegisterPayload, LoginPayload, WorkerProfilePayload,
  JobCreatePayload, JobFilters, PaginatedResponse, SavedJob, SavedWorker, JobMatchResult, CandidateMatch,
  UnreadCountResponse, VerificationRecord, PhoneVerificationResponse,
  UserVerificationStatusSummary, AdminVerificationReviewPayload, AdminQueueFilters,
  WorkCompletionWithPayment, WorkCompletionCreatePayload, PaymentRecord, PaymentDisputePayload,
  PaymentUpdatePayload, WorkHistoryListResponse, ShiftBooking,
  AdminProfile, AdminProfileUpdatePayload, AdminChangePasswordPayload, AdminChangePasswordResponse,
  AdminUserListResponse, AdminWorkerListItem, AdminWorkerListResponse,
  AdminEmployerListItem, AdminEmployerListResponse,
  AdminJobListItem, AdminJobListResponse,
  AdminApplicationListItem, AdminApplicationListResponse,
  AdminCompletedWorkItem, AdminCompletedWorkListResponse,
  ForgotPasswordGenericResponse, RecoveryVerifyResponse,
  ResetPasswordPayload, ResetPasswordResponse
} from '../types';

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data: RegisterPayload) =>
    api.post<AuthToken>('/auth/register', data).then(r => r.data),
  login: (data: LoginPayload) =>
    api.post<AuthToken>('/auth/login', data).then(r => r.data),
  me: () =>
    api.get<User>('/auth/me').then(r => r.data),
  forgotPasswordEmail: (email: string) =>
    api.post<ForgotPasswordGenericResponse>('/auth/forgot-password/email', { email }).then(r => r.data),
  forgotPasswordPhone: (phone: string) =>
    api.post<ForgotPasswordGenericResponse>('/auth/forgot-password/phone', { phone }).then(r => r.data),
  verifyRecoveryEmail: (email: string, otp_code: string) =>
    api.post<RecoveryVerifyResponse>('/auth/forgot-password/verify-email', { email, otp_code }).then(r => r.data),
  verifyRecoveryPhone: (phone: string, otp_code: string) =>
    api.post<RecoveryVerifyResponse>('/auth/forgot-password/verify-phone', { phone, otp_code }).then(r => r.data),
  resetPassword: (payload: ResetPasswordPayload) =>
    api.post<ResetPasswordResponse>('/auth/reset-password', payload).then(r => r.data),
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
  getProfile: () =>
    api.get<AdminProfile>('/admin/profile').then(r => r.data),
  updateProfile: (payload: AdminProfileUpdatePayload) =>
    api.put<AdminProfile>('/admin/profile', payload).then(r => r.data),
  changePassword: (payload: AdminChangePasswordPayload) =>
    api.post<AdminChangePasswordResponse>('/admin/change-password', payload).then(r => r.data),
  getStats: () =>
    api.get<AdminStats>('/admin/stats').then(r => r.data),
  listUsers: (params: { search?: string; role?: string; is_active?: boolean; page?: number; per_page?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.search) qs.append('search', params.search);
    if (params.role && params.role !== 'ALL') qs.append('role', params.role);
    if (params.is_active !== undefined) qs.append('is_active', String(params.is_active));
    if (params.page) qs.append('page', String(params.page));
    if (params.per_page) qs.append('per_page', String(params.per_page));
    const query = qs.toString();
    return api.get<AdminUserListResponse>(`/admin/users${query ? '?' + query : ''}`).then(r => r.data);
  },
  toggleUserStatus: (userId: string, isActive: boolean) =>
    api.put(`/admin/users/${userId}/status?is_active=${isActive}`).then(r => r.data),
  listWorkers: (params: { search?: string; verified_only?: boolean; page?: number; per_page?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.search) qs.append('search', params.search);
    if (params.verified_only) qs.append('verified_only', 'true');
    if (params.page) qs.append('page', String(params.page));
    if (params.per_page) qs.append('per_page', String(params.per_page));
    const query = qs.toString();
    return api.get<AdminWorkerListResponse>(`/admin/workers${query ? '?' + query : ''}`).then(r => r.data);
  },
  getWorker: (workerId: string) =>
    api.get<AdminWorkerListItem>(`/admin/workers/${workerId}`).then(r => r.data),
  listEmployers: (params: { search?: string; verified_only?: boolean; page?: number; per_page?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.search) qs.append('search', params.search);
    if (params.verified_only) qs.append('verified_only', 'true');
    if (params.page) qs.append('page', String(params.page));
    if (params.per_page) qs.append('per_page', String(params.per_page));
    const query = qs.toString();
    return api.get<AdminEmployerListResponse>(`/admin/employers${query ? '?' + query : ''}`).then(r => r.data);
  },
  getEmployer: (employerId: string) =>
    api.get<AdminEmployerListItem>(`/admin/employers/${employerId}`).then(r => r.data),
  listJobs: (params: { search?: string; status?: string; page?: number; per_page?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.search) qs.append('search', params.search);
    if (params.status && params.status !== 'ALL') qs.append('status', params.status);
    if (params.page) qs.append('page', String(params.page));
    if (params.per_page) qs.append('per_page', String(params.per_page));
    const query = qs.toString();
    return api.get<AdminJobListResponse>(`/admin/jobs${query ? '?' + query : ''}`).then(r => r.data);
  },
  updateJobStatus: (jobId: string, status: string, reason?: string) =>
    api.put<AdminJobListItem>(`/admin/jobs/${jobId}/status`, { status, reason }).then(r => r.data),
  listApplications: (params: { search?: string; status?: string; page?: number; per_page?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.search) qs.append('search', params.search);
    if (params.status && params.status !== 'ALL') qs.append('status', params.status);
    if (params.page) qs.append('page', String(params.page));
    if (params.per_page) qs.append('per_page', String(params.per_page));
    const query = qs.toString();
    return api.get<AdminApplicationListResponse>(`/admin/applications${query ? '?' + query : ''}`).then(r => r.data);
  },
  listCompletedWork: (params: { payment_status?: string; disputed_only?: boolean; page?: number; per_page?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.payment_status && params.payment_status !== 'ALL') qs.append('payment_status', params.payment_status);
    if (params.disputed_only) qs.append('disputed_only', 'true');
    if (params.page) qs.append('page', String(params.page));
    if (params.per_page) qs.append('per_page', String(params.per_page));
    const query = qs.toString();
    return api.get<AdminCompletedWorkListResponse>(`/admin/completed-work${query ? '?' + query : ''}`).then(r => r.data);
  },
  getVerificationQueue: (filters: AdminQueueFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);
    if (filters.type && filters.type !== 'ALL') params.append('type', filters.type);
    if (filters.page) params.append('page', String(filters.page));
    if (filters.per_page) params.append('per_page', String(filters.per_page));
    const qs = params.toString();
    return api.get<VerificationRecord[]>(`/admin/verifications/queue${qs ? '?' + qs : ''}`).then(r => r.data);
  },
  getVerificationRecord: (recordId: string) =>
    api.get<VerificationRecord>(`/admin/verifications/${recordId}`).then(r => r.data),
  approveVerification: (recordId: string, payload?: AdminVerificationReviewPayload) =>
    api.post<VerificationRecord>(`/admin/verifications/${recordId}/approve`, payload || { decision: 'APPROVE' }).then(r => r.data),
  rejectVerification: (recordId: string, payload: AdminVerificationReviewPayload) =>
    api.post<VerificationRecord>(`/admin/verifications/${recordId}/reject`, payload).then(r => r.data),
  revokeVerification: (recordId: string, payload: AdminVerificationReviewPayload) =>
    api.post<VerificationRecord>(`/admin/verifications/${recordId}/revoke`, payload).then(r => r.data),
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
  getMyBookings: () => api.get<ShiftBooking[]>('/shift-bookings/me').then(res => res.data),
  requestShift: (data: any) => api.post<ShiftBooking>('/shift-bookings', data).then(res => res.data),
  acceptShift: (id: string) => api.post<ShiftBooking>(`/shift-bookings/${id}/accept`).then(res => res.data),
  declineShift: (id: string) => api.post<ShiftBooking>(`/shift-bookings/${id}/decline`).then(res => res.data),
  cancelShift: (id: string) => api.post<ShiftBooking>(`/shift-bookings/${id}/cancel`).then(res => res.data),

  // Work Completion & Payments (Feature 3)
  completeShift: (bookingId: string, payload: WorkCompletionCreatePayload) =>
    api.post<WorkCompletionWithPayment>(`/shift-bookings/${bookingId}/complete`, payload).then(res => res.data),
  confirmPayment: (bookingId: string) =>
    api.post<PaymentRecord>(`/shift-bookings/${bookingId}/payment/confirm`).then(res => res.data),
  disputePayment: (bookingId: string, payload: PaymentDisputePayload) =>
    api.post<PaymentRecord>(`/shift-bookings/${bookingId}/payment/dispute`, payload).then(res => res.data),
  updatePayment: (bookingId: string, payload: PaymentUpdatePayload) =>
    api.patch<PaymentRecord>(`/shift-bookings/${bookingId}/payment`, payload).then(res => res.data),
  getShiftCompletion: (bookingId: string) =>
    api.get<WorkCompletionWithPayment>(`/shift-bookings/${bookingId}/completion`).then(res => res.data),
  getMyWorkHistory: (page: number = 1, perPage: number = 20) =>
    api.get<WorkHistoryListResponse>(`/work-history/me?page=${page}&per_page=${perPage}`).then(res => res.data),
}

// ─── Trust & Verification ───────────────────────────────────────────────────
export const verificationsApi = {
  getMyStatus: () =>
    api.get<UserVerificationStatusSummary>('/verifications/my-status').then(r => r.data),

  getMyHistory: () =>
    api.get<VerificationRecord[]>('/verifications/my-history').then(r => r.data),

  requestPhoneOtp: (phone: string) =>
    api.post<{ message: string; masked_phone?: string; retry_after?: number }>('/verifications/phone/request', { phone }).then(r => r.data),

  verifyPhoneOtp: (phone: string, otpCode: string) =>
    api.post<PhoneVerificationResponse>('/verifications/phone/verify', { phone, otp_code: otpCode }).then(r => r.data),

  submitIdentity: (file: File, documentType: string, notes?: string) => {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('document_type', documentType);
    if (notes) formData.append('notes', notes);
    return api.post<VerificationRecord>('/verifications/identity', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },

  submitSkillCertificate: (file: File, skillId: string, certificateTitle: string, issuingAuthority?: string, notes?: string) => {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('skill_id', skillId);
    formData.append('certificate_title', certificateTitle);
    if (issuingAuthority) formData.append('issuing_authority', issuingAuthority);
    if (notes) formData.append('notes', notes);
    return api.post<VerificationRecord>('/verifications/skill', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },

  submitCompany: (file: File, organizationName?: string, organizationType?: string, taxId?: string, notes?: string) => {
    const formData = new FormData();
    formData.append('document', file);
    if (organizationName) formData.append('organization_name', organizationName);
    if (organizationType) formData.append('organization_type', organizationType);
    if (taxId) formData.append('tax_id', taxId);
    if (notes) formData.append('notes', notes);
    return api.post<VerificationRecord>('/verifications/company', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },

  getDocumentBlob: async (recordId: string): Promise<{ blob: Blob; contentType: string }> => {
    const response = await api.get(`/verifications/${recordId}/document`, {
      responseType: 'blob',
    });
    return {
      blob: response.data,
      contentType: (response.headers['content-type'] as string) || 'application/octet-stream',
    };
  },
};
