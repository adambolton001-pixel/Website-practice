import { useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { api } from '../../api';
import CarePlanModal from '../../components/CarePlanModal';
import { Chip, Empty, ErrorNote, Loading } from '../../components/ui';
import { fmtTime, todayISO } from '../../lib/status';
import type { Child } from '../../lib/types';

/**
 * Driver run sheet: read-only manifest for the assigned run with the full
 * pickup address (drivers navigate; the backend grants them children_pii),
 * live boarding status recorded by the PA, and care-plan access.
 * No boarding buttons — drivers don't record boarding.
 */
export default function RunSheet() {
  const [active, setActive] = useState<string | null>(null);
  const [planChild, setPlanChild] = useState<Child | null>(null);
  const serviceDate = todayISO();

  const runs = useQuery({ queryKey: ['runs'], queryFn: () => api().listRuns() });
  const boardings = useQuery({
    queryKey: ['boardings', serviceDate],
    queryFn: () => api().listBoardings(serviceDate),
    refetchInterval: 20_000, // live-ish view of the PA's taps
  });

  const run = (runs.data ?? []).find((r) => r.id === active) ?? (runs.data ?? [])[0];

  const piiQueries = useQueries({
    queries: (run?.children ?? []).map((c) => ({
      queryKey: ['childPII', c.id],
      queryFn: () => api().getChildPII(c.id),
    })),
  });

  if (runs.isPending) return <Loading />;
  if (runs.isError) return <ErrorNote message={(runs.error as Error).message} />;
  if (!run)
    return (
      <div className="page-head">
        <h1>Run sheet</h1>
        <Empty big="No run assigned">Nothing scheduled for your sign-in today.</Empty>
      </div>
    );

  const byChild = new Map((boardings.data ?? []).map((b) => [b.childId, b]));

  return (
    <>
      <div className="page-head">
        <span className="role-note">Driver · read-only manifest</span>
        <h1>Run sheet</h1>
        <p>
          Pickup order with full addresses for navigation. Boarding status updates live as the
          passenger assistant records it — you never record boarding yourself.
        </p>
      </div>

      {(runs.data ?? []).length > 1 && (
        <div className="run-tabs" role="tablist">
          {(runs.data ?? []).map((r) => (
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
        <div>
          <div className="k">Council</div>
          <div className="v">{run.council}</div>
        </div>
      </div>

      <div className="card">
        {run.children.map((c, idx) => {
          const b = byChild.get(c.id);
          const pii = piiQueries[idx]?.data;
          const state = b?.state ?? 'waiting';
          return (
            <div className="child" key={c.id}>
              <div className="avatar" aria-hidden="true">
                {idx + 1}
              </div>
              <div className="child-info">
                <div className="child-name">
                  {pii?.fullName ?? c.displayName}{' '}
                  {c.tag && <span className="need-tag">{c.tag}</span>}
                </div>
                <div className="child-need">
                  {pii?.homeAddress ?? c.pickupArea ?? '—'}
                </div>
                <div className="child-stamp">
                  Due {c.scheduledPickup?.slice(0, 5) ?? '—'}
                  {state === 'onboard' && ` · boarded ${fmtTime(b?.boardedAt ?? null)}`}
                  {state === 'dropped' && ` · dropped ${fmtTime(b?.droppedAt ?? null)}`}
                  {' · '}
                  <button className="linklike" style={{ fontSize: 12 }} onClick={() => setPlanChild(c)}>
                    View care plan
                  </button>
                </div>
              </div>
              <Chip tone={state === 'dropped' ? 'green' : state === 'onboard' ? 'amber' : 'neutral'}>
                {state === 'dropped' ? 'At school' : state === 'onboard' ? 'On board' : 'Waiting'}
              </Chip>
            </div>
          );
        })}
      </div>

      {planChild && <CarePlanModal child={planChild} onClose={() => setPlanChild(null)} />}
    </>
  );
}
