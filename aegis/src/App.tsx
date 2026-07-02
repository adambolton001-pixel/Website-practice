import { Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './auth/AuthProvider';
import type { Role } from './lib/types';
import Layout from './components/Layout';
import { Loading } from './components/ui';
import Login from './features/auth/Login';
import Dashboard from './features/dashboard/Dashboard';
import Compliance from './features/compliance/Compliance';
import Boarding from './features/boarding/Boarding';
import RunSheet from './features/runsheet/RunSheet';
import Incidents from './features/incidents/Incidents';
import Parents from './features/parents/Parents';
import Invoicing from './features/invoicing/Invoicing';
import Tenders from './features/tenders/Tenders';
import Overview from './features/overview/Overview';
import AuditLog from './features/audit/AuditLog';

export const HOME: Record<Role, string> = {
  director: '/overview',
  manager: '/dashboard',
  driver: '/dashboard',
  pa: '/dashboard',
};

function RequireAuth({ children, allow }: { children: ReactNode; allow?: Role[] }) {
  const { profile, loading } = useAuth();
  if (loading) return <Loading />;
  if (!profile) return <Navigate to="/login" replace />;
  if (allow && !allow.includes(profile.role)) return <Navigate to={HOME[profile.role]} replace />;
  return <>{children}</>;
}

function RoleHome() {
  const { profile, loading } = useAuth();
  if (loading) return <Loading />;
  return <Navigate to={profile ? HOME[profile.role] : '/login'} replace />;
}

/** Exported without a router so tests can mount it inside MemoryRouter. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<RoleHome />} />
        <Route
          path="dashboard"
          element={
            <RequireAuth allow={['manager', 'driver', 'pa']}>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route
          path="overview"
          element={
            <RequireAuth allow={['director']}>
              <Overview />
            </RequireAuth>
          }
        />
        <Route
          path="compliance"
          element={
            <RequireAuth allow={['manager']}>
              <Compliance />
            </RequireAuth>
          }
        />
        <Route
          path="boarding"
          element={
            <RequireAuth allow={['manager', 'pa']}>
              <Boarding />
            </RequireAuth>
          }
        />
        <Route
          path="runsheet"
          element={
            <RequireAuth allow={['driver']}>
              <RunSheet />
            </RequireAuth>
          }
        />
        <Route
          path="incidents"
          element={
            <RequireAuth allow={['manager', 'driver', 'pa']}>
              <Incidents />
            </RequireAuth>
          }
        />
        <Route
          path="parents"
          element={
            <RequireAuth allow={['manager']}>
              <Parents />
            </RequireAuth>
          }
        />
        <Route
          path="invoicing"
          element={
            <RequireAuth allow={['director']}>
              <Invoicing />
            </RequireAuth>
          }
        />
        <Route
          path="tenders"
          element={
            <RequireAuth allow={['director']}>
              <Tenders />
            </RequireAuth>
          }
        />
        <Route
          path="audit"
          element={
            <RequireAuth allow={['manager', 'director']}>
              <AuditLog />
            </RequireAuth>
          }
        />
      </Route>
      <Route path="*" element={<RoleHome />} />
    </Routes>
  );
}

export default function App() {
  return <AppRoutes />;
}
