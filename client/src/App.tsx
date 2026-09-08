import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import LoadingPanel from './components/common/Loading';
import RequireRole from './components/RequireRole';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AnalyticsPage from './pages/AnalyticsPage';
import JobsPage from './pages/JobsPage';
import UploadPage from './pages/UploadPage';
import CandidatesPage from './pages/CandidatesPage';
import CandidateDetailPage from './pages/CandidateDetailPage';
import CandidateEvaluationReportPage from './pages/CandidateEvaluationReportPage';
import ConfigurationPage from './pages/ConfigurationPage';
import UsersPage from './pages/UsersPage';
import AuditLogPage from './pages/AuditLogPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import InterviewPage from './pages/InterviewPage';
import AppShell from './components/shell/AppShell';

/**
 * Auth gate for everything behind the login page. The chrome itself lives in
 * AppShell; this only decides whether the user gets to see it.
 */
function ProtectedLayout() {
  const { isAuthenticated, loading, mustChangePassword } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingPanel label="Loading…" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // First-login (or post-reset) users are confined to the change-password page
  // until they set a new password.
  if (mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  return <AppShell />;
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route
              path="/analytics"
              element={
                <RequireRole roles={['SuperAdmin', 'Admin', 'Recruiter']}>
                  <AnalyticsPage />
                </RequireRole>
              }
            />
            <Route
              path="/jobs"
              element={
                <RequireRole roles={['SuperAdmin', 'Admin', 'Recruiter']}>
                  <JobsPage />
                </RequireRole>
              }
            />
            <Route
              path="/upload"
              element={
                <RequireRole roles={['SuperAdmin', 'Admin', 'Recruiter']}>
                  <UploadPage />
                </RequireRole>
              }
            />
            <Route
              path="/candidates"
              element={
                <RequireRole roles={['SuperAdmin', 'Admin', 'Recruiter']}>
                  <CandidatesPage />
                </RequireRole>
              }
            />
            <Route
              path="/candidates/:id"
              element={
                <RequireRole roles={['SuperAdmin', 'Admin', 'Recruiter']}>
                  <CandidateDetailPage />
                </RequireRole>
              }
            />
            <Route
              path="/candidates/:id/evaluations"
              element={
                <RequireRole roles={['SuperAdmin', 'Admin', 'Recruiter']}>
                  <CandidateEvaluationReportPage />
                </RequireRole>
              }
            />
            <Route path="/interviews/:id" element={<InterviewPage />} />
            <Route
              path="/configuration"
              element={
                <RequireRole roles={['SuperAdmin', 'Admin']}>
                  <ConfigurationPage />
                </RequireRole>
              }
            />
            <Route
              path="/audit"
              element={
                <RequireRole roles={['SuperAdmin', 'Admin']}>
                  <AuditLogPage />
                </RequireRole>
              }
            />
            <Route
              path="/users"
              element={
                <RequireRole roles={['SuperAdmin']}>
                  <UsersPage />
                </RequireRole>
              }
            />
            <Route path="/change-password" element={<ChangePasswordPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
