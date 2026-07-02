import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { Card, Chip, Empty, ErrorNote, Loading } from '../../components/ui';
import { daysLeft, fmtDate } from '../../lib/status';

const gbp = (n: number) => n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });
const thisPeriod = () => new Date().toISOString().slice(0, 7);

/**
 * Director overview: bids, contracts, revenue. Deliberately contains no
 * child data, no care plans, no compliance detail — the backend wouldn't
 * return them to a director even if this screen asked.
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
  const won = (tenders.data ?? []).filter((t) => t.status === 'won').length;
  const revenueThisMonth = (delivered.data ?? []).reduce(
    (sum, d) => sum + d.days * (d.dailyRate ?? 0),
    0,
  );
  const awaitingPayment = (invoices.data ?? [])
    .filter((i) => i.status === 'sent')
    .reduce((s, i) => s + (i.amount ?? 0), 0);

  const nextDeadline = [...activeBids]
    .filter((t) => t.closeDate && daysLeft(t.closeDate) >= 0)
    .sort((a, b) => (a.closeDate ?? '').localeCompare(b.closeDate ?? ''))[0];

  return (
    <>
      <div className="page-head">
        <span className="role-note">Director · commercial</span>
        <h1>Overview</h1>
        <p>
          The commercial picture. Operational and child data stay with the manager and crew — this
          sign-in can&apos;t read them, by database policy.
        </p>
      </div>

      <div className="grid cols-3">
        <div className="stat">
          <div className="num">{activeBids.length}</div>
          <div className="cap">active bids in the pipeline</div>
        </div>
        <div className="stat green">
          <div className="num">{won}</div>
          <div className="cap">contracts won</div>
        </div>
        <div className="stat">
          <div className="num" style={{ fontSize: 30 }}>
            {gbp(revenueThisMonth)}
          </div>
          <div className="cap">delivered value this month</div>
        </div>
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
              <div style={{ marginTop: 14 }}>
                <Link className="mini-btn" to="/tenders">
                  Open pipeline
                </Link>
              </div>
            </>
          ) : (
            <Empty big="No live deadlines" />
          )}
        </Card>
        <Card pad>
          <div className="section-title">Cash</div>
          <div className="stat" style={{ border: 'none', padding: 0 }}>
            <div className="num" style={{ fontSize: 30 }}>
              {gbp(awaitingPayment)}
            </div>
            <div className="cap">invoiced &amp; awaiting payment</div>
          </div>
          <div style={{ marginTop: 14 }}>
            <Link className="mini-btn" to="/invoicing">
              Open invoicing
            </Link>
          </div>
        </Card>
      </div>
    </>
  );
}
