import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Mail, Briefcase, Loader2 } from 'lucide-react';
import { superAdminService, type Invitation } from '../services/superadmin.service';
import { entrepriseService, type Entreprise } from '../services/entreprise.service';
import type { User as UserType } from '../types/auth.types';
import BackButton from '../components/BackButton';
import './Approvals.css';

type PendingUser = UserType & {
  id_utilisateur?: number;
};

const Approvals: React.FC = () => {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<Invitation[]>([]);
  const [entreprises, setEntreprises] = useState<Entreprise[]>([]);
  const [selectedEntreprises, setSelectedEntreprises] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchApprovals();
    fetchEntreprises();
  }, []);

  const fetchEntreprises = async () => {
    try {
      const data = await entrepriseService.getAll();
      setEntreprises(data);
    } catch (err) {
      console.error('Failed to fetch enterprises:', err);
    }
  };

  const fetchApprovals = async () => {
    try {
      const { users, invitations } = await superAdminService.getApprovals();
      setPendingUsers(users);
      setPendingInvitations(invitations);
    } catch (err) {
      console.error('Failed to fetch approvals:', err);
      setError("Impossible de récupérer les demandes. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  const getUserId = (user: PendingUser) => {
    return parseInt(String(user.id ?? user.id_utilisateur ?? '0'));
  };

  const handleApprove = async (id: number) => {
    const entrepriseId = selectedEntreprises[id];
    if (!entrepriseId) {
      setError("Veuillez sélectionner une entreprise avant d'approuver.");
      return;
    }

    setActionLoading(id);
    try {
      await superAdminService.approveUser(id, entrepriseId);
      setPendingUsers((prev) => prev.filter((u) => getUserId(u) !== id));
    } catch (err) {
      console.error('Failed to approve user:', err);
      setError("Échec lors de l'acceptation du compte.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: number) => {
    setActionLoading(id);
    try {
      await superAdminService.rejectUser(id);
      setPendingUsers((prev) => prev.filter((u) => getUserId(u) !== id));
    } catch (err) {
      console.error('Failed to reject user:', err);
      setError("Échec lors du refus du compte.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAcceptInvitation = async (id: number) => {
    setActionLoading(id);
    try {
      await superAdminService.approveInvitation(id);
      setPendingInvitations((prev) => prev.filter((inv) => inv.id_invitation !== id));
    } catch (err) {
      console.error('Failed to accept invitation:', err);
      setError("Échec lors de l'acceptation de l'invitation.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectInvitation = async (id: number) => {
    setActionLoading(id);
    try {
      await superAdminService.rejectInvitation(id);
      setPendingInvitations((prev) => prev.filter((inv) => inv.id_invitation !== id));
    } catch (err) {
      console.error('Failed to reject invitation:', err);
      setError("Échec lors du refus de l'invitation.");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="approvals-loading">
        <Loader2 className="animate-spin" size={40} />
        <p>Chargement des demandes...</p>
      </div>
    );
  }

  return (
    <div className="approvals-page">
      <BackButton />
      <header className="page-header">
        <div>
          <h1>Boîte de réception</h1>
          <p className="subtitle">Gérez les demandes d'inscription et les invitations.</p>
        </div>
      </header>

      {error && (
        <div className="error-banner premium-card">
          <p>{error}</p>
        </div>
      )}

      <div className="approvals-container">
        {pendingUsers.length === 0 && pendingInvitations.length === 0 ? (
          <div className="empty-state premium-card">
            <Check size={48} className="success-icon" />
            <h3>Tout est à jour !</h3>
            <p>Aucune nouvelle demande d'inscription ou invitation en attente.</p>
          </div>
        ) : (
          <div className="approvals-list">
            <AnimatePresence>
              {pendingUsers.map((u) => {
                const userId = getUserId(u);
                return (
                  <motion.div
                    key={`user-${userId}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    className="approval-card premium-card"
                  >
                    <div className="user-main-info">
                      <div className="user-avatar-large">
                        {u.prenom?.[0]}{u.nom?.[0]}
                      </div>
                      <div className="user-details">
                        <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '2px', textTransform: 'uppercase', fontWeight: 600 }}>
                          Demande d'inscription
                        </p>
                        <h3>Demande de : {u.email}</h3>
                        <div className="detail-row">
                          <Mail size={14} />
                          <span>{u.email}</span>
                        </div>
                        <div className="detail-row">
                          <Briefcase size={14} />
                          <span>{typeof u.role === 'object' ? u.role?.nom : (u.role || 'Admin')}</span>
                        </div>
                        <div className="enterprise-selection" style={{ marginTop: '1rem' }}>
                          <label style={{ display: 'block', fontSize: '0.75rem', color: '#666', marginBottom: '5px' }}>Assigner à une entreprise :</label>
                          <select 
                            value={selectedEntreprises[userId] || ''} 
                            onChange={(e) => setSelectedEntreprises(prev => ({ ...prev, [userId]: parseInt(e.target.value) }))}
                            style={{ 
                              width: '100%', 
                              padding: '8px', 
                              borderRadius: '6px', 
                              border: '1px solid #ddd',
                              fontSize: '0.9rem'
                            }}
                          >
                            <option value="">Sélectionner une entreprise...</option>
                            {entreprises.map(ent => (
                              <option key={ent.id_entreprise} value={ent.id_entreprise}>
                                {ent.nom}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="approval-actions">
                      <button
                        className="reject-btn"
                        onClick={() => handleReject(userId)}
                        disabled={actionLoading === userId}
                      >
                        <X size={18} />
                        <span>Refuser</span>
                      </button>
                      <button
                        className="approve-btn"
                        onClick={() => handleApprove(userId)}
                        disabled={actionLoading === userId}
                      >
                        {actionLoading === userId ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                        <span>Accepter</span>
                      </button>
                    </div>
                  </motion.div>
                );
              })}

              {pendingInvitations.map((inv) => (
                <motion.div
                  key={`inv-${inv.id_invitation}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  className="approval-card premium-card"
                >
                  <div className="user-main-info">
                    <div className="user-avatar-large">
                      {inv.email?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="user-details">
                      <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '2px', textTransform: 'uppercase', fontWeight: 600 }}>
                        Invitation
                      </p>
                      <h3>Invitation pour : {inv.email}</h3>
                      <div className="detail-row">
                        <Mail size={14} />
                        <span>{inv.email}</span>
                      </div>
                      <div className="detail-row">
                        <Briefcase size={14} />
                        <span>Rôle ID : {inv.id_role || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="approval-actions">
                    <button
                      className="reject-btn"
                      onClick={() => handleRejectInvitation(inv.id_invitation)}
                      disabled={actionLoading === inv.id_invitation}
                    >
                      <X size={18} />
                      <span>Refuser</span>
                    </button>
                    <button
                      className="approve-btn"
                      onClick={() => handleAcceptInvitation(inv.id_invitation)}
                      disabled={actionLoading === inv.id_invitation}
                    >
                      {actionLoading === inv.id_invitation ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                      <span>Accepter</span>
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default Approvals;
