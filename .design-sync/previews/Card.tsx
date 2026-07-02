import { Card, Chip } from 'aegis-app';

export const ListCard = () => (
  <Card>
    <div className="row-x">
      <div>
        <div className="row-name">Darren Whitlock <span className="role-tag">driver</span></div>
        <div className="row-sub">3 records · tap to view</div>
      </div>
      <Chip tone="red">1 expired</Chip>
    </div>
    <div className="row-x">
      <div>
        <div className="row-name">Maria Okafor <span className="role-tag">pa</span></div>
        <div className="row-sub">4 records · tap to view</div>
      </div>
      <Chip tone="green">All valid</Chip>
    </div>
  </Card>
);

export const Padded = () => (
  <Card pad>
    <div className="section-title">Next deadline</div>
    <div className="row-name">Dudley MBC <span className="role-tag">Spot route</span></div>
    <div className="row-sub">DUD-SEN-RT-118 · £18k / yr</div>
  </Card>
);
