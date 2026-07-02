/**
 * Route-guard tests: every route declares which roles may enter; a signed-in
 * user with the wrong role is redirected to their own home, and signed-out
 * users land on the login screen.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppRoutes } from './App';
import { AuthProvider } from './auth/AuthProvider';
import { resetDemoData, setSessionUserId } from './api/demo/store';

function mount(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  resetDemoData();
});

describe('route guards', () => {
  it('signed-out users are sent to the login screen', async () => {
    mount('/compliance');
    expect(await screen.findByText('Try Aegis')).toBeInTheDocument();
  });

  it('a director hitting the compliance vault is redirected to their overview', async () => {
    setSessionUserId('p-director');
    mount('/compliance');
    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();
  });

  it('a PA hitting invoicing is redirected to their day view', async () => {
    setSessionUserId('p-pa');
    mount('/invoicing');
    expect(await screen.findByRole('heading', { name: /Your day/ })).toBeInTheDocument();
  });

  it('a driver cannot open the boarding register (read-only role)', async () => {
    setSessionUserId('p-driver');
    mount('/boarding');
    expect(await screen.findByRole('heading', { name: /Your day/ })).toBeInTheDocument();
  });

  it('the manager can open the compliance vault', async () => {
    setSessionUserId('p-manager');
    mount('/compliance');
    expect(await screen.findByRole('heading', { name: 'Compliance vault' })).toBeInTheDocument();
  });

  it('a PA can open the boarding register', async () => {
    setSessionUserId('p-pa');
    mount('/boarding');
    expect(await screen.findByRole('heading', { name: 'Boarding register' })).toBeInTheDocument();
  });
});
