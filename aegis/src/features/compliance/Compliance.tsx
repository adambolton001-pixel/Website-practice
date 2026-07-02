import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api';
import { Button, Chip, Empty, ErrorNote, Loading, Modal } from '../../components/ui';
import { downloadCsv, toCsv } from '../../lib/csv';
import { daysLeft, expLabel, fmtDate, statusOf } from '../../lib/status';
import type { Credential, VehicleCheck } from '../../lib/types';

type AnyRecord = (Credential | VehicleCheck) & { ownerLabel: string };

export default function Compliance() {
  const [open, setOpen] = useState<string | null>(null); // `${type}:${id}`
  const [viewing, setViewing] = useState<AnyRecord | null>(null);

  const staff = useQuery({
    queryKey: ['staffCreds'],
    queryFn: () => api().listStaffWithCredentials(),
  });
  const vehicles = useQuery({
    queryKey: ['vehicleChecks'],
    queryFn: () => api().listVehiclesWithChecks(),
  });

  if (staff.isPending || vehicles.isPending) return <Loading />;
  if (staff.isError || vehicles.isError)
    return (
      <div className="page-head">
        <h1>Compliance vault</h1>
        <ErrorNote message={((staff.error || vehicles.error) as Error).message} />
      </div>
    );

  const worst = (records: { expiryDate: string }[]) =>
    records.length ? Math.min(...records.map((r) => daysLeft(r.expiryDate))) : Infinity;

  const overall = (records: { expiryDate: string }[]) => {
    const sts = records.map((r) => statusOf(r.expiryDate));
    const red = sts.filter((x) => x === 'red').length;
    const amber = sts.filter((x) => x === 'amber').length;
    return {
      cls: (red ? 'red' : amber ? 'amber' : 'green') as 'red' | 'amber' | 'green',
      label: red ? `${red} expired` : amber ? `${amber} expiring` : 'All valid',
    };
  };

  const sortedStaff = [...(staff.data ?? [])].sort(
    (a, b) => worst(a.credentials) - worst(b.credentials),
  );
  const sortedVehicles = [...(vehicles.data ?? [])].sort((a, b) => worst(a.checks) - worst(b.checks));

  function toggle(key: string, label: string) {
    const next = open === key ? null : key;
    setOpen(next);
    if (next) void api().logAudit(`Viewed compliance records for ${label}`, key);
  }

  function exportCsv() {
    const rows: (string | null)[][] = [
      ...sortedStaff.flatMap((s) =>
        s.credentials.map((c) => [
          'Staff',
          s.fullName,
          c.kind,
          c.reference,
          c.expiryDate,
          statusOf(c.expiryDate),
          c.lastChecked,
          c.verifiedBy,
        ]),
      ),
      ...sortedVehicles.flatMap((v) =>
        v.checks.map((c) => [
          'Vehicle',
          v.reg,
          c.kind,
          c.reference,
          c.expiryDate,
          statusOf(c.expiryDate),
          c.lastChecked,
          null,
        ]),
      ),
    ];
    downloadCsv(
      `aegis-compliance-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        ['Type', 'Who', 'Record', 'Reference', 'Expiry', 'Status', 'Last checked', 'Verified by'],
        rows,
      ),
    );
    void api().logAudit('Exported compliance records (CSV)');
  }

  return (
    <>
      <div className="page-head">
        <h1>Compliance vault</h1>
        <p>
          Every driver, assistant and vehicle&apos;s certificates, with the expiry watch that keeps
          you on the council framework. Records that need action sort to the top.
        </p>
      </div>

      <div className="head-actions">
        <Button variant="ghost" onClick={exportCsv}>
          Export records (CSV)
        </Button>
      </div>

      <div className="section-title">Drivers &amp; passenger assistants</div>
      <div className="card" style={{ marginBottom: 24 }}>
        {sortedStaff.map((s) => {
          const o = overall(s.credentials);
          const key = `staff:${s.id}`;
          return (
            <div key={s.id}>
              <button
                className="row-x clickable"
                onClick={() => toggle(key, s.fullName)}
                aria-expanded={open === key}
              >
                <div>
                  <div className="row-name">
                    {s.fullName} <span className="role-tag">{s.role}</span>
                  </div>
                  <div className="row-sub">
                    {s.credentials.length} records · tap to {open === key ? 'hide' : 'view'}
                  </div>
                </div>
                <Chip tone={o.cls}>{o.label}</Chip>
              </button>
              {open === key && (
                <RecordList
                  records={s.credentials.map((c) => ({ ...c, ownerLabel: s.fullName }))}
                  onView={setViewing}
                />
              )}
            </div>
          );
        })}
        {sortedStaff.length === 0 && <Empty big="No staff records yet." />}
      </div>

      <div className="section-title">Vehicles</div>
      <div className="card">
        {sortedVehicles.map((v) => {
          const o = overall(v.checks);
          const key = `vehicle:${v.id}`;
          return (
            <div key={v.id}>
              <button
                className="row-x clickable"
                onClick={() => toggle(key, v.reg)}
                aria-expanded={open === key}
              >
                <div>
                  <div className="row-name">
                    {v.reg} <span className="role-tag">{v.description}</span>
                  </div>
                  <div className="row-sub">
                    {v.checks.length} checks · tap to {open === key ? 'hide' : 'view'}
                  </div>
                </div>
                <Chip tone={o.cls}>{o.label}</Chip>
              </button>
              {open === key && (
                <RecordList
                  records={v.checks.map((c) => ({ ...c, ownerLabel: v.reg }))}
                  onView={setViewing}
                />
              )}
            </div>
          );
        })}
        {sortedVehicles.length === 0 && <Empty big="No vehicles yet." />}
      </div>

      {viewing && <RecordModal record={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

function RecordList({
  records,
  onView,
}: {
  records: AnyRecord[];
  onView: (r: AnyRecord) => void;
}) {
  return (
    <div className="cred-detail">
      {records.map((c) => (
        <div className="cred-block" key={c.id}>
          <div className="cred-top">
            <span className="cred-name">{c.kind}</span>
            <span className="cred-no">{c.reference}</span>
            <Chip tone={statusOf(c.expiryDate)}>{expLabel(c.expiryDate)}</Chip>
            <button className="cred-view" onClick={() => onView(c)} style={{ marginLeft: 'auto' }}>
              View record
            </button>
          </div>
          {(('verifiedBy' in c && c.verifiedBy) || c.lastChecked) && (
            <div className="cred-prov">
              {c.lastChecked ? `Last checked ${fmtDate(c.lastChecked)}` : ''}
              {'verifiedBy' in c && c.verifiedBy ? ` · verified by ${c.verifiedBy}` : ''}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function RecordModal({ record, onClose }: { record: AnyRecord; onClose: () => void }) {
  const doc = useQuery({
    queryKey: ['doc', record.documentPath],
    queryFn: () => (record.documentPath ? api().getDocumentUrl(record.documentPath) : null),
    staleTime: 0, // signed URLs are short-lived — always re-request
  });

  return (
    <Modal title={`${record.kind} — ${record.ownerLabel}`} onClose={onClose} wide>
      <div className="plan-block">
        <div className="plan-k">Reference</div>
        <div className="plan-v" style={{ fontFamily: 'var(--mono)' }}>
          {record.reference ?? '—'}
        </div>
      </div>
      <div className="plan-block">
        <div className="plan-k">Expiry</div>
        <div className="plan-v">
          {fmtDate(record.expiryDate)} <Chip tone={statusOf(record.expiryDate)}>{expLabel(record.expiryDate)}</Chip>
        </div>
      </div>
      <div className="plan-block">
        <div className="plan-k">Provenance</div>
        <div className="plan-v">
          {record.lastChecked ? `Original checked ${fmtDate(record.lastChecked)}` : 'Not yet verified'}
          {'verifiedBy' in record && record.verifiedBy ? ` by ${record.verifiedBy}` : ''}
        </div>
      </div>
      <div className="plan-block">
        <div className="plan-k">Stored certificate</div>
        {!record.documentPath ? (
          <div className="plan-restricted">No scanned copy on file for this record.</div>
        ) : doc.isPending ? (
          <Loading label="Requesting signed URL…" />
        ) : !doc.data ? (
          <div className="plan-restricted">Document unavailable for your role.</div>
        ) : (
          <>
            <iframe title="Stored certificate" src={doc.data} className="doc-frame" height={340} />
            <div style={{ marginTop: 10 }}>
              <a className="btn-ghost" href={doc.data} download={`${record.kind}.svg`}>
                Download copy
              </a>
            </div>
          </>
        )}
      </div>
      <p className="demo-note" style={{ textAlign: 'left' }}>
        Opening this record has been written to the access log.
      </p>
    </Modal>
  );
}
