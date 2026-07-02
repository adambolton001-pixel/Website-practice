import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { useAuth } from '../auth/AuthProvider';
import type { Child } from '../lib/types';
import { Empty, Loading, Modal } from './ui';

/**
 * Transport Care Plan viewer. Special-category data: the backend only
 * returns a plan for manager or the staff on the child's run, and the
 * home address only for manager/driver — a PA gets a restricted note.
 */
export default function CarePlanModal({ child, onClose }: { child: Child; onClose: () => void }) {
  const { profile } = useAuth();

  const plan = useQuery({
    queryKey: ['carePlan', child.id],
    queryFn: () => api().getCarePlan(child.id),
    staleTime: 0,
  });
  const pii = useQuery({
    queryKey: ['childPII', child.id],
    queryFn: () => api().getChildPII(child.id),
    staleTime: 0,
  });

  return (
    <Modal title={`Care plan — ${child.displayName}`} onClose={onClose}>
      {plan.isPending || pii.isPending ? (
        <Loading />
      ) : plan.isError ? (
        <div className="auth-error" role="alert">
          {(plan.error as Error).message}
        </div>
      ) : !plan.data ? (
        <Empty big="No care plan on file">Nothing recorded for this child yet.</Empty>
      ) : (
        <>
          <Row k="Summary" v={plan.data.summary} />
          <Row k="Communication" v={plan.data.communication} />
          <Row k="Medical" v={plan.data.medical} />
          <Row k="Behaviour" v={plan.data.behaviour} />
          <div className="plan-block">
            <div className="plan-k">Home address</div>
            {pii.data?.homeAddress ? (
              <div className="plan-v">
                {pii.data.fullName ? `${pii.data.fullName} — ` : ''}
                {pii.data.homeAddress}
              </div>
            ) : (
              <div className="plan-restricted">
                {profile?.role === 'pa'
                  ? 'Not shown to passenger assistants — the driver has the address for navigation.'
                  : 'Not available to your role.'}
              </div>
            )}
          </div>
          <Row k="Key contacts" v={plan.data.contacts} />
          <p className="demo-note" style={{ textAlign: 'left' }}>
            This view has been written to the access log.
          </p>
        </>
      )}
    </Modal>
  );
}

function Row({ k, v }: { k: string; v: string | null }) {
  if (!v) return null;
  return (
    <div className="plan-block">
      <div className="plan-k">{k}</div>
      <div className="plan-v">{v}</div>
    </div>
  );
}
