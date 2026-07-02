import { Field, TextArea } from 'aegis-app';

export const IncidentDescription = () => (
  <Field label="What happened?">
    <TextArea defaultValue="Aisha became distressed after a diversion via the A461. Calmed with ear defenders; arrived settled." />
  </Field>
);

export const EmptyWithPlaceholder = () => (
  <Field label="What happened?">
    <TextArea placeholder="Facts, times, who was involved, what you did…" />
  </Field>
);
