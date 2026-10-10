import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { RoleProvider, useRole } from './context/RoleContext';
import { AccessibilityProvider } from './context/AccessibilityContext';
import { SearchProvider } from './context/SearchContext';
import { ThemeProvider } from './context/ThemeContext';
import { AppLayout } from './components/layout/AppLayout';
import { TeacherDashboardPage } from './pages/teacher/TeacherDashboardPage';
import { WizardPage } from './pages/teacher/WizardPage';
import { UnitPackPage } from './pages/teacher/UnitPackPage';
import { AnalyticsPage } from './pages/teacher/AnalyticsPage';
import { AttendancePage } from './pages/teacher/AttendancePage';
import { SettingsPage } from './pages/teacher/SettingsPage';
import { TrustSafetyPage } from './pages/teacher/TrustSafetyPage';
import { StudentLearningPage } from './pages/student/StudentLearningPage';
import { StudentUnitHomePage } from './pages/student/StudentUnitHomePage';
import { StudentQuizPage } from './pages/student/StudentQuizPage';
import { StudentProgressPage, PlaceholderPage } from './pages/student/StudentProgressPage';
import { LoginPage } from './pages/LoginPage';

/**
 * Route protector verifying that a valid user session exists.
 * If user logged out or session was cleared, immediately redirects to /login.
 * Also enforces role isolation between teacher workspace and student portal.
 */
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  allowedRole?: 'teacher' | 'student';
}> = ({ children, allowedRole }) => {
  const { role } = useRole();
  const storedRole = localStorage.getItem('lessonfoundry_role');

  if (!storedRole || !role) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRole && role !== allowedRole) {
    return <Navigate to={role === 'teacher' ? '/' : '/student'} replace />;
  }

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Standalone Login Route */}
      <Route path="/login" element={<LoginPage />} />

      {/* Main Application Routes inside AppLayout */}
      <Route
        path="/*"
        element={
          <AppLayout>
            <Routes>
              {/* Teacher Routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute allowedRole="teacher">
                    <TeacherDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/attendance"
                element={
                  <ProtectedRoute allowedRole="teacher">
                    <AttendancePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/create"
                element={
                  <ProtectedRoute allowedRole="teacher">
                    <WizardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/units"
                element={
                  <ProtectedRoute allowedRole="teacher">
                    <TeacherDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/units/:id"
                element={
                  <ProtectedRoute allowedRole="teacher">
                    <UnitPackPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/analytics"
                element={
                  <ProtectedRoute allowedRole="teacher">
                    <AnalyticsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/trust-safety"
                element={
                  <ProtectedRoute allowedRole="teacher">
                    <TrustSafetyPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />

              {/* Student Routes */}
              <Route
                path="/student"
                element={
                  <ProtectedRoute allowedRole="student">
                    <StudentLearningPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/student/units/:id"
                element={
                  <ProtectedRoute allowedRole="student">
                    <StudentUnitHomePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/student/quiz/:id"
                element={
                  <ProtectedRoute allowedRole="student">
                    <StudentQuizPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/student/progress"
                element={
                  <ProtectedRoute allowedRole="student">
                    <StudentProgressPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/student/notes"
                element={
                  <ProtectedRoute allowedRole="student">
                    <PlaceholderPage
                      title="Student Study Notes"
                      subtitle="Personal annotations and key concept study notes will be stored here."
                    />
                  </ProtectedRoute>
                }
              />

              {/* Catch-all Redirect */}
              <Route
                path="*"
                element={
                  <ProtectedRoute>
                    <Navigate to="/" replace />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AppLayout>
        }
      />
    </Routes>
  );
};

export function App() {
  return (
    <ThemeProvider>
      <RoleProvider>
        <AccessibilityProvider>
          <SearchProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </SearchProvider>
        </AccessibilityProvider>
      </RoleProvider>
    </ThemeProvider>
  );
}

export default App;
