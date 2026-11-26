import React, { Suspense, lazy, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { UserRole } from '../../types';

// Mobile Layouts
import WorkerMobileLayout from '../layouts/WorkerMobileLayout';
import EmployerMobileLayout from '../layouts/EmployerMobileLayout';
import AdminLayout from '../../layouts/AdminLayout';

// Mobile Pages
import MobileSplashScreen from '../components/MobileSplashScreen';
import MobileHomePage from '../pages/MobileHomePage';
import MobileLoginPage from '../pages/MobileLoginPage';
import MobileRegisterPage from '../pages/MobileRegisterPage';
import MobileNotificationsPage from '../pages/shared/MobileNotificationsPage';
import MobileMessagesPage from '../pages/shared/MobileMessagesPage';

// Worker Mobile Pages
import MobileWorkerDashboard from '../pages/worker/MobileWorkerDashboard';
import MobileFindJobsPage from '../pages/worker/MobileFindJobsPage';
import MobileWorkerProfilePage from '../pages/worker/MobileWorkerProfilePage';
import MobileWorkerShiftsPage from '../pages/worker/MobileWorkerShiftsPage';
import MobileWorkerVerificationCenter from '../components/MobileWorkerVerificationCenter';

// Employer Mobile Pages
import MobileEmployerDashboard from '../pages/employer/MobileEmployerDashboard';
import MobileHireWorkersPage from '../pages/employer/MobileHireWorkersPage';
import MobileMyJobsPage from '../pages/employer/MobileMyJobsPage';
import MobilePostJobPage from '../pages/employer/MobilePostJobPage';
import MobileEmployerProfilePage from '../pages/employer/MobileEmployerProfilePage';
import MobileEmployerVerificationCenter from '../components/MobileEmployerVerificationCenter';

// Shared existing sub-pages (lazy loaded)
const ForgotPasswordPage = lazy(() => import('../../pages/auth/ForgotPasswordPage'));
const SavedJobsPage = lazy(() => import('../../pages/worker/SavedJobsPage'));
const MyApplications = lazy(() => import('../../pages/worker/MyApplications'));
const MyAvailabilityPage = lazy(() => import('../../pages/worker/MyAvailabilityPage'));
const JobApplicantsPage = lazy(() => import('../../pages/employer/JobApplicantsPage'));
const EmployerWorkerDetailPage = lazy(() => import('../../pages/employer/EmployerWorkerDetailPage'));
const SavedWorkersPage = lazy(() => import('../../pages/employer/SavedWorkersPage'));
const EmployerShiftBookingsPage = lazy(() =>
  import('../../pages/employer/EmployerShiftBookingsPage').then((m) => ({ default: m.EmployerShiftBookingsPage }))
);

// Admin Pages (preserved)
const AdminDashboard = lazy(() => import('../../pages/admin/AdminDashboard'));
const AdminProfilePage = lazy(() => import('../../pages/admin/AdminProfilePage'));
const AdminUsersPage = lazy(() => import('../../pages/admin/AdminUsersPage'));
const AdminWorkersPage = lazy(() => import('../../pages/admin/AdminWorkersPage'));
const AdminEmployersPage = lazy(() => import('../../pages/admin/AdminEmployersPage'));
const AdminJobsPage = lazy(() => import('../../pages/admin/AdminJobsPage'));
const AdminApplicationsPage = lazy(() => import('../../pages/admin/AdminApplicationsPage'));
const AdminPaymentsPage = lazy(() => import('../../pages/admin/AdminPaymentsPage'));
const AdminVerificationsPage = lazy(() => import('../../pages/admin/AdminVerificationsPage'));

// Loading Screen
import LoadingScreen from '../../components/common/LoadingScreen';

// Protected Route Guard
function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: UserRole[] }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) return <LoadingScreen />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    const dashboardMap: Record<UserRole, string> = {
      WORKER: '/worker/dashboard',
      EMPLOYER: '/employer/dashboard',
      ADMIN: '/admin/dashboard',
    };
    return <Navigate to={dashboardMap[user.role]} replace />;
  }

  return <>{children}</>;
}

// After Auth Redirect
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

export const MobileAppRouter: React.FC = () => {
  const [splashFinished, setSplashFinished] = useState(false);

  return (
    <>
      {/* 1. Branded Native Startup Splash Screen */}
      {!splashFinished && (
        <MobileSplashScreen onFinish={() => setSplashFinished(true)} />
      )}

      {/* 2. Main Mobile Routes */}
      <BrowserRouter>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            {/* Public */}
            <Route path="/" element={<MobileHomePage />} />
            <Route
              path="/login"
              element={
                <>
                  <AuthRedirect />
                  <MobileLoginPage />
                </>
              }
            />
            <Route
              path="/register"
              element={
                <>
                  <AuthRedirect />
                  <MobileRegisterPage />
                </>
              }
            />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/notifications" element={<MobileNotificationsPage />} />

            {/* Worker Mobile Routes */}
            <Route
              element={
                <ProtectedRoute allowedRoles={['WORKER']}>
                  <WorkerMobileLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/worker/dashboard" element={<MobileWorkerDashboard />} />
              <Route path="/worker/jobs" element={<MobileFindJobsPage />} />
              <Route path="/worker/jobs/:id" element={<MobileFindJobsPage />} />
              <Route path="/worker/saved-jobs" element={<SavedJobsPage />} />
              <Route path="/worker/applications" element={<MyApplications />} />
              <Route path="/worker/shifts" element={<MobileWorkerShiftsPage />} />
              <Route path="/worker/availability" element={<MyAvailabilityPage />} />
              <Route path="/worker/profile" element={<MobileWorkerProfilePage />} />
              <Route path="/worker/verification" element={<MobileWorkerVerificationCenter />} />
              <Route path="/worker/messages" element={<MobileMessagesPage />} />
            </Route>

            {/* Employer Mobile Routes */}
            <Route
              element={
                <ProtectedRoute allowedRoles={['EMPLOYER']}>
                  <EmployerMobileLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/employer/dashboard" element={<MobileEmployerDashboard />} />
              <Route path="/employer/candidates" element={<MobileHireWorkersPage />} />
              <Route path="/employer/post-job" element={<MobilePostJobPage />} />
              <Route path="/employer/jobs" element={<MobileMyJobsPage />} />
              <Route path="/employer/jobs/:id/applicants" element={<JobApplicantsPage />} />
              <Route path="/employer/jobs/:id/candidates" element={<MobileHireWorkersPage />} />
              <Route path="/employer/workers/:id" element={<EmployerWorkerDetailPage />} />
              <Route path="/employer/saved-workers" element={<SavedWorkersPage />} />
              <Route path="/employer/profile" element={<MobileEmployerProfilePage />} />
              <Route path="/employer/verification" element={<MobileEmployerVerificationCenter />} />
              <Route path="/employer/shifts" element={<EmployerShiftBookingsPage />} />
              <Route path="/employer/messages" element={<MobileMessagesPage />} />
            </Route>

            {/* Admin (Preserved) */}
            <Route
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/admin/workers" element={<AdminWorkersPage />} />
              <Route path="/admin/employers" element={<AdminEmployersPage />} />
              <Route path="/admin/jobs" element={<AdminJobsPage />} />
              <Route path="/admin/applications" element={<AdminApplicationsPage />} />
              <Route path="/admin/verifications" element={<AdminVerificationsPage />} />
              <Route path="/admin/payments" element={<AdminPaymentsPage />} />
              <Route path="/admin/profile" element={<AdminProfilePage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </>
  );
};

export default MobileAppRouter;
