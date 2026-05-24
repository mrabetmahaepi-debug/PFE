import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { isGlobalMember, isEnterpriseAdmin } from '../lib/permissions';
import PermissionRoute from './PermissionRoute';
import Messages from '../pages/Messages';
import MemberInbox from '../pages/MemberInbox';

/** Membres et admins entreprise → notifications ; autres rôles → messagerie. */
const InboxRoute: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-state">
        <span>Chargement…</span>
      </div>
    );
  }

  if (isGlobalMember(user) || isEnterpriseAdmin(user)) {
    return <MemberInbox />;
  }

  return (
    <PermissionRoute permission="MESSAGING_USE">
      <Messages />
    </PermissionRoute>
  );
};

export default InboxRoute;
