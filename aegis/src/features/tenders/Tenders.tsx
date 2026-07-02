import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api } from '../../api';
import {
  Button,
  Card,
  Chip,
  Empty,
  ErrorNote,
  Field,
  Loading,
  Modal,
  TextInput,
} from '../../components/ui';
import { daysLeft, fmtDate } from '../../lib/status';
import type { Tender, TenderStatus } from '../../lib/types';

const tenderSchema = z.object({
  reference: z.string().trim().min(2, 'Enter the tender reference'),
  council: z.string().trim().min(2, 'Enter the council'),
  kind: z.string().trim().min(2, 'Enter the type'),
  closeDate: z.string().min(8, 'Pick the closing date'),
  valueText: z.string().trim().min(1, 'Enter the value'),
});

const NEXT: Partial<Record<TenderStatus, { to: TenderStatus; label: string }[]>> = {
  open: [{ to: 'bid', label: 'Mark bid submitted' }],
  bid: [
    { to: 'won', label: 'Won' },
    { to: 'lost', label: 'Lost' },
  ],
};

export default function Tenders() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);

  const tenders = useQuery({ queryKey: ['tenders'], queryFn: () => api().listTenders() });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TenderStatus }) =>
      api().setTenderStatus(id, status),
    onSettled: () => qc.invalidateQueries({ queryKey: ['tenders'] }),
  });

  if (tenders.isPending) return <Loading />;
  if (tenders.isError)
    return (
      <div className="page-head">
        <h1>Tenders &amp; bids</h1>
        <ErrorNote message={(tenders.error as Error).message} />
      </div>
    );

  const live = (tenders.data ?? [])
    .filter((t) => t.status === 'open' || t.status === 'bid')
    .sort((a, b) => (a.closeDate ?? '').localeCompare(b.closeDate ?? ''));
  const settled = (tenders.data ?? []).filter((t) => t.status === 'won' || t.status === 'lost');

  return (
    <>
      <div className="page-head">
        <span className="role-note">Director · commercial</span>
        <h1>Tenders &amp; bids</h1>
        <p>Council contract pipeline. Soonest deadline first — a missed close date is a lost route.</p>
      </div>

      <div className="head-actions">
        <Button onClick={() => setAdding(true)}>Add tender</Button>
      </div>

      <div className="section-title">Live pipeline</div>
      <Card>
        {live.length === 0 ? (
          <Empty big="Nothing live">Add council tenders as they&apos;re published.</Empty>
        ) : (
          live.map((t) => (
            <TenderRow key={t.id} t={t} onStatus={(status) => setStatus.mutate({ id: t.id, status })} />
          ))
        )}
      </Card>

      <div className="section-title spaced">Decided</div>
      <Card>
        {settled.length === 0 ? (
          <Empty big="No outcomes yet" />
        ) : (
          settled.map((t) => (
            <TenderRow key={t.id} t={t} onStatus={(status) => setStatus.mutate({ id: t.id, status })} />
          ))
        )}
      </Card>

      {adding && (
        <AddTender
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            void qc.invalidateQueries({ queryKey: ['tenders'] });
          }}
        />
      )}
    </>
  );
}

function Countdown({ closeDate }: { closeDate: string | null }) {
  if (!closeDate) return null;
  const d = daysLeft(closeDate);
  if (d < 0) return <span className="count">closed {fmtDate(closeDate)}</span>;
  return (
    <span className={'count' + (d <= 3 ? ' soon' : '')}>
      {d === 0 ? 'closes today' : `${d}d to close`} · {fmtDate(closeDate)}
    </span>
  );
}

function TenderRow({ t, onStatus }: { t: Tender; onStatus: (s: TenderStatus) => void }) {
  const tone = t.status === 'won' ? 'green' : t.status === 'lost' ? 'red' : t.status === 'bid' ? 'amber' : 'neutral';
  return (
    <div className="row-x">
      <div>
        <div className="row-name">
          {t.council} <span className="role-tag">{t.kind}</span>
        </div>
        <div className="row-sub">
          <span style={{ fontFamily: 'var(--mono)' }}>{t.reference}</span> · {t.valueText} ·{' '}
          <Countdown closeDate={t.closeDate} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <Chip tone={tone}>{t.status}</Chip>
        {(NEXT[t.status] ?? []).map((n) => (
          <button key={n.to} className="mini-btn" onClick={() => onStatus(n.to)}>
            {n.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function AddTender({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [reference, setReference] = useState('');
  const [council, setCouncil] = useState('');
  const [kind, setKind] = useState('Spot route');
  const [closeDate, setCloseDate] = useState('');
  const [valueText, setValueText] = useState('');
  const [error, setError] = useState('');

  const save = useMutation({
    mutationFn: () => {
      const parsed = tenderSchema.safeParse({ reference, council, kind, closeDate, valueText });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Check the form');
      return api().createTender(parsed.data);
    },
    onSuccess: onSaved,
    onError: (e: Error) => setError(e.message),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    save.mutate();
  }

  return (
    <Modal title="Add tender" onClose={onClose}>
      <form onSubmit={submit}>
        {error && <ErrorNote message={error} />}
        <div className="form-row">
          <Field label="Reference">
            <TextInput value={reference} onChange={(e) => setReference(e.target.value)} required />
          </Field>
          <Field label="Council">
            <TextInput value={council} onChange={(e) => setCouncil(e.target.value)} required />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Type">
            <TextInput value={kind} onChange={(e) => setKind(e.target.value)} />
          </Field>
          <Field label="Closes">
            <TextInput
              type="date"
              value={closeDate}
              onChange={(e) => setCloseDate(e.target.value)}
              required
            />
          </Field>
        </div>
        <Field label="Value">
          <TextInput
            value={valueText}
            onChange={(e) => setValueText(e.target.value)}
            placeholder="£18k / yr"
            required
          />
        </Field>
        <Button disabled={save.isPending}>{save.isPending ? 'Adding…' : 'Add to pipeline'}</Button>
      </form>
    </Modal>
  );
}
