import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';
import { useAuth } from '../../auth/AuthProvider';
import CarePlanModal from '../../components/CarePlanModal';
import { Button, Empty, ErrorNote, Loading } from '../../components/ui';
import { downloadCsv, toCsv } from '../../lib/csv';
import { fmtTime, todayISO } from '../../lib/status';
import type { Boarding as BoardingRow, Child, Run } from '../../lib/types';
import { enqueueBoarding, flushOutbox, onOutboxChange, pendingKeys } from './outbox';

export default function Boarding() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [active, setActive] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<Set<string>>(pendingKeys());
  const serviceDate = todayISO();

  const runs = useQuery({ queryKey: ['runs'], queryFn: () => api().listRuns() });
  const boardings = useQuery({
    queryKey: ['boardings', serviceDate],
    queryFn: () => api().listBoardings(serviceDate),
  });

  useEffect(() => {
    const unsub = onOutboxChange(() => {
      setPending(pendingKeys());
      void qc.invalidateQueries({ queryKey: ['boardings'] });
    });
    void flushOutbox();
    return unsub;
  }, [qc]);

  if (runs.isPending || boardings.isPending) return <Loading />;
  if (runs.isError || boardings.isError)
    return (
      <div className="page-head">
        <h1>Boarding register</h1>
        <ErrorNote message={((runs.error || boardings.error) as Error).message} />
      </div>
    );

  const allRuns = runs.data ?? [];
  if (allRuns.length === 0)
    return (
      <div className="page-head">
        <h1>Boarding register</h1>
        <Empty big="No runs assigned">Nothing scheduled for your sign-in today.</Empty>
      </div>
    );

  const run = allRuns.find((r) => r.id === active) ?? allRuns[0]!;
  const byChild = new Map((boardings.data ?? []).map((b) => [b.childId, b]));
  const on = run.children.filter((c) => {
    const b = byChild.get(c.id);
    return b && b.state !== 'waiting';
  }).length;

  async function mark(run: Run, child: Child) {
    setError('');
    const existing = byChild.get(child.id);
    const stamp = new Date().toISOString();
    let write;
    if (!existing || existing.state === 'waiting') {
      write = {
        runId: run.id,
        childId: child.id,
        serviceDate,
        state: 'onboard' as const,
        boardedAt: stamp,
        boardedLoc: child.pickupArea,
      };
    } else if (existing.state === 'onboard') {
      write = {
        runId: run.id,
        childId: child.id,
        serviceDate,
        state: 'dropped' as const,
        boardedAt: existing.boardedAt,
        boardedLoc: existing.boardedLoc,
        droppedAt: stamp,
        droppedLoc: run.school,
      };
    } else {
      return;
    }
    try {
      await enqueueBoarding(write);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record the boarding.');
    }
    setPending(pendingKeys());
    void qc.invalidateQueries({ queryKey: ['boardings'] });
    void qc.invalidateQueries({ queryKey: ['parentUpdates'] });
  }

  function exportRegister() {
    const rows = run.children.map((c) => {
      const b = byChild.get(c.id);
      return [
        run.name,
        run.school,
        serviceDate,
        c.displayName,
        c.tag,
        c.scheduledPickup,
        b?.state ?? 'waiting',
        b?.boardedAt ? fmtTime(b.boardedAt) : '',
        b?.boardedLoc ?? '',
        b?.droppedAt ? fmtTime(b.droppedAt) : '',
        b?.droppedLoc ?? '',
      ];
    });
    downloadCsv(
      `aegis-register-${run.name.replace(/\s+/g, '-')}-${serviceDate}.csv`,
      toCsv(
        [
          'Run',
          'School',
          'Date',
          'Child',
          'Tag',
          'Scheduled',
          'State',
          'Boarded at',
          'Boarded location',
          'Dropped at',
          'Dropped location',
        ],
        rows,
      ),
    );
    void api().logAudit(`Exported daily register: ${run.name} (${serviceDate})`, `run:${run.id}`);
  }

  return (
    <>
      <div className="page-head">
        {profile?.role === 'pa' && (
          <span className="role-note">Passenger assistant · your run only</span>
        )}
        <h1>Boarding register</h1>
        <p>
          Tap each child on as they board and off at school. Every tap is time-stamped, written to
          the access log, and sends the parent an update. Taps are kept safe locally if the signal
          drops.
        </p>
      </div>

      {error && <ErrorNote message={error} />}

      {allRuns.length > 1 && (
        <div className="run-tabs" role="tablist">
          {allRuns.map((r) => (
            <button
              key={r.id}
              role="tab"
              aria-selected={r.id === run.id}
              className={'run-tab' + (r.id === run.id ? ' on' : '')}
              onClick={() => setActive(r.id)}
            >
              {r.name}
              <span className="small">{r.school}</span>
            </button>
          ))}
        </div>
      )}

      <div className="run-meta">
        <div>
          <div className="k">School</div>
          <div className="v">{run.school}</div>
        </div>
        <div>
          <div className="k">Window</div>
          <div className="v">{run.windowText}</div>
        </div>
        <div className="progress-wrap">
          <div className="pct">
            {on}/{run.children.length}
          </div>
          <div className="k">on board</div>
        </div>
      </div>

      <div className="head-actions">
        <Button variant="ghost" onClick={exportRegister}>
          Export today&apos;s register (CSV)
        </Button>
      </div>

      <div className="card">
        {run.children.map((c) => (
          <ChildRow
            key={c.id}
            child={c}
            boarding={byChild.get(c.id)}
            isPending={pending.has(`${c.id}:${serviceDate}`)}
            onMark={() => void mark(run, c)}
            onEta={
              profile?.role !== 'driver'
                ? () => {
                    void api()
                      .sendParentUpdate(c.id, run.id, 'eta')
                      .then(() => qc.invalidateQueries({ queryKey: ['parentUpdates'] }))
                      .catch((e: Error) => setError(e.message));
                  }
                : undefined
            }
          />
        ))}
      </div>
    </>
  );
}

function ChildRow({
  child,
  boarding,
  isPending,
  onMark,
  onEta,
}: {
  child: Child;
  boarding: BoardingRow | undefined;
  isPending: boolean;
  onMark: () => void;
  onEta?: () => void;
}) {
  const [showPlan, setShowPlan] = useState(false);
  const state = boarding?.state ?? 'waiting';
  let btnClass = 'board-btn waiting';
  let btnText = 'Mark on board';
  let stamp = `Due ${child.scheduledPickup?.slice(0, 5) ?? '—'} · ${child.pickupArea ?? ''}`;
  let disabled = false;
  if (state === 'onboard') {
    btnClass = 'board-btn onboard';
    btnText = 'On board ✓ · drop off';
    stamp = `Boarded ${fmtTime(boarding?.boardedAt ?? null)} · ${boarding?.boardedLoc ?? ''}`;
  } else if (state === 'dropped') {
    btnClass = 'board-btn done';
    btnText = 'Dropped off ✓';
    disabled = true;
    stamp = `On ${fmtTime(boarding?.boardedAt ?? null)} · off ${fmtTime(boarding?.droppedAt ?? null)}`;
  }

  return (
    <div className="child">
      <div className="avatar" aria-hidden="true">
        {child.displayName
          .split(' ')
          .map((x) => x[0])
          .join('')}
      </div>
      <div className="child-info">
        <div className="child-name">{child.displayName}</div>
        <div className="child-need">
          {child.tag && <span className="need-tag">{child.tag}</span>}
          <button
            className="linklike"
            style={{ fontSize: 12 }}
            onClick={() => setShowPlan(true)}
          >
            View care plan
          </button>
          {onEta && state === 'waiting' && (
            <button className="linklike" style={{ fontSize: 12 }} onClick={onEta}>
              Send “5 min away”
            </button>
          )}
        </div>
        <div className="child-stamp">
          {stamp}
          {isPending && (
            <>
              {' '}
              <span className="pending-flag">· saving — kept safe offline</span>
            </>
          )}
        </div>
      </div>
      <div className="child-actions">
        <button className={btnClass} disabled={disabled} onClick={onMark}>
          {btnText}
        </button>
      </div>
      {showPlan && <CarePlanModal child={child} onClose={() => setShowPlan(false)} />}
    </div>
  );
}
