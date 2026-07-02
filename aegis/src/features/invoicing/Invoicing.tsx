import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { downloadCsv, toCsv } from '../../lib/csv';
import { gbp, periodLabel, thisPeriod } from '../../lib/format';
import type { DeliveredRun, Invoice, InvoiceStatus } from '../../lib/types';

const NEXT_STATUS: Partial<Record<InvoiceStatus, { to: InvoiceStatus; label: string }>> = {
  draft: { to: 'sent', label: 'Mark sent' },
  sent: { to: 'paid', label: 'Mark paid' },
};

export default function Invoicing() {
  const qc = useQueryClient();
  const [raising, setRaising] = useState<DeliveredRun | null>(null);
  const period = thisPeriod();

  const delivered = useQuery({
    queryKey: ['delivered', period],
    queryFn: () => api().listDeliveredRuns(period),
  });
  const invoices = useQuery({ queryKey: ['invoices'], queryFn: () => api().listInvoices() });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: InvoiceStatus }) =>
      api().setInvoiceStatus(id, status),
    onSettled: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });

  if (delivered.isPending || invoices.isPending) return <Loading />;
  if (delivered.isError || invoices.isError)
    return (
      <div className="page-head">
        <h1>Invoicing</h1>
        <ErrorNote message={((delivered.error || invoices.error) as Error).message} />
      </div>
    );

  function exportCsv() {
    downloadCsv(
      `aegis-invoices-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        ['Council', 'Run', 'Period', 'Amount', 'Status'],
        (invoices.data ?? []).map((i) => [i.council, i.runLabel, i.period, i.amount, i.status]),
      ),
    );
    void api().logAudit('Exported invoices (CSV)');
  }

  return (
    <>
      <div className="page-head">
        <span className="role-note">Director · commercial</span>
        <h1>Invoicing</h1>
        <p>
          Council billing computed from delivered runs — day counts only, worked out by the
          database so no child data ever reaches this screen.
        </p>
      </div>

      <div className="section-title">Delivered this month · {periodLabel(period)}</div>
      <Card>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Run</th>
                <th>Council</th>
                <th className="num">Days delivered</th>
                <th className="num">Daily rate</th>
                <th className="num">Value to date</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(delivered.data ?? []).map((d) => (
                <tr key={d.runId}>
                  <td>{d.runName}</td>
                  <td>{d.council}</td>
                  <td className="num">{d.days}</td>
                  <td className="num">{gbp(d.dailyRate)}</td>
                  <td className="num">{gbp(d.days * (d.dailyRate ?? 0))}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="mini-btn" onClick={() => setRaising(d)}>
                      Raise invoice
                    </button>
                  </td>
                </tr>
              ))}
              {(delivered.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <Empty big="No delivered runs yet this month" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="section-title spaced">Invoices</div>
      <div className="head-actions">
        <Button variant="ghost" onClick={exportCsv}>
          Export CSV
        </Button>
      </div>
      <Card>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Council</th>
                <th>Run</th>
                <th>Period</th>
                <th className="num">Amount</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(invoices.data ?? []).map((i) => (
                <InvoiceRow
                  key={i.id}
                  invoice={i}
                  onStatus={(status) => setStatus.mutate({ id: i.id, status })}
                />
              ))}
              {(invoices.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <Empty big="No invoices raised yet" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {raising && (
        <RaiseInvoice
          delivered={raising}
          period={period}
          onClose={() => setRaising(null)}
          onSaved={() => {
            setRaising(null);
            void qc.invalidateQueries({ queryKey: ['invoices'] });
          }}
        />
      )}
    </>
  );
}

function InvoiceRow({
  invoice,
  onStatus,
}: {
  invoice: Invoice;
  onStatus: (s: InvoiceStatus) => void;
}) {
  const n = NEXT_STATUS[invoice.status];
  return (
    <tr>
      <td>{invoice.council}</td>
      <td>{invoice.runLabel}</td>
      <td>{invoice.period}</td>
      <td className="num">{gbp(invoice.amount)}</td>
      <td>
        <Chip tone={invoice.status === 'paid' ? 'green' : invoice.status === 'sent' ? 'amber' : 'neutral'}>
          {invoice.status}
        </Chip>
      </td>
      <td style={{ textAlign: 'right' }}>
        {n && (
          <button className="mini-btn" onClick={() => onStatus(n.to)}>
            {n.label}
          </button>
        )}
      </td>
    </tr>
  );
}

function RaiseInvoice({
  delivered,
  period,
  onClose,
  onSaved,
}: {
  delivered: DeliveredRun;
  period: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [days, setDays] = useState(String(delivered.days));
  const [rate, setRate] = useState(String(delivered.dailyRate ?? 0));
  const [error, setError] = useState('');
  const amount = useMemo(() => (Number(days) || 0) * (Number(rate) || 0), [days, rate]);

  const save = useMutation({
    mutationFn: () =>
      api().createInvoice({
        council: delivered.council ?? '',
        runLabel: delivered.runName,
        period: periodLabel(period),
        amount,
      }),
    onSuccess: onSaved,
    onError: (e: Error) => setError(e.message),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (amount <= 0) {
      setError('Days × rate must be more than zero.');
      return;
    }
    save.mutate();
  }

  return (
    <Modal title={`Raise invoice — ${delivered.runName}`} onClose={onClose}>
      <form onSubmit={submit}>
        {error && <ErrorNote message={error} />}
        <div className="form-row">
          <Field label="Days delivered" hint="Prefilled from boarding records">
            <TextInput
              type="number"
              min={0}
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
          </Field>
          <Field label="Daily rate (£)">
            <TextInput
              type="number"
              min={0}
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </Field>
        </div>
        <div className="plan-block">
          <div className="plan-k">Invoice total</div>
          <div className="plan-v" style={{ fontFamily: 'var(--display)', fontSize: 24, fontWeight: 700 }}>
            {gbp(amount)}
          </div>
        </div>
        <Button disabled={save.isPending}>
          {save.isPending ? 'Raising…' : `Raise draft for ${delivered.council ?? 'council'}`}
        </Button>
      </form>
    </Modal>
  );
}
