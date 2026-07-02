import { Field, Select } from 'aegis-app';

export const RunPicker = () => (
  <Field label="Run">
    <Select defaultValue="AM Run 1 — Oakfield Specialist School">
      <option>AM Run 1 — Oakfield Specialist School</option>
      <option>AM Run 2 — Rowan Park School</option>
    </Select>
  </Field>
);

export const ChildPicker = () => (
  <Field label="Child (optional)">
    <Select>
      <option>Not child-specific</option>
      <option>Jamie B.</option>
      <option>Aisha M.</option>
      <option>Leo H.</option>
    </Select>
  </Field>
);
