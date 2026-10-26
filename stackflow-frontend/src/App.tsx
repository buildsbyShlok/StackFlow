import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import AuthProvider from "@/context/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/layouts/AppLayout";
import AuthPage from "@/pages/auth/AuthPage";
import Dashboard from "@/pages/dashboard/Dashboard";
import Projects from "@/pages/projects/Projects";
import ProjectDetails from "@/pages/projects/ProjectDetails";
import Tasks from "@/pages/tasks/Tasks";
import TaskDetails from "@/pages/tasks/TaskDetails";
import Verification from "@/pages/Verification";
import Team from "@/pages/Team";
import { EmptyState } from "@/components/common";
import ErrorBoundary from "@/components/ErrorBoundary";
export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<AuthPage />} />
            <Route
              path="/register"
              element={<AuthPage key="register" register />}
            />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="profile" element={null} />
              <Route path="projects" element={<Projects />} />
              <Route path="projects/:projectId" element={<ProjectDetails />} />
              <Route path="my-tasks" element={<Tasks />} />
              <Route path="tasks/details/:taskId" element={<TaskDetails />} />
              <Route path="tasks/:milestoneId" element={<Tasks />} />
              <Route path="verification" element={<Verification />} />
              <Route path="team" element={<Team />} />
              <Route
                path="*"
                element={
                  <EmptyState
                    title="That page isn’t here."
                    description="Return to your workspace to keep moving."
                  >
                    <Link to="/" className="text-button">
                      Go to overview
                    </Link>
                  </EmptyState>
                }
              />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
