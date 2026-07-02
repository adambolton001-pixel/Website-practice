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
  Select,
  TextInput,
} from '../../components/ui';
import { fmtDateTime } from '../../lib/status';
import type { ParentContact } from '../../lib/types';

const contactSchema = z.object({
  childId: z.string().min(1, 'Pick the child'),
  name: z.string().trim().min(2, 'Enter the contact name'),
  phone: z.string().trim().min(7, 'Enter a phone number'),
  consentApp: z.boolean(),
  consentSms: z.boolean(),
});

export default function Parents() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<ParentContact | 'new' | null>(null);

  const updates = useQuery({
    queryKey: ['parentUpdates'],
    queryFn: () => api().listParentUpdates(),
  });
  const contacts = useQuery({
    queryKey: ['parentContacts'],
    queryFn: () => api().listParentContacts(),
  });
  const runs = useQuery({ queryKey: ['runs'], queryFn: () => api().listRuns() });

  if (updates.isPending || contacts.isPending || runs.isPending) return <Loading />;
  if (updates.isError)
    return (
      <div className="page-head">
        <h1>Parent updates</h1>
        <ErrorNote message={(updates.error as Error).message} />
      </div>
    );

  const children = (runs.data ?? []).flatMap((r) => r.children);
  const childName = (id: string) => children.find((c) => c.id === id)?.displayName ?? 'Child';

  return (
    <>
      <div className="page-head">
        <h1>Parent updates</h1>
        <p>
          What families were told and when — &quot;on board&quot; and &quot;arrived safely&quot; go
          automatically from the boarding register; &quot;5 minutes away&quot; is sent by the crew.
          Messages only go out on channels each family has opted into.
        </p>
      </div>

      <div className="section-title">Sent updates</div>
      <Card>
        {(updates.data ?? []).length === 0 ? (
          <Empty big="Nothing sent yet">Updates appear here as boardings are recorded.</Empty>
        ) : (
          (updates.data ?? []).slice(0, 30).map((u) => (
            <div className="att-row" key={u.id} style={{ padding: '13px 18px' }}>
              <div>
                <div className="att-who">{u.message}</div>
                <div className="att-what">
                  {fmtDateTime(u.sentAt)} · by {u.sentByName ?? 'system'}
                </div>
              </div>
              <div className="att-meta">
                <Chip tone={u.channels.startsWith('not sent') ? 'amber' : 'green'}>
                  {u.channels}
                </Chip>
              </div>
            </div>
          ))
        )}
      </Card>

      <div className="section-title spaced">Family contacts &amp; consent</div>
      <div className="head-actions">
        <Button variant="ghost" onClick={() => setEditing('new')}>
          Add contact
        </Button>
      </div>
      <Card>
        {(contacts.data ?? []).length === 0 ? (
          <Empty big="No contacts on file" />
        ) : (
          (contacts.data ?? []).map((c) => (
            <button className="row-x clickable" key={c.id} onClick={() => setEditing(c)}>
              <div>
                <div className="row-name">
                  {c.name} <span className="role-tag">{childName(c.childId)}</span>
                </div>
                <div className="row-sub">{c.phone}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Chip tone={c.consentApp ? 'green' : 'neutral'}>
                  app {c.consentApp ? 'opted in' : 'off'}
                </Chip>
                <Chip tone={c.consentSms ? 'green' : 'neutral'}>
                  sms {c.consentSms ? 'opted in' : 'off'}
                </Chip>
              </div>
            </button>
          ))
        )}
      </Card>

      {editing && (
        <ContactForm
          contact={editing === 'new' ? null : editing}
          childOptions={children.map((c) => ({ id: c.id, label: c.displayName }))}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void qc.invalidateQueries({ queryKey: ['parentContacts'] });
          }}
        />
      )}
    </>
  );
}

function ContactForm({
  contact,
  childOptions,
  onClose,
  onSaved,
}: {
  contact: ParentContact | null;
  childOptions: { id: string; label: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [childId, setChildId] = useState(contact?.childId ?? childOptions[0]?.id ?? '');
  const [name, setName] = useState(contact?.name ?? '');
  const [phone, setPhone] = useState(contact?.phone ?? '');
  const [consentApp, setConsentApp] = useState(contact?.consentApp ?? false);
  const [consentSms, setConsentSms] = useState(contact?.consentSms ?? false);
  const [error, setError] = useState('');

  const save = useMutation({
    mutationFn: () => {
      const parsed = contactSchema.safeParse({ childId, name, phone, consentApp, consentSms });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Check the form');
      return api().saveParentContact({ id: contact?.id, ...parsed.data });
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
    <Modal title={contact ? 'Edit contact' : 'Add contact'} onClose={onClose}>
      <form onSubmit={submit}>
        {error && <ErrorNote message={error} />}
        <Field label="Child">
          <Select value={childId} onChange={(e) => setChildId(e.target.value)}>
            {childOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Contact name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Phone (SMS)">
          <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </Field>
        <label className="check-row">
          <input
            type="checkbox"
            checked={consentApp}
            onChange={(e) => setConsentApp(e.target.checked)}
          />
          Consents to app push notifications
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={consentSms}
            onChange={(e) => setConsentSms(e.target.checked)}
          />
          Consents to SMS updates
        </label>
        <p className="field-hint" style={{ margin: '0 0 14px' }}>
          Consent is per family, per channel — nothing is sent without it.
        </p>
        <Button disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save contact'}</Button>
      </form>
    </Modal>
  );
}
