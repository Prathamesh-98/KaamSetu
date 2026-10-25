// KaamSetu — TypeScript Type Definitions

// ─── Enums ────────────────────────────────────────────────────────────────────

export type UserRole = 'WORKER' | 'EMPLOYER' | 'ADMIN';

export type AvailabilityStatus = 'AVAILABLE' | 'BUSY' | 'UNAVAILABLE';

export type SalaryType = 'HOURLY' | 'DAILY' | 'MONTHLY' | 'PROJECT' | 'FIXED';

export type WorkType =
  | 'FULL_TIME'
  | 'PART_TIME'
  | 'DAILY'
  | 'HOURLY'
  | 'PROJECT'
  | 'TEMPORARY'
  | 'REMOTE'
  | 'LOCAL';

export type JobStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'COMPLETED' | 'CANCELLED';

export type ApplicationStatus =
  | 'PENDING'
  | 'SHORTLISTED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'COMPLETED';

export type ProficiencyLevel = 'BEGINNER' | 'INTERMEDIATE' | 'EXPERT';

export type MessageType = 'TEXT' | 'IMAGE' | 'FILE';

export type RaterRole = 'WORKER' | 'EMPLOYER';

// ─── Models ───────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface Skill {
  id: string;
  name: string;
  category: string | null;
  created_at: string;
}

export interface WorkerSkill {
  id: string;
  skill: Skill;
  proficiency_level: ProficiencyLevel;
  years_experience: number;
}

export interface WorkerProfile {
  id: string;
  user_id: string;
  full_name: string;
  profile_image_url: string | null;
  bio: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  years_experience: number;
  expected_salary: number | null;
  salary_type: SalaryType | null;
  availability_status: AvailabilityStatus;
  preferred_work_types: string[] | null;
  is_phone_verified: boolean;
  is_identity_verified: boolean;
  average_rating: number;
  total_ratings: number;
  skills: WorkerSkill[];
  created_at: string;
  updated_at: string;
}

export interface EmployerProfile {
  id: string;
  user_id: string;
  full_name: string;
  organization_name: string | null;
  organization_type: string | null;
  profile_image_url: string | null;
  bio: string | null;
  city: string | null;
  state: string | null;
  website: string | null;
  is_verified: boolean;
  average_rating: number;
  total_ratings: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
  is_active: boolean;
}

export interface JobSkill {
  skill: Skill;
  is_mandatory: boolean;
}

export interface Job {
  id: string;
  title: string;
  description: string;
  work_type: WorkType;
  status: JobStatus;
  city: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  address_detail?: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_type: SalaryType;
  workers_needed: number;
  experience_required: number;
  is_urgent: boolean;
  start_date: string | null;
  end_date: string | null;
  duration_days: number | null;
  additional_requirements: string | null;
  image_url: string | null;
  views_count: number;
  applications_count: number;
  created_at: string;
  updated_at: string;
  employer: EmployerProfile;
  category: Category;
  required_skills: JobSkill[];
}

export interface JobListItem {
  id: string;
  title: string;
  work_type: WorkType;
  status: JobStatus;
  city: string;
  state: string;
  latitude?: number | null;
  longitude?: number | null;
  address_detail?: string | null;
  distance_km?: number | null;
  estimated_travel_time?: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_type: SalaryType;
  is_urgent: boolean;
  start_date: string | null;
  applications_count: number;
  views_count?: number;
  created_at: string;
  employer: EmployerProfile;
  category: Category;
  required_skills: JobSkill[];
  image_url?: string | null;
}

export interface SavedJob {
  id: string;
  saved_at: string;
  job: JobListItem;
}

export interface SavedWorker {
  id: string;
  employer_id: string;
  worker_id: string;
  notes?: string | null;
  saved_at: string;
  worker: WorkerProfile;
}

export interface Application {
  id: string;
  status: ApplicationStatus;
  cover_note: string | null;
  employer_notes: string | null;
  applied_at: string;
  updated_at: string;
  job: JobListItem;
  worker: WorkerProfile;
}

export interface Message {
  id: string;
  sender_id: string;
  content: string;
  message_type: MessageType;
  is_read: boolean;
  sent_at: string;
}

export interface Conversation {
  id: string;
  application_id: string;
  worker: WorkerProfile;
  employer: EmployerProfile;
  last_message_at: string | null;
  created_at: string;
  unread_count: number;
  last_message: Message | null;
  application_status: ApplicationStatus;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  reference_id: string | null;
  reference_type: string | null;
  created_at: string;
}

export interface Rating {
  id: string;
  rating: number;
  review_text: string | null;
  rater_role: RaterRole;
  created_at: string;
  rater: User;
}

export interface AdminStats {
  total_users: number;
  total_workers: number;
  total_employers: number;
  active_jobs: number;
  total_jobs: number;
  total_applications: number;
  completed_jobs: number;
}

export interface UnreadCountResponse {
  unread_count: number;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

// ─── API Request types ────────────────────────────────────────────────────────

export interface RegisterPayload {
  email: string;
  password: string;
  role: UserRole;
  phone?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ForgotPasswordEmailPayload {
  email: string;
}

export interface ForgotPasswordPhonePayload {
  phone: string;
}

export interface ForgotPasswordGenericResponse {
  message: string;
  cooldown_seconds?: number;
}

export interface VerifyRecoveryEmailPayload {
  email: string;
  otp_code: string;
}

export interface VerifyRecoveryPhonePayload {
  phone: string;
  otp_code: string;
}

export interface RecoveryVerifyResponse {
  message: string;
  reset_token: string;
  expires_in_minutes: number;
}

export interface ResetPasswordPayload {
  reset_token: string;
  new_password: string;
  confirm_password: string;
}

export interface ResetPasswordResponse {
  message: string;
}

export interface WorkerProfilePayload {
  full_name: string;
  bio?: string;
  city?: string;
  state?: string;
  years_experience: number;
  expected_salary?: number;
  salary_type: SalaryType;
  availability_status: AvailabilityStatus;
  preferred_work_types?: string[];
  profile_image_url?: string;
}

export interface JobCreatePayload {
  title: string;
  category_id: string;
  description: string;
  work_type: WorkType;
  city: string;
  state: string;
  salary_type: SalaryType;
  salary_min?: number;
  salary_max?: number;
  workers_needed?: number;
  experience_required?: number;
  is_urgent?: boolean;
  start_date?: string;
  end_date?: string;
  duration_days?: number;
  additional_requirements?: string;
  image_url?: string;
  required_skill_ids?: string[];
}

export interface JobFilters {
  keyword?: string;
  category_id?: string;
  city?: string;
  state?: string;
  work_type?: WorkType | '';
  salary_min?: number;
  salary_max?: number;
  is_urgent?: boolean;
  skill_id?: string;
  experience_max?: number;
  start_date_from?: string;
  sort_by?: string;
  worker_lat?: number;
  worker_lng?: number;
  radius_km?: number;
  same_day?: boolean;
  page?: number;
  per_page?: number;
}

// ─── Utility Types ────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ApiError {
  detail: string;
}

export interface PaginatedResponse<T> {
  total: number;
  page: number;
  per_page: number;
  pages: number;
  items: T[];
}

// ─── Matching ─────────────────────────────────────────────────────────────────

export interface MatchFactors {
  skills: number;
  location: number;
  experience: number;
  salary: number;
  work_type: number;
  availability: number;
  category: number;
}

export interface JobMatchResult {
  job_id: string;
  score: number;
  factors: MatchFactors;
  explanations: { key: string; args?: Record<string, any> }[];
}

export interface CandidateMatch {
  worker: WorkerProfile;
  match_score: number;
  match_factors: MatchFactors;
  match_explanations: { key: string; args?: Record<string, any> }[];
  application_status: ApplicationStatus | null;
}

// ─── Trust & Verification ───────────────────────────────────────────────────

export type VerificationType = 'PHONE' | 'IDENTITY' | 'SKILL' | 'PROFILE';
export type VerificationStatus = 'NOT_SUBMITTED' | 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';

export interface VerificationRecord {
  id: string;
  user_id: string;
  verification_type: VerificationType;
  status: VerificationStatus;
  document_type: string | null;
  has_document: boolean;
  rejection_reason: string | null;
  expires_at: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  metadata: Record<string, any> | null;
}

export interface PhoneOTPRequestPayload {
  phone: string;
}

export interface PhoneOTPVerifyPayload {
  phone: string;
  otp_code: string;
}

export interface PhoneVerificationResponse {
  message: string;
  phone: string;
  is_phone_verified: boolean;
  verified_at: string | null;
}

export interface SkillVerificationStatus {
  skill_id: string;
  status: VerificationStatus;
  certificate_title?: string | null;
}

export interface UserVerificationStatusSummary {
  phone?: string | null;
  phone_status: VerificationStatus;
  identity_status: VerificationStatus;
  company_status?: VerificationStatus | null;
  skills_status: SkillVerificationStatus[];
  is_verified: boolean;
  is_phone_verified: boolean;
  is_identity_verified: boolean;
  active_records: VerificationRecord[];
}

export interface AdminVerificationReviewPayload {
  decision: 'APPROVE' | 'REJECT' | 'REVOKE';
  rejection_reason?: string;
  expires_at?: string;
  reviewer_notes?: string;
}

export interface AdminQueueFilters {
  status?: string;
  type?: string;
  page?: number;
  per_page?: number;
}

export interface AdminProfile {
  id: string;
  user_id: string;
  email: string;
  role: UserRole;
  full_name: string;
  phone?: string | null;
  department?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminProfileUpdatePayload {
  full_name?: string;
  phone?: string | null;
  department?: string | null;
}

export interface AdminChangePasswordPayload {
  current_password: string;
  new_password: string;
}

export interface AdminChangePasswordResponse {
  message: string;
}

export interface AdminUserItem {
  id: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  full_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminUserListResponse {
  items: AdminUserItem[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface AdminWorkerListItem {
  id: string;
  user_id: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  bio?: string | null;
  city?: string | null;
  state?: string | null;
  experience_years?: number | null;
  hourly_rate?: number | null;
  daily_rate?: number | null;
  is_verified: boolean;
  is_identity_verified: boolean;
  is_phone_verified: boolean;
  is_active: boolean;
  skills: string[];
  created_at: string;
}

export interface AdminWorkerListResponse {
  items: AdminWorkerListItem[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface AdminEmployerListItem {
  id: string;
  user_id: string;
  full_name: string;
  organization_name?: string | null;
  organization_type?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  is_verified: boolean;
  is_active: boolean;
  active_jobs_count: number;
  total_jobs_count: number;
  created_at: string;
}

export interface AdminEmployerListResponse {
  items: AdminEmployerListItem[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface AdminJobListItem {
  id: string;
  employer_id: string;
  employer_name?: string | null;
  organization_name?: string | null;
  title: string;
  category_name?: string | null;
  work_type: WorkType;
  status: JobStatus;
  city?: string | null;
  state?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_type: SalaryType;
  applications_count: number;
  created_at: string;
}

export interface AdminJobListResponse {
  items: AdminJobListItem[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface AdminApplicationListItem {
  id: string;
  job_id: string;
  job_title: string;
  employer_name?: string | null;
  worker_id: string;
  worker_name: string;
  worker_email?: string | null;
  worker_phone?: string | null;
  status: ApplicationStatus;
  proposed_rate?: number | null;
  cover_letter?: string | null;
  applied_at: string;
}

export interface AdminApplicationListResponse {
  items: AdminApplicationListItem[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface AdminPaymentInstallmentItem {
  id: string;
  installment_number: number;
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string;
  payment_reference?: string | null;
  notes?: string | null;
  is_confirmed: boolean;
  worker_confirmed_at?: string | null;
}

export interface AdminCompletedWorkItem {
  completion_id: string;
  booking_id: string;
  job_title?: string | null;
  worker_name: string;
  employer_name: string;
  actual_start_time: string;
  actual_end_time: string;
  hours_worked: number;
  completion_notes?: string | null;
  agreed_amount: number;
  amount_paid: number;
  outstanding_balance: number;
  payment_status: PaymentStatus;
  dispute_reason?: string | null;
  disputed_at?: string | null;
  installments: AdminPaymentInstallmentItem[];
  completed_at: string;
}

export interface AdminCompletedWorkListResponse {
  items: AdminCompletedWorkItem[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// ─── Work Completion & Payment Records (Feature 3) ──────────────────────────

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

export type PaymentMethod = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'OTHER';

export type PaymentStatus = 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'PARTIALLY_PAID' | 'DISPUTED';

export interface ShiftBooking {
  id: string;
  worker_id: string;
  employer_id: string;
  job_id?: string | null;
  application_id?: string | null;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  proposed_rate?: number | null;
  cancellation_reason?: string | null;
  cancelled_by?: string | null;
  cancelled_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  job?: {
    id: string;
    title: string;
    city?: string;
    state?: string;
  } | null;
  worker?: {
    id: string;
    full_name: string;
    profile_image_url?: string;
  } | null;
  employer?: {
    id: string;
    full_name: string;
    organization_name?: string;
  } | null;
}

export interface PaymentInstallment {
  id: string;
  payment_record_id: string;
  installment_number: number;
  amount: number | string;
  payment_method: PaymentMethod;
  payment_date: string;
  payment_reference?: string | null;
  notes?: string | null;
  recorded_by: string;
  worker_confirmed_at?: string | null;
  is_confirmed: boolean;
  created_at: string;
}

export interface DisputeHistoryEntry {
  dispute_reason?: string | null;
  disputed_at?: string | null;
  disputed_by?: string | null;
  previous_amount_paid?: string | null;
  previous_payment_method?: string | null;
  previous_payment_date?: string | null;
  previous_payment_reference?: string | null;
  previous_notes?: string | null;
  previous_worker_confirmed_at?: string | null;
  correction_note?: string | null;
  corrected_at?: string | null;
}

export interface PaymentRecord {
  id: string;
  work_completion_id: string;
  shift_booking_id: string;
  agreed_amount: number | string;
  amount_paid: number | string;
  outstanding_balance: number | string;
  currency: string;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  payment_date: string;
  payment_reference?: string | null;
  notes?: string | null;
  employer_recorded_at: string;
  worker_confirmed_at?: string | null;
  dispute_reason?: string | null;
  disputed_at?: string | null;
  disputed_by?: string | null;
  dispute_history?: DisputeHistoryEntry[];
  installments: PaymentInstallment[];
  total_installments_count: number;
  is_partial: boolean;
  is_fully_paid: boolean;
  disclaimer: string;
  created_at: string;
  updated_at: string;
}

export interface WorkCompletion {
  id: string;
  shift_booking_id: string;
  actual_start_time: string;
  actual_end_time: string;
  hours_worked: number | string;
  completion_notes?: string | null;
  completed_by: string;
  created_at: string;
  updated_at: string;
}

export interface WorkCompletionWithPayment {
  id: string;
  shift_booking_id: string;
  actual_start_time: string;
  actual_end_time: string;
  hours_worked: number | string;
  completion_notes?: string | null;
  completed_by: string;
  payment_record?: PaymentRecord | null;
  created_at: string;
  updated_at: string;
}

export interface WorkCompletionCreatePayload {
  actual_start_time: string;
  actual_end_time: string;
  hours_worked: number;
  completion_notes?: string;
  agreed_amount?: number;
  amount_paid: number;
  payment_method: PaymentMethod;
  payment_date: string;
  payment_reference?: string;
  payment_notes?: string;
}

export interface PaymentDisputePayload {
  dispute_reason: string;
}

export interface PaymentUpdatePayload {
  installment_amount?: number;
  amount_paid?: number;
  payment_method?: PaymentMethod;
  payment_date?: string;
  payment_reference?: string;
  notes?: string;
  correction_note?: string;
}

export interface WorkHistoryItem {
  shift_booking: ShiftBooking;
  work_completion?: WorkCompletion | null;
  payment_record?: PaymentRecord | null;
  job_title?: string | null;
  counterpart_name?: string | null;
  counterpart_id?: string | null;
  can_rate: boolean;
  application_id?: string | null;
}

export interface WorkHistoryListResponse {
  items: WorkHistoryItem[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}
