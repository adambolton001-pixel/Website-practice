import { ErrorNote } from 'aegis-app';

export const PolicyDenied = () => (
  <ErrorNote message="Your role does not have permission to do that (blocked by access policy)." />
);

export const Validation = () => <ErrorNote message="Describe what happened (at least 10 characters)" />;
