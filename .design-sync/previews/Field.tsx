import { Field, Select, TextInput } from 'aegis-app';

export const WithInput = () => (
  <Field label="Contact name">
    <TextInput defaultValue="Sarah Booth" />
  </Field>
);

export const WithHint = () => (
  <Field label="Photo (optional)" hint="Stored in the private bucket, never public.">
    <TextInput type="file" />
  </Field>
);

export const WithSelect = () => (
  <Field label="Severity">
    <Select defaultValue="Medium">
      <option>Low</option>
      <option>Medium</option>
      <option>High</option>
    </Select>
  </Field>
);
