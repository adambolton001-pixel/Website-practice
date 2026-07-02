import { Card, Empty } from 'aegis-app';

export const NoRuns = () => (
  <Card>
    <Empty big="No runs assigned">Nothing scheduled for your sign-in today.</Empty>
  </Card>
);

export const AllValid = () => (
  <Card>
    <Empty big="All records valid">Nothing expiring in the next 30 days.</Empty>
  </Card>
);
