import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api } from '../../api';
import { useAuth } from '../../auth/AuthProvider';
import {
  Button,
  Card,
  Empty,
  ErrorNote,
  Field,
  Loading,
  Modal,
  Select,
  TextArea,
} from '../../components/ui';
import { fmtDateTime } from '../../lib/status';
import type { Incident } from '../../lib/types';

const KINDS = [
  'Distress / behaviour',
  'Medical',
  'Vehicle defect',
  'Road / traffic',
  'Safeguarding concern',
  'Other',
] as const;

const incidentSchema = z.object({
  runId: z.string().min(1, 'Pick the run'),
  childId: z.string().nullable(),
  kind: z.string().min(1, 'Pick a type'),
  severity: z.enum(['low', 'med', 'high']),
  description: z.string().trim().min(10, 'Describe what happened (at least 10 characters)'),
});

const STATUS_LABEL: Record<Incident['status'], string> = {
  logged: 'Logged',
  shared_school: 'Shared with school',
  shared_council: 'Shared with council',
  closed: 'Closed',
};

export default function Incidents() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const incidents = useQuery({ queryKey: ['incidents'], queryFn: () => api().listIncidents() });
  const runs = useQuery({ queryKey: ['runs'], queryFn: () => api().listRuns() });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Incident['status'] }) =>
      api().setIncidentStatus(id, status),
    onSettled: () => qc.invalidateQueries({ queryKey: ['incidents'] }),
  });

  if (incidents.isPending || runs.isPending) return <Loading />;
  if (incidents.isError)
    return (
      <div className="page-head">
        <h1>Incidents</h1>
        <ErrorNote message={(incidents.error as Error).message} />
      </div>
    );

  const runName = (id: string) => (runs.data ?? []).find((r) => r.id === id)?.name ?? 'Run';
  const childName = (runId: string, childId: string | null) =>
    childId
      ? ((runs.data ?? []).find((r) => r.id === runId)?.children.find((c) => c.id === childId)
          ?.displayName ?? 'Child')
      : null;

  return (
    <>
      <div className="page-head">
        {profile?.role !== 'manager' && <span className="role-note">Your run only</span>}
        <h1>Incidents</h1>
        <p>
          Structured, time-stamped incident reports. Photos are stored privately and only ever
          shown via short-lived signed links.
        </p>
      </div>

      <div className="head-actions">
        <Button onClick={() => setShowForm(true)}>Report an incident</Button>
      </div>

      <Card>
        {(incidents.data ?? []).length === 0 ? (
          <Empty big="No incidents">Nothing reported for your sign-in.</Empty>
        ) : (
          (incidents.data ?? []).map((i) => (
            <IncidentRow
              key={i.id}
              incident={i}
              runName={runName(i.runId)}
              childLabel={childName(i.runId, i.childId)}
              canManage={profile?.role === 'manager'}
              onStatus={(status) => setStatus.mutate({ id: i.id, status })}
            />
          ))
        )}
      </Card>

      {showForm && (
        <ReportForm
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            void qc.invalidateQueries({ queryKey: ['incidents'] });
          }}
        />
      )}
    </>
  );
}

function IncidentRow({
  incident,
  runName,
  childLabel,
  canManage,
  onStatus,
}: {
  incident: Incident;
  runName: string;
  childLabel: string | null;
  canManage: boolean;
  onStatus: (s: Incident['status']) => void;
}) {
  const [open, setOpen] = useState(false);
  const photo = useQuery({
    queryKey: ['photo', incident.photoPath],
    queryFn: () => (incident.photoPath ? api().getDocumentUrl(incident.photoPath) : null),
    enabled: open && Boolean(incident.photoPath),
    staleTime: 0,
  });

  return (
    <div>
      <button className="row-x clickable" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div>
          <div className="row-name">
            <span className={`sev ${incident.severity}`}>{incident.severity}</span>
            {incident.kind}
            {childLabel && <span className="role-tag">{childLabel}</span>}
          </div>
          <div className="row-sub">
            {runName} · {fmtDateTime(incident.createdAt)} ·{' '}
            {incident.raisedByName ?? 'Staff member'}
          </div>
        </div>
        <span className="chip neutral">
          <span className="dot" aria-hidden="true" />
          {STATUS_LABEL[incident.status]}
        </span>
      </button>
      {open && (
        <div className="cred-detail">
          <p style={{ fontSize: 14, padding: '6px 0 10px' }}>{incident.description}</p>
          {incident.photoPath &&
            (photo.isPending ? (
              <Loading label="Requesting signed photo link…" />
            ) : photo.data ? (
              <img className="inc-photo" src={photo.data} alt="Incident photo" />
            ) : (
              <p className="plan-restricted">Photo unavailable for your role.</p>
            ))}
          {canManage && (
            <div className="head-actions" style={{ marginTop: 12 }}>
              {incident.status !== 'shared_school' && (
                <button className="mini-btn" onClick={() => onStatus('shared_school')}>
                  Share with school
                </button>
              )}
              {incident.status !== 'shared_council' && (
                <button className="mini-btn" onClick={() => onStatus('shared_council')}>
                  Share with council
                </button>
              )}
              {incident.status !== 'closed' && (
                <button className="mini-btn" onClick={() => onStatus('closed')}>
                  Close
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReportForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const runs = useQuery({ queryKey: ['runs'], queryFn: () => api().listRuns() });
  const [runId, setRunId] = useState('');
  const [childId, setChildId] = useState('');
  const [kind, setKind] = useState<string>(KINDS[0]);
  const [severity, setSeverity] = useState<'low' | 'med' | 'high'>('low');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const allRuns = runs.data ?? [];
  const selectedRun = allRuns.find((r) => r.id === runId) ?? allRuns[0];

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const parsed = incidentSchema.safeParse({
      runId: selectedRun?.id ?? '',
      childId: childId || null,
      kind,
      severity,
      description,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form');
      return;
    }
    setBusy(true);
    try {
      await api().createIncident({ ...parsed.data, photo });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the report.');
      setBusy(false);
    }
  }

  return (
    <Modal title="Report an incident" onClose={onClose}>
      {runs.isPending ? (
        <Loading />
      ) : (
        <form onSubmit={(e) => void submit(e)}>
          {error && <ErrorNote message={error} />}
          <div className="form-row">
            <Field label="Run">
              <Select value={selectedRun?.id ?? ''} onChange={(e) => setRunId(e.target.value)}>
                {allRuns.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} — {r.school}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Child (optional)">
              <Select value={childId} onChange={(e) => setChildId(e.target.value)}>
                <option value="">Not child-specific</option>
                {(selectedRun?.children ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayName}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="form-row">
            <Field label="Type">
              <Select value={kind} onChange={(e) => setKind(e.target.value)}>
                {KINDS.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </Select>
            </Field>
            <Field label="Severity">
              <Select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as 'low' | 'med' | 'high')}
              >
                <option value="low">Low</option>
                <option value="med">Medium</option>
                <option value="high">High</option>
              </Select>
            </Field>
          </div>
          <Field label="What happened?">
            <TextArea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Facts, times, who was involved, what you did…"
              required
            />
          </Field>
          <Field label="Photo (optional)" hint="Stored in the private bucket, never public.">
            <input
              className="input"
              type="file"
              accept="image/*"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            />
          </Field>
          <Button disabled={busy}>{busy ? 'Saving…' : 'Submit report'}</Button>
        </form>
      )}
    </Modal>
  );
}
