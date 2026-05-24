import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { isEnterpriseAdmin } from '../lib/permissions';
import AdminRecommendations from '../pages/AdminRecommendations';

const AdminRecommendationsRoute: React.FC = () => {
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

  return <AdminRecommendations />;
};

export default AdminRecommendationsRoute;
