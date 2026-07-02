import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { HBar, MARK_DARK, MARK_LIGHT } from '../../components/charts';
import { Card, Chip, Empty, ErrorNote, Loading } from '../../components/ui';
import { gbp, periodLabel, thisPeriod } from '../../lib/format';
import { daysLeft, fmtDate } from '../../lib/status';
import type { Tender } from '../../lib/types';

/** "£18k / yr" → 18000; "~£140k / yr" → 140000; "£2,500" → 2500 */
export function parseTenderValue(text: string | null): number {
  if (!text) return 0;
  const k = text.match(/([\d.]+)\s*k/i);
  if (k) return Math.round(parseFloat(k[1] ?? '0') * 1000);
  const n = text.replace(/,/g, '').match(/([\d.]+)/);
  return n ? Math.round(parseFloat(n[1] ?? '0')) : 0;
}

/**
 * Director overview: the finance picture. Deliberately contains no child
 * data, no care plans, no compliance detail — the backend wouldn't return
 * them to a director even if this screen asked.
 */
export default function Overview() {
  const period = thisPeriod();
  const tenders = useQuery({ queryKey: ['tenders'], queryFn: () => api().listTenders() });
  const invoices = useQuery({ queryKey: ['invoices'], queryFn: () => api().listInvoices() });
  const delivered = useQuery({
    queryKey: ['delivered', period],
    queryFn: () => api().listDeliveredRuns(period),
  });

  if (tenders.isPending || invoices.isPending || delivered.isPending) return <Loading />;
  if (tenders.isError || invoices.isError || delivered.isError)
    return (
      <div className="page-head">
        <h1>Overview</h1>
        <ErrorNote
          message={((tenders.error || invoices.error || delivered.error) as Error).message}
        />
      </div>
    );

  const activeBids = (tenders.data ?? []).filter((t) => t.status === 'open' || t.status === 'bid');
  const revenueThisMonth = (delivered.data ?? []).reduce(
    (sum, d) => sum + d.days * (d.dailyRate ?? 0),
    0,
  );
  const awaitingPayment = (invoices.data ?? [])
    .filter((i) => i.status === 'sent')
    .reduce((s, i) => s + (i.amount ?? 0), 0);
  const pipelineValue = activeBids.reduce((s, t) => s + parseTenderValue(t.valueText), 0);

  const nextDeadline: Tender | undefined = [...activeBids]
    .filter((t) => t.closeDate && daysLeft(t.closeDate) >= 0)
    .sort((a, b) => (a.closeDate ?? '').localeCompare(b.closeDate ?? ''))[0];

  const deliveredBars = (delivered.data ?? []).map((d) => ({
    label: d.runName,
    value: d.days * (d.dailyRate ?? 0),
    display: gbp(d.days * (d.dailyRate ?? 0)),
    sub: `${d.council ?? ''} · ${d.days} day${d.days === 1 ? '' : 's'}`,
  }));

  const pipelineBars = [...(tenders.data ?? [])]
    .filter((t) => t.status !== 'lost')
    .sort((a, b) => parseTenderValue(b.valueText) - parseTenderValue(a.valueText))
    .slice(0, 6)
    .map((t) => ({
      label: t.council ?? t.reference ?? 'Tender',
      value: parseTenderValue(t.valueText),
      display: t.valueText ?? '—',
      sub: t.status === 'won' ? 'won' : t.closeDate ? `${t.status} · closes ${fmtDate(t.closeDate)}` : t.status,
    }));

  return (
    <>
      <div className="page-head">
        <span className="role-note">Director · commercial</span>
        <h1>Overview</h1>
        <p>
          The money picture, worked out by the database from delivered runs — no child data ever
          reaches this sign-in.
        </p>
      </div>

      <div className="grid cols-3">
        <div className="fin-card">
          <div className="fin-cap">Delivered this month</div>
          <div className="fin-num">{gbp(revenueThisMonth)}</div>
          <div className="fin-sub">{periodLabel(period)} · from boarding records</div>
        </div>
        <div className="fin-card">
          <div className="fin-cap">Awaiting payment</div>
          <div className="fin-num">{gbp(awaitingPayment)}</div>
          <div className="fin-sub">invoices sent, not yet paid</div>
        </div>
        <div className="fin-card">
          <div className="fin-cap">Live pipeline</div>
          <div className="fin-num">{gbp(pipelineValue)}</div>
          <div className="fin-sub">
            {activeBids.length} active bid{activeBids.length === 1 ? '' : 's'} / yr value
          </div>
        </div>
      </div>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <div className="fin-card fin-chart">
          <div className="fin-cap" style={{ marginBottom: 14 }}>
            Delivered value by run · {periodLabel(period)}
          </div>
          {deliveredBars.length === 0 ? (
            <Empty big="No delivered runs yet" />
          ) : (
            <HBar
              data={deliveredBars}
              mark={MARK_DARK}
              dark
              ariaLabel={`Delivered value by run for ${periodLabel(period)}`}
            />
          )}
          <div className="fin-sub" style={{ marginTop: 12 }}>
            Figures in the <Link className="linklike lime" to="/invoicing">invoicing table</Link>.
          </div>
        </div>

        <Card pad>
          <div className="section-title">Pipeline value by tender</div>
          {pipelineBars.length === 0 ? (
            <Empty big="No tenders tracked" />
          ) : (
            <HBar
              data={pipelineBars}
              mark={MARK_LIGHT}
              ariaLabel="Annual value of tracked tenders, largest first"
            />
          )}
          <div style={{ marginTop: 12 }}>
            <Link className="mini-btn" to="/tenders">
              Open pipeline
            </Link>
          </div>
        </Card>
      </div>

      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <Card pad>
          <div className="section-title">Next deadline</div>
          {nextDeadline ? (
            <>
              <div className="row-name" style={{ marginBottom: 4 }}>
                {nextDeadline.council} <span className="role-tag">{nextDeadline.kind}</span>
              </div>
              <div className="row-sub">
                {nextDeadline.reference} · {nextDeadline.valueText}
              </div>
              <div style={{ marginTop: 10 }}>
                <Chip tone={daysLeft(nextDeadline.closeDate ?? '') <= 3 ? 'red' : 'amber'}>
                  closes {fmtDate(nextDeadline.closeDate)}
                </Chip>
              </div>
            </>
          ) : (
            <Empty big="No live deadlines" />
          )}
        </Card>
        <Card pad>
          <div className="section-title">Invoices</div>
          {(invoices.data ?? []).slice(0, 3).map((i) => (
            <div className="att-row" key={i.id}>
              <div>
                <div className="att-who">{i.council}</div>
                <div className="att-what">
                  {i.runLabel} · {i.period}
                </div>
              </div>
              <div className="att-meta">
                <Chip tone={i.status === 'paid' ? 'green' : i.status === 'sent' ? 'amber' : 'neutral'}>
                  {i.status}
                </Chip>
                <span className="att-date">{gbp(i.amount)}</span>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 12 }}>
            <Link className="mini-btn" to="/invoicing">
              Open invoicing
            </Link>
          </div>
        </Card>
      </div>
    </>
  );
}
