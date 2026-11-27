-- KAAMSETU RLS & PRIVILEGE REMEDIATION (APPLY ONLY AFTER EXPLICIT APPROVAL)
-- Safe for FastAPI backend connecting directly as PostgreSQL owner role (`postgres`).
-- Blocks all Supabase PostgREST / Data API access via `anon`, `authenticated`, and `PUBLIC`.
BEGIN;
SET LOCAL lock_timeout = '5s';

REVOKE ALL PRIVILEGES ON TABLE
    public.admin_profiles,
    public.alembic_version,
    public.conversations,
    public.employer_profiles,
    public.job_applications,
    public.job_categories,
    public.job_required_skills,
    public.jobs,
    public.messages,
    public.notifications,
    public.otp_challenges,
    public.password_reset_authorizations,
    public.payment_installments,
    public.payment_records,
    public.ratings,
    public.saved_jobs,
    public.saved_workers,
    public.shift_bookings,
    public.skills,
    public.users,
    public.verification_records,
    public.work_completions,
    public.worker_availability,
    public.worker_profiles,
    public.worker_skills
FROM anon, authenticated, PUBLIC;

REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated, PUBLIC;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated, PUBLIC;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL ON TABLES FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    REVOKE ALL ON SEQUENCES FROM anon, authenticated, PUBLIC;

ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alembic_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_required_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_skills ENABLE ROW LEVEL SECURITY;

COMMIT;
