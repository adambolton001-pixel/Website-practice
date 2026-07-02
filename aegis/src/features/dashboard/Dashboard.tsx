import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../auth/AuthProvider';
import { MARK_LIGHT, Spark } from '../../components/charts';
import { Card, Chip, Empty, ErrorNote, Loading } from '../../components/ui';
import { daysLeft, expLabel, statusOf, todayISO } from '../../lib/status';

export default function Dashboard() {
  const { profile } = useAuth();
  if (!profile) return null;
  if (profile.role === 'manager') return <ManagerDashboard />;
  return <StaffDashboard role={profile.role} name={profile.fullName} />;
}

function StaffDashboard({ role, name }: { role: string; name: string }) {
  const go = role === 'driver' ? '/runsheet' : '/boarding';
  const label = role === 'driver' ? 'Open run sheet' : 'Open boarding register';

  const runs = useQuery({ queryKey: ['runs'], queryFn: () => api().listRuns() });
  const boardings = useQuery({
    queryKey: ['boardings', todayISO()],
    queryFn: () => api().listBoardings(todayISO()),
  });
  const creds = useQuery({
    queryKey: ['staffCreds'],
    queryFn: () => api().listStaffWithCredentials(),
  });

  const myCreds = (creds.data ?? []).flatMap((s) => s.credentials);
  const expiring = myCreds.filter((c) => statusOf(c.expiryDate) !== 'green');
  const run = runs.data?.[0];
  const done = run
    ? run.children.filter((c) =>
        (boardings.data ?? []).some((b) => b.childId === c.id && b.state !== 'waiting'),
      ).length
    : 0;

  return (
    <>
      <div className="page-head">
        <span className="role-note">
          {role === 'driver' ? 'Driver' : 'Passenger assistant'} · your run only
        </span>
        <h1>Your day{name ? `, ${name.split(' ')[0]}` : ''}</h1>
        <p>
          You can see only your assigned run and your own checks. Everything else is off your
          sign-in.
        </p>
      </div>

      {runs.isPending ? (
        <Loading />
      ) : runs.isError ? (
        <ErrorNote message={(runs.error as Error).message} />
      ) : !run ? (
        <Card>
          <Empty big="No run assigned">Nothing scheduled for your sign-in today.</Empty>
        </Card>
      ) : (
        <div className="grid cols-2">
          <div className="stat">
            <div className="num">
              {done}/{run.children.length}
            </div>
            <div className="cap">
              children on board today · {run.name} → {run.school}
            </div>
          </div>
          <div className={'stat ' + (expiring.length ? 'amber' : 'green')}>
            <div className="num">{expiring.length}</div>
            <div className="cap">of your own certificates need renewing</div>
          </div>
        </div>
      )}

      {expiring.length > 0 && (
        <Card pad>
          <div className="section-title">Your certificates</div>
          {expiring.map((c) => (
            <div className="att-row" key={c.id}>
              <div>
                <div className="att-who">{c.kind}</div>
                <div className="att-what">{c.reference}</div>
              </div>
              <div className="att-meta">
                <Chip tone={statusOf(c.expiryDate)}>{expLabel(c.expiryDate)}</Chip>
              </div>
            </div>
          ))}
        </Card>
      )}

      <div style={{ marginTop: 18 }}>
        <Link className="btn-primary" to={go}>
          {label}
        </Link>
      </div>
    </>
  );
}

function ManagerDashboard() {
  const staff = useQuery({
    queryKey: ['staffCreds'],
    queryFn: () => api().listStaffWithCredentials(),
  });
  const vehicles = useQuery({
    queryKey: ['vehicleChecks'],
    queryFn: () => api().listVehiclesWithChecks(),
  });
  const incidents = useQuery({ queryKey: ['incidents'], queryFn: () => api().listIncidents() });
  const boardings = useQuery({
    queryKey: ['boardings', todayISO()],
    queryFn: () => api().listBoardings(todayISO()),
  });
  const series = useQuery({
    queryKey: ['boardingSeries', 14],
    queryFn: () => api().listBoardingSeries(14),
  });

  if (staff.isPending || vehicles.isPending) return <Loading />;
  if (staff.isError || vehicles.isError)
    return (
      <div className="page-head">
        <h1>Dashboard</h1>
        <ErrorNote message={((staff.error || vehicles.error) as Error).message} />
      </div>
    );

  const items = [
    ...(staff.data ?? []).flatMap((s) =>
      s.credentials.map((c) => ({ who: s.fullName, what: c.kind, exp: c.expiryDate })),
    ),
    ...(vehicles.data ?? []).flatMap((v) =>
      v.checks.map((c) => ({ who: v.reg, what: c.kind, exp: c.expiryDate })),
    ),
  ];
  const tally = { red: 0, amber: 0, green: 0 };
  items.forEach((i) => {
    tally[statusOf(i.exp)]++;
  });
  const attention = items
    .filter((i) => statusOf(i.exp) !== 'green')
    .sort((a, b) => daysLeft(a.exp) - daysLeft(b.exp));

  const openIncidents = (incidents.data ?? []).filter((i) => i.status !== 'closed').length;
  const onBoardNow = (boardings.data ?? []).filter((b) => b.state === 'onboard').length;

  return (
    <>
      <div className="page-head">
        <span className="role-note">Manager · operations</span>
        <h1>Good morning</h1>
        <p>Compliance, boarding and incidents across the whole operation, live from the backend.</p>
      </div>

      <div className="grid cols-3">
        <div className={'stat ' + (tally.red ? 'red' : 'green')}>
          <div className="num">{tally.red}</div>
          <div className="cap">Records expired</div>
        </div>
        <div className={'stat ' + (tally.amber ? 'amber' : 'green')}>
          <div className="num">{tally.amber}</div>
          <div className="cap">Expiring within 30 days</div>
        </div>
        <div className="stat green">
          <div className="num">{tally.green}</div>
          <div className="cap">Valid &amp; on file</div>
        </div>
      </div>

      <div className="grid cols-3" style={{ marginTop: 16 }}>
        <div className="stat">
          <div className="num">{onBoardNow}</div>
          <div className="cap">children on board right now</div>
        </div>
        <div className={'stat ' + (openIncidents ? 'amber' : 'green')}>
          <div className="num">{openIncidents}</div>
          <div className="cap">open incidents</div>
        </div>
        <div className="stat">
          {series.data && series.data.length > 0 ? (
            <Spark
              values={series.data.map((s) => s.dropped)}
              mark={MARK_LIGHT}
              ariaLabel={`Children taken safely to school per day over the last 14 days; latest ${series.data[series.data.length - 1]?.dropped ?? 0}`}
              lastLabel={String(series.data[series.data.length - 1]?.dropped ?? 0)}
            />
          ) : (
            <div className="num">—</div>
          )}
          <div className="cap">safely to school · last 14 days</div>
        </div>
      </div>

      <div className="card card-pad" style={{ marginTop: 16 }}>
        <div className="section-title">Needs attention</div>
        {attention.length === 0 ? (
          <Empty big="All records valid">Nothing expiring in the next 30 days.</Empty>
        ) : (
          attention.map((i, k) => (
            <div className="att-row" key={k}>
              <div>
                <div className="att-who">{i.who}</div>
                <div className="att-what">{i.what}</div>
              </div>
              <div className="att-meta">
                <Chip tone={statusOf(i.exp)}>
                  {statusOf(i.exp) === 'red' ? 'Action needed' : 'Renew soon'}
                </Chip>
                <span className="att-date">{expLabel(i.exp)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
