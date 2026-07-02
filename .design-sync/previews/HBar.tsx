import { HBar } from 'aegis-app';

const delivered = [
  { label: 'AM Run 1', value: 2816, display: '£2,816.00', sub: 'Sandwell MBC · 22 days' },
  { label: 'AM Run 2', value: 2552, display: '£2,552.00', sub: 'Dudley MBC · 22 days' },
  { label: 'PM Run 1', value: 1408, display: '£1,408.00', sub: 'Sandwell MBC · 11 days' },
];

export const DeliveredValueLight = () => (
  <HBar data={delivered} mark="#2F9E68" ariaLabel="Delivered value by run this month" />
);

export const PipelineDark = () => (
  <div style={{ background: '#0C2B23', borderRadius: 18, padding: 22 }}>
    <HBar
      data={[
        { label: 'Sandwell MBC', value: 140000, display: '~£140k / yr', sub: 'open · closes 11 Jul' },
        { label: 'Wolverhampton CC', value: 22000, display: '£22k / yr', sub: 'won' },
        { label: 'Dudley MBC', value: 18000, display: '£18k / yr', sub: 'bid · closes 4 Jul' },
      ]}
      mark="#6AA337"
      dark
      ariaLabel="Annual value of tracked tenders"
    />
  </div>
);
