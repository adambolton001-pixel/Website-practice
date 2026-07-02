import { Field, TextInput } from 'aegis-app';

export const Filled = () => (
  <Field label="Phone (SMS)">
    <TextInput defaultValue="07700 900101" />
  </Field>
);

export const Placeholder = () => (
  <Field label="Value">
    <TextInput placeholder="£18k / yr" />
  </Field>
);

export const DateInput = () => (
  <Field label="Closes">
    <TextInput type="date" defaultValue="2026-07-11" />
  </Field>
);
