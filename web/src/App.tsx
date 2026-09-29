import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { RoleProvider, useRole } from './context/RoleContext';
import { AccessibilityProvider } from './context/AccessibilityContext';
import { AppLayout } from './components/layout/AppLayout';
import { TeacherDashboardPage } from './pages/teacher/TeacherDashboardPage';
import { WizardPage } from './pages/teacher/WizardPage';
import { UnitPackPage } from './pages/teacher/UnitPackPage';
import { AnalyticsPage } from './pages/teacher/AnalyticsPage';
import { SettingsPage } from './pages/teacher/SettingsPage';
import { StudentLearningPage } from './pages/student/StudentLearningPage';
import { StudentUnitHomePage } from './pages/student/StudentUnitHomePage';
import { StudentQuizPage } from './pages/student/StudentQuizPage';
import { StudentProgressPage, PlaceholderPage } from './pages/student/StudentProgressPage';

const AppRoutes: React.FC = () => {
  const { role } = useRole();

  return (
    <AppLayout>
      <Routes>
        {/* Teacher Routes */}
        <Route path="/" element={<TeacherDashboardPage />} />
        <Route path="/create" element={<WizardPage />} />
        <Route path="/units" element={<TeacherDashboardPage />} />
        <Route path="/units/:id" element={<UnitPackPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/settings" element={<SettingsPage />} />

        {/* Student Routes */}
        <Route path="/student" element={<StudentLearningPage />} />
        <Route path="/student/units/:id" element={<StudentUnitHomePage />} />
        <Route path="/student/quiz/:id" element={<StudentQuizPage />} />
        <Route path="/student/progress" element={<StudentProgressPage />} />
        <Route
          path="/student/notes"
          element={
            <PlaceholderPage
              title="Student Study Notes"
              subtitle="Personal annotations and key concept study notes will be stored here."
            />
          }
        />

        {/* Catch-all Redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
};

export function App() {
  return (
    <RoleProvider>
      <AccessibilityProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AccessibilityProvider>
    </RoleProvider>
  );
}

export default App;

