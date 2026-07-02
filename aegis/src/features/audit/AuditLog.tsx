import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../../api';
import { Card, Empty, ErrorNote, Loading } from '../../components/ui';
import { fmtDateTime } from '../../lib/status';

const PAGE_SIZE = 25;

/** Append-only accountability record; readable by manager + director only. */
export default function AuditLog() {
  const [page, setPage] = useState(0);
  const audit = useQuery({
    queryKey: ['audit', page],
    queryFn: () => api().listAudit(page, PAGE_SIZE),
    placeholderData: keepPreviousData,
  });

  if (audit.isPending) return <Loading />;
  if (audit.isError)
    return (
      <div className="page-head">
        <h1>Access log</h1>
        <ErrorNote message={(audit.error as Error).message} />
      </div>
    );

  const { rows, total } = audit.data;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <div className="page-head">
        <h1>Access log</h1>
        <p>
          Append-only record of who did what, when — no one can edit or delete entries, including
          you. This is the accountability backbone for councils and the ICO.
        </p>
      </div>

      <Card>
        {rows.length === 0 ? (
          <Empty big="No entries yet">Actions appear here as the team works.</Empty>
        ) : (
          rows.map((e) => (
            <div className="audit-row" key={e.id}>
              <span className="audit-when">{fmtDateTime(e.createdAt)}</span>
              <span className="audit-who">
                {e.actorName ?? 'Unknown'}
                <br />
                <span className="audit-role">{e.actorRole}</span>
              </span>
              <span>{e.action}</span>
            </div>
          ))
        )}
        {pages > 1 && (
          <div className="pager">
            <button className="mini-btn" disabled={page === 0} onClick={() => setPage(page - 1)}>
              ← Newer
            </button>
            <span>
              Page {page + 1} of {pages} · {total} entries
            </span>
            <button
              className="mini-btn"
              disabled={page >= pages - 1}
              onClick={() => setPage(page + 1)}
            >
              Older →
            </button>
          </div>
        )}
      </Card>
    </>
  );
}
