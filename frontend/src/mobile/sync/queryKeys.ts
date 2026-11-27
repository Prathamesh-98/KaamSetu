import type { QueryClient } from '@tanstack/react-query';
import type { UserRole } from '../../types';

/**
 * Canonical React Query keys shared across mobile pages & shared modals
 * so mutations always invalidate all dependent caches consistently.
 */
export const MOBILE_QUERY_KEYS = {
  // Profiles
  workerProfile: (userId?: string) => (userId ? ['worker-profile', userId] : ['worker-profile']),
  workerProfileDetail: (workerId: string) => ['worker-profile-detail', workerId],
  employerProfile: (userId?: string) => (userId ? ['employer-profile', userId] : ['employer-profile']),

  // Jobs & Discovery
  jobsList: (filters?: Record<string, unknown>) => (filters ? ['jobs', filters] : ['jobs']),
  mobileHomeJobs: ['mobile-homepage-jobs'] as const,
  jobDetail: (jobId: string) => ['job', jobId] as const,
  jobMatch: (jobId: string) => ['job-match', jobId] as const,
  jobApplicants: (jobId: string) => ['job-applicants', jobId] as const,
  jobCandidates: (jobId: string, page?: number) =>
    page !== undefined ? (['job-candidates', jobId, page] as const) : (['job-candidates', jobId] as const),
  employerJobs: ['employer-jobs'] as const,
  myJobsAlias: ['my-jobs'] as const,

  // Applications
  workerApplications: ['applications'] as const,
  employerApplications: ['employer-applications'] as const,

  // Saved items
  savedJobs: ['saved-jobs'] as const,
  savedWorkers: ['employer-saved-workers'] as const,
  savedWorkerIds: ['saved-worker-ids'] as const,

  // Shifts, Availability & Settlements (aligned with shared modals)
  myAvailability: ['my-availability'] as const,
  workerAvailability: (workerId: string) => ['worker-availability', workerId] as const,
  workerBookings: ['my-bookings'] as const,
  employerBookings: ['employer-bookings'] as const,
  workHistory: (page?: number, perPage?: number) =>
    page !== undefined ? (['work-history', page, perPage] as const) : (['work-history'] as const),

  // Chat & Notifications
  chatConversations: ['chat-conversations'] as const,
  chatMessages: (conversationId: string) => ['chat-messages', conversationId] as const,
  chatUnreadCount: ['chat-unread-count'] as const,
  notificationsList: ['notifications-list'] as const,
  notificationsUnreadCount: ['notifications-unread-count'] as const,

  // Verifications
  workerVerificationStatus: ['worker-verification-status'] as const,
  workerVerificationHistory: ['worker-verification-history'] as const,
  employerVerificationStatus: ['employer-verification-status'] as const,
  employerVerificationHistory: ['employer-verification-history'] as const,

  // Reference data
  categories: ['categories'] as const,
  skills: (q?: string) => (q !== undefined ? (['skills', q] as const) : (['skills'] as const)),
} as const;

export function invalidateRoleQueries(queryClient: QueryClient, role?: UserRole | null) {
  void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.chatUnreadCount });
  void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.notificationsUnreadCount });
  void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.notificationsList });
  void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.chatConversations });

  if (role === 'WORKER') {
    void queryClient.invalidateQueries({ queryKey: ['worker-profile'] });
    void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.workerApplications });
    void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.savedJobs });
    void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.workerBookings });
    void queryClient.invalidateQueries({ queryKey: ['work-history'] });
    void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.myAvailability });
    void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.workerVerificationStatus });
    void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.workerVerificationHistory });
    void queryClient.invalidateQueries({ queryKey: ['jobs'] });
  } else if (role === 'EMPLOYER') {
    void queryClient.invalidateQueries({ queryKey: ['employer-profile'] });
    void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.employerJobs });
    void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.myJobsAlias });
    void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.employerApplications });
    void queryClient.invalidateQueries({ queryKey: ['job-applicants'] });
    void queryClient.invalidateQueries({ queryKey: ['job-candidates'] });
    void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.savedWorkers });
    void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.savedWorkerIds });
    void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.employerBookings });
    void queryClient.invalidateQueries({ queryKey: ['work-history'] });
    void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.employerVerificationStatus });
    void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.employerVerificationHistory });
  }
}

export function invalidateApplicationSync(queryClient: QueryClient, jobId?: string) {
  void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.workerApplications });
  void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.employerApplications });
  void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.employerJobs });
  void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.myJobsAlias });
  void queryClient.invalidateQueries({ queryKey: ['job-applicants'] });
  void queryClient.invalidateQueries({ queryKey: ['job-candidates'] });
  void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.notificationsUnreadCount });
  void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.notificationsList });
  if (jobId) {
    void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.jobDetail(jobId) });
    void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.jobApplicants(jobId) });
  }
}

export function invalidateShiftSync(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.workerBookings });
  void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.employerBookings });
  void queryClient.invalidateQueries({ queryKey: ['work-history'] });
  void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.workerApplications });
  void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.employerApplications });
  void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.notificationsUnreadCount });
  void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.notificationsList });
}

export function invalidateJobSync(queryClient: QueryClient, jobId?: string) {
  void queryClient.invalidateQueries({ queryKey: ['jobs'] });
  void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.mobileHomeJobs });
  void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.employerJobs });
  void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.myJobsAlias });
  if (jobId) {
    void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.jobDetail(jobId) });
    void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.jobMatch(jobId) });
  }
}

export function invalidateProfileSync(queryClient: QueryClient, role: 'WORKER' | 'EMPLOYER', userId?: string) {
  if (role === 'WORKER') {
    void queryClient.invalidateQueries({ queryKey: ['worker-profile'] });
    if (userId) {
      void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.workerProfile(userId) });
    }
    void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.workerVerificationStatus });
  } else {
    void queryClient.invalidateQueries({ queryKey: ['employer-profile'] });
    if (userId) {
      void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.employerProfile(userId) });
    }
    void queryClient.invalidateQueries({ queryKey: MOBILE_QUERY_KEYS.employerVerificationStatus });
  }
}
