import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { isEnterpriseAdmin } from '../lib/permissions';

/** Restricts route to tenant enterprise Admin only. */
const EnterpriseAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <span>Chargement…</span>
      </div>
    );
  }

  if (!isEnterpriseAdmin(user)) {
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
};

export default EnterpriseAdminRoute;
