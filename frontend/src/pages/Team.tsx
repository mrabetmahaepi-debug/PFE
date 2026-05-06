import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  UserPlus, 
  Trash2, 
  Search,
  Filter,
  Building2,
  Eye
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { teamService } from '../services/team.service';
import { entrepriseService } from '../services/entreprise.service';
import { useAuth } from '../hooks/useAuth';
import type { User } from '../types/auth.types';
import AddMemberModal from '../components/AddMemberModal';
import BackButton from '../components/BackButton';
import './Dashboard.css'; // Premium SaaS styles
import './Team.css';

const Team: React.FC = () => {
  const { user: currentUser, hasPermission } = useAuth();
  const navigate = useNavigate();
  const roleName = typeof currentUser?.role === 'object' ? currentUser.role?.nom : currentUser?.role;
  const isSuperAdmin = roleName?.toString().trim().toUpperCase() === 'SUPERADMIN';
  
  const [members, setMembers] = useState<User[]>([]);
  const [enterprises, setEnterprises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialStatus = queryParams.get('status') === 'active' ? 'ACTIVE' : 'ALL';

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [entrepriseFilter, setEntrepriseFilter] = useState('ALL');
  
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchMembers();
    if (isSuperAdmin) {
      fetchEnterprises();
    }
  }, []);

  const fetchMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await teamService.getAllMembers();
      console.log("Team data received:", data);
      setMembers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Failed to fetch team members:", err);
      setError(err.response?.data?.error || err.response?.data?.message || "Impossible de charger les membres de l'équipe.");
    } finally {
      setLoading(false);
    }
  };

  const fetchEnterprises = async () => {
    try {
      const data = await entrepriseService.getAll();
      setEnterprises(data);
    } catch (error) {
      console.error("Failed to fetch enterprises:", error);
    }
  };

  const deleteMember = async (id: string | number) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur ?")) {
      try {
        await teamService.deleteMember(id.toString());
        setMembers(prev => prev.filter(m => (m.id_utilisateur || m.id) !== id));
      } catch (error) {
        console.error("Failed to delete member:", error);
      }
    }
  };

  const getComputedStatus = (member: User) => {
    if (!member.lastLogin) return 'INACTIVE';
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return new Date(member.lastLogin) >= sevenDaysAgo ? 'ACTIVE' : 'INACTIVE';
  };

  const filteredMembers = members.filter(m => {
    const computedStatus = getComputedStatus(m);
    const matchesSearch = `${m.prenom} ${m.nom} ${m.email} ${m.entreprise?.nom || ''}`.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || computedStatus === statusFilter;
    const matchesEntreprise = entrepriseFilter === 'ALL' || m.id_entreprise?.toString() === entrepriseFilter;
    
    return matchesSearch && matchesStatus && matchesEntreprise;
  });

  return (
    <div className="dashboard-page">
      <header className="page-header">
        <div>
          <BackButton fallback="/dashboard" />
          <h1>{isSuperAdmin ? 'Gestion des Administrateurs' : 'Équipe'}</h1>
          <p className="subtitle">
            {isSuperAdmin 
              ? 'Supervisez et gérez tous les administrateurs d\'entreprise de la plateforme.' 
              : 'Gérez les membres de votre organisation.'}
          </p>
        </div>
        {!isSuperAdmin && hasPermission('TEAM_INVITE') && (
          <button className="primary-btn" onClick={() => setIsModalOpen(true)}>
            <UserPlus size={20} />
            <span>Inviter un membre</span>
          </button>
        )}
      </header>

      {/* Filters & Actions Bar */}
      <div className="card-v3" style={{ marginBottom: '2rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
          <div className="search-container" style={{ maxWidth: '400px', flex: 1 }}>
            <Search size={18} className="search-icon" />
            <input 
              type="text" 
              placeholder="Nom, email, entreprise..." 
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {isSuperAdmin && (
              <div className="filter-group-v3">
                <Building2 size={16} />
                <select value={entrepriseFilter} onChange={(e) => setEntrepriseFilter(e.target.value)}>
                  <option value="ALL">Toutes les entreprises</option>
                  {enterprises.map(ent => (
                    <option key={ent.id_entreprise} value={ent.id_entreprise}>{ent.nom}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="filter-group-v3">
              <Filter size={16} />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="ALL">Tous les statuts</option>
                <option value="ACTIVE">Actif (7 jours)</option>
                <option value="INACTIVE">Inactif</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="card-v3" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="loading-state" style={{ padding: '4rem' }}>
            <div className="loader"></div>
            <p>Chargement des membres...</p>
          </div>
        ) : error ? (
          <div className="error-state" style={{ padding: '4rem', textAlign: 'center' }}>
            <div className="error-card">
              <h3>Erreur</h3>
              <p>{error}</p>
              <button onClick={fetchMembers} className="primary-btn" style={{ marginTop: '1rem' }}>Réessayer</button>
            </div>
          </div>
        ) : (
          <div className="table-wrapper-premium">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>ADMINISTRATEUR</th>
                  <th>ID</th>
                  <th>RÔLE</th>
                  {isSuperAdmin && <th>ENTREPRISE</th>}
                  <th>EMAIL</th>
                  <th>LAST LOGIN</th>
                  <th>STATUT</th>
                  <th style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filteredMembers.map((member) => (
                    <motion.tr 
                      key={member.id_utilisateur || member.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <img 
                            src={`https://ui-avatars.com/api/?name=${member.prenom}+${member.nom}&background=random&color=fff`} 
                            alt="avatar" 
                            style={{ width: 40, height: 40, borderRadius: 12 }} 
                          />
                          <div>
                            <p style={{ fontWeight: 600, color: 'var(--saas-text-main)' }}>{member.prenom} {member.nom}</p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--saas-text-muted)' }}>Platform User</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <code style={{ fontSize: '0.8rem', color: 'var(--saas-primary)' }}>#{member.id_utilisateur || member.id}</code>
                      </td>
                      <td>
                        <span className="badge-growth up" style={{ background: '#f8f7ff', color: 'var(--saas-primary)', border: '1px solid #eef2ff' }}>
                          {typeof member.role === 'object' ? member.role?.nom : (member.role || 'Admin')}
                        </span>
                      </td>
                      {isSuperAdmin && (
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--saas-text-main)', fontWeight: 500 }}>
                            <Building2 size={14} color="var(--saas-text-muted)" />
                            {member.entreprise?.nom || 'N/A'}
                          </div>
                        </td>
                      )}
                      <td style={{ color: 'var(--saas-text-muted)', fontSize: '0.875rem' }}>
                        {member.email}
                      </td>
                      <td style={{ color: 'var(--saas-text-muted)', fontSize: '0.875rem' }}>
                        {member.lastLogin ? new Date(member.lastLogin).toLocaleDateString() : 'Jamais connecté'}
                      </td>
                      <td>
                        <span className={`badge-growth ${getComputedStatus(member) === 'ACTIVE' ? 'up' : 'down'}`}>
                          {getComputedStatus(member) === 'ACTIVE' ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                          <button 
                            className="icon-btn-v3" 
                            title="Voir détails"
                            onClick={() => navigate(`/team/${member.id_utilisateur || member.id}`)}
                          >
                            <Eye size={18} />
                          </button>
                          <button 
                            className="icon-btn-v3 delete" 
                            title="Supprimer"
                            onClick={() => deleteMember(member.id_utilisateur || member.id)}
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
            
            {filteredMembers.length === 0 && (
              <div style={{ padding: '4rem', textAlign: 'center' }}>
                <div className="icon-wrapper-circle" style={{ margin: '0 auto 1rem' }}><Search size={24} /></div>
                <h3 style={{ color: 'var(--saas-text-main)' }}>Aucun administrateur trouvé</h3>
                <p style={{ color: 'var(--saas-text-muted)' }}>Essayez d'ajuster vos filtres ou votre recherche.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {!isSuperAdmin && (
        <AddMemberModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={fetchMembers}
        />
      )}
    </div>
  );
};

export default Team;
