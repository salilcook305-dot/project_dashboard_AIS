import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';

import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { MyDiaryPage } from './pages/MyDiaryPage';
import { TeamDirectoryPage } from './pages/TeamDirectoryPage';
import { TeamManagementPage } from './pages/TeamManagementPage';
import { SystemLogsPage } from './pages/SystemLogsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 60 * 1000,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Application Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout>
                  <DashboardPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/projects"
            element={<Navigate to="/" replace />}
          />

          <Route
            path="/diary"
            element={
              <ProtectedRoute>
                <Layout>
                  <MyDiaryPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/team"
            element={
              <ProtectedRoute>
                <Layout>
                  <TeamDirectoryPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/team-management"
            element={
              <ProtectedRoute>
                <Layout>
                  <TeamManagementPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/logs"
            element={
              <ProtectedRoute>
                <Layout>
                  <SystemLogsPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route path="/system-logs" element={<Navigate to="/logs" replace />} />

          {/* Retired / Redirected routes to Dashboard */}
          <Route path="/analytics" element={<Navigate to="/" replace />} />
          <Route path="/documents" element={<Navigate to="/" replace />} />
          <Route path="/roadmap" element={<Navigate to="/" replace />} />

          {/* Catch-all redirect to Dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
};

export default App;
