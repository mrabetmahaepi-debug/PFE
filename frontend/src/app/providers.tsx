import type { ReactNode } from 'react';
import CursorClickEffect from '../components/CursorClickEffect';

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <>
      <CursorClickEffect />
      {children}
    </>
  );
}
