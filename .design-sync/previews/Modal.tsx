import { Button, Field, Modal, Select, TextArea } from 'aegis-app';

export const IncidentReport = () => (
  <Modal title="Report an incident" onClose={() => {}}>
    <Field label="Run">
      <Select defaultValue="AM Run 1 — Oakfield Specialist School">
        <option>AM Run 1 — Oakfield Specialist School</option>
        <option>AM Run 2 — Rowan Park School</option>
      </Select>
    </Field>
    <Field label="What happened?" hint="Facts, times, who was involved, what you did.">
      <TextArea defaultValue="Nearside sliding door sticking on first open. Usable but needs looking at." />
    </Field>
    <Button>Submit report</Button>
  </Modal>
);
