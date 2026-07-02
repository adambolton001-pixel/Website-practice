import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { backendMode } from '../lib/config';
import type { Role } from '../lib/types';

const NAV: Record<Role, { to: string; label: string }[]> = {
  director: [
    { to: '/overview', label: 'Overview' },
    { to: '/tenders', label: 'Tenders & bids' },
    { to: '/invoicing', label: 'Invoicing' },
    { to: '/audit', label: 'Access log' },
  ],
  manager: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/compliance', label: 'Compliance vault' },
    { to: '/boarding', label: 'Boarding register' },
    { to: '/incidents', label: 'Incidents' },
    { to: '/parents', label: 'Parent updates' },
    { to: '/audit', label: 'Access log' },
  ],
  driver: [
    { to: '/dashboard', label: 'My day' },
    { to: '/runsheet', label: 'Run sheet' },
    { to: '/incidents', label: 'Incidents' },
  ],
  pa: [
    { to: '/dashboard', label: 'My day' },
    { to: '/boarding', label: 'Boarding register' },
    { to: '/incidents', label: 'Incidents' },
  ],
};

export const ROLE_LABEL: Record<Role, string> = {
  director: 'Director',
  manager: 'Manager',
  driver: 'Driver',
  pa: 'Passenger assistant',
};

export default function Layout() {
  const { profile, signOut } = useAuth();
  if (!profile) return null;
  const items = NAV[profile.role];

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="mark" aria-hidden="true">
            A
          </div>
          <div>
            <div className="name">Aegis</div>
            <div className="tag">safeguarding first</div>
          </div>
        </div>
        <div className="nav-label">
          {profile.role === 'director'
            ? 'Commercial'
            : profile.role === 'manager'
              ? 'Operations'
              : 'Your day'}
        </div>
        <nav aria-label="Main">
          {items.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) => 'navitem' + (isActive ? ' active' : '')}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          Data held in the UK
          <br />
          Access logged · role-based
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          {backendMode === 'live' ? (
            <span className="demo-pill">
              <span className="dot" aria-hidden="true" />
              Live · access enforced by the database
            </span>
          ) : (
            <span className="demo-pill demo">
              <span className="dot" aria-hidden="true" />
              Demo mode · sample data, stored only in this browser
            </span>
          )}
          <div className="user">
            <div className="who">
              <div className="who-name">{profile.fullName}</div>
              <div className="who-role">{ROLE_LABEL[profile.role]}</div>
            </div>
            <button className="signout" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
