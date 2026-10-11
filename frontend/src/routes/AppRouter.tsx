// KaamSetu — App Router
import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../types';

// Layouts
import PublicLayout from '../layouts/PublicLayout';
import WorkerLayout from '../layouts/WorkerLayout';
import EmployerLayout from '../layouts/EmployerLayout';
import AdminLayout from '../layouts/AdminLayout';

// Public pages
import LandingPage from '../pages/public/LandingPage';
const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('../pages/auth/RegisterPage'));
const AboutPage = lazy(() => import('../pages/public/AboutPage'));
const HowItWorksPage = lazy(() => import('../pages/public/HowItWorksPage'));

// Worker pages
const WorkerDashboard = lazy(() => import('../pages/worker/WorkerDashboard'));
const FindJobs = lazy(() => import('../pages/worker/FindJobs'));
const JobDetailsPage = lazy(() => import('../pages/worker/JobDetailsPage'));
const MyApplications = lazy(() => import('../pages/worker/MyApplications'));
const WorkerProfilePage = lazy(() => import('../pages/worker/WorkerProfilePage'));
const SavedJobsPage = lazy(() => import('../pages/worker/SavedJobsPage'));
const WorkerShiftBookingsPage = lazy(() => import('../pages/worker/WorkerShiftBookingsPage'));
const MyAvailabilityPage = lazy(() => import('../pages/worker/MyAvailabilityPage'));

// Employer pages
const EmployerDashboard = lazy(() => import('../pages/employer/EmployerDashboard'));
const PostJobPage = lazy(() => import('../pages/employer/PostJobPage'));
const MyJobsPage = lazy(() => import('../pages/employer/MyJobsPage'));
const JobApplicantsPage = lazy(() => import('../pages/employer/JobApplicantsPage'));
const JobCandidatesPage = lazy(() => import('../pages/employer/JobCandidatesPage'));
const EmployerProfilePage = lazy(() => import('../pages/employer/EmployerProfilePage'));
const EmployerShiftBookingsPage = lazy(() =>
  import('../pages/employer/EmployerShiftBookingsPage').then((m) => ({ default: m.EmployerShiftBookingsPage }))
);
const SavedWorkersPage = lazy(() => import('../pages/employer/SavedWorkersPage'));

// Admin pages
const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard'));

// Shared pages
const MessagesPage = lazy(() => import('../pages/shared/MessagesPage'));

// Loading
import LoadingScreen from '../components/common/LoadingScreen';

// ─── Protected Route ──────────────────────────────────────────────────────────

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) return <LoadingScreen />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // Redirect to their own dashboard
    const dashboardMap: Record<UserRole, string> = {
      WORKER: '/worker/dashboard',
      EMPLOYER: '/employer/dashboard',
      ADMIN: '/admin/dashboard',
    };
    return <Navigate to={dashboardMap[user.role]} replace />;
  }

  return <>{children}</>;
}

// ─── After-Auth Redirect ──────────────────────────────────────────────────────

function AuthRedirect() {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;

  if (isAuthenticated && user) {
    const dashboardMap: Record<UserRole, string> = {
      WORKER: '/worker/dashboard',
      EMPLOYER: '/employer/dashboard',
      ADMIN: '/admin/dashboard',
    };
    return <Navigate to={dashboardMap[user.role]} replace />;
  }

  return null;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          {/* ── Public ─────────────────────────────────────────────── */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/how-it-works" element={<HowItWorksPage />} />
            <Route
              path="/login"
              element={
                <>
                  <AuthRedirect />
                  <LoginPage />
                </>
              }
            />
            <Route
              path="/register"
              element={
                <>
                  <AuthRedirect />
                  <RegisterPage />
                </>
              }
            />
          </Route>

          {/* ── Worker ─────────────────────────────────────────────── */}
          <Route
            element={
              <ProtectedRoute allowedRoles={['WORKER']}>
                <WorkerLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/worker/dashboard" element={<WorkerDashboard />} />
            <Route path="/worker/jobs" element={<FindJobs />} />
            <Route path="/worker/jobs/:id" element={<JobDetailsPage />} />
            <Route path="/worker/saved-jobs" element={<SavedJobsPage />} />
            <Route path="/worker/applications" element={<MyApplications />} />
            <Route path="/worker/shifts" element={<WorkerShiftBookingsPage />} />
            <Route path="/worker/availability" element={<MyAvailabilityPage />} />
            <Route path="/worker/profile" element={<WorkerProfilePage />} />
            <Route path="/worker/messages" element={<MessagesPage />} />
          </Route>

          {/* ── Employer ───────────────────────────────────────────── */}
          <Route
            element={
              <ProtectedRoute allowedRoles={['EMPLOYER']}>
                <EmployerLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/employer/dashboard" element={<EmployerDashboard />} />
            <Route path="/employer/post-job" element={<PostJobPage />} />
            <Route path="/employer/jobs/:id/edit" element={<PostJobPage />} />
            <Route path="/employer/jobs" element={<MyJobsPage />} />
            <Route path="/employer/jobs/:id/applicants" element={<JobApplicantsPage />} />
            <Route path="/employer/jobs/:id/candidates" element={<JobCandidatesPage />} />
            <Route path="/employer/saved-workers" element={<SavedWorkersPage />} />
            <Route path="/employer/profile" element={<EmployerProfilePage />} />
            <Route path="/employer/shifts" element={<EmployerShiftBookingsPage />} />
            <Route path="/employer/messages" element={<MessagesPage />} />
          </Route>

          {/* ── Admin ──────────────────────────────────────────────── */}
          <Route
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
          </Route>

          {/* ── Fallback ───────────────────────────────────────────── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
