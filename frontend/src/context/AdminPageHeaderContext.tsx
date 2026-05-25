import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type AdminPageHeaderConfig = {
  title: string;
  subtitle?: string | null;
  badge?: string | null;
  action?: ReactNode | null;
};

type AdminPageHeaderContextValue = {
  header: AdminPageHeaderConfig | null;
  setHeader: (config: AdminPageHeaderConfig | null) => void;
};

const AdminPageHeaderContext = createContext<AdminPageHeaderContextValue | null>(null);

export function AdminPageHeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeaderState] = useState<AdminPageHeaderConfig | null>(null);
  const setHeader = useCallback((config: AdminPageHeaderConfig | null) => {
    setHeaderState(config);
  }, []);

  const value = useMemo(() => ({ header, setHeader }), [header, setHeader]);

  return (
    <AdminPageHeaderContext.Provider value={value}>{children}</AdminPageHeaderContext.Provider>
  );
}

export function useAdminPageHeader(): AdminPageHeaderContextValue {
  const ctx = useContext(AdminPageHeaderContext);
  if (!ctx) {
    return { header: null, setHeader: () => {} };
  }
  return ctx;
}
