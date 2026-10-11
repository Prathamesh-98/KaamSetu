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

