import { Spark } from 'aegis-app';

const fortnight = [6, 6, 5, 6, 6, 0, 0, 6, 5, 6, 6, 6, 0, 6];

export const SafelyToSchool = () => (
  <div style={{ maxWidth: 240 }}>
    <Spark
      values={fortnight}
      mark="#2F9E68"
      ariaLabel="Children taken safely to school per day over the last 14 days; latest 6"
      lastLabel="6"
    />
    <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 6 }}>safely to school · last 14 days</div>
  </div>
);

export const OnDark = () => (
  <div style={{ background: '#0C2B23', borderRadius: 18, padding: 22, maxWidth: 260 }}>
    <Spark
      values={[244, 360, 488, 604, 720, 848, 964]}
      mark="#6AA337"
      dark
      ariaLabel="Delivered value this month, cumulative by day"
      lastLabel="£964"
    />
  </div>
);
