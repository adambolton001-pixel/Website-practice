import { Chip } from 'aegis-app';

export const Statuses = () => (
  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
    <Chip tone="green">Valid · 12 Mar 2027</Chip>
    <Chip tone="amber">Expires in 18d</Chip>
    <Chip tone="red">Action needed</Chip>
    <Chip tone="neutral">Waiting</Chip>
  </div>
);
