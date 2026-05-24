import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { monEspacePathFromSpaces } from '../lib/monEspaceRoute';
import { spaceService } from '../services/space.service';

/** Membre — redirige vers /spaces/:id (Mon espace) pour le tableau de bord workspace. */
const MemberMonEspaceRedirect: React.FC = () => {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void spaceService
      .getHierarchy()
      .then(({ spaces }) => {
        if (!cancelled) setTarget(monEspacePathFromSpaces(spaces));
      })
      .catch(() => {
        if (!cancelled) setTarget('/spaces');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!target) {
    return (
      <div className="ms-dashboard ms-dashboard--loading">
        <div className="cu-loader" />
        <p>Chargement de Mon espace…</p>
      </div>
    );
  }

  return <Navigate to={target} replace />;
};

export default MemberMonEspaceRedirect;
