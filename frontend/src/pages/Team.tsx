import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  UserPlus, 
  Mail, 
  Shield, 
  Trash2, 
  Edit2,
  Search,
  Filter,
  Building2
} from 'lucide-react';
import { teamService } from '../services/team.service';
import { entrepriseService } from '../services/entreprise.service';
import { useAuth } from '../hooks/useAuth';
import type { User } from '../types/auth.types';
import AddMemberModal from '../components/AddMemberModal';
import BackButton from '../components/BackButton';
import './Team.css';

const Team: React.FC = () => {
  const { user: currentUser, hasPermission } = useAuth();
  const isSuperAdmin = currentUser?.role === 'SuperAdmin';
  
  const [members, setMembers] = useState<User[]>([]);
  const [enterprises, setEnterprises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [entrepriseFilter, setEntrepriseFilter] = useState('ALL');
  
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchMembers();
    if (isSuperAdmin) {
      fetchEnterprises();
    }
  }, []);

  const fetchMembers = async () => {
    try {
      const data = await teamService.getAllMembers();
      setMembers(data);
    } catch (error) {
      console.error("Failed to fetch team members:", error);
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

  const getRoleColor = (role?: string) => {
    const r = role?.toLowerCase() || '';
    if (r.includes('admin')) return '#ef4444';
    if (r.includes('pm')) return '#f59e0b';
    if (r.includes('dev')) return '#3b82f6';
    return '#64748b';
  };

  const filteredMembers = members.filter(m => {
    const matchesSearch = `${m.prenom} ${m.nom} ${m.email}`.toLowerCase().includes(searchQuery.toLowerCase());
    const roleName = typeof m.role === 'object' ? m.role.nom : (m.role || '');
    const matchesRole = roleFilter === 'ALL' || roleName === roleFilter || (roleFilter === 'Admin' && roleName.toLowerCase().includes('admin'));
    const matchesEntreprise = entrepriseFilter === 'ALL' || m.id_entreprise?.toString() === entrepriseFilter;
    
    return matchesSearch && matchesRole && matchesEntreprise;
  });

  return (
    <div className="team-page">
      <BackButton />
      <header className="page-header">
        <div>
          <h1>Équipe {isSuperAdmin ? '(Global)' : ''}</h1>
          <p className="subtitle">
            {isSuperAdmin 
              ? 'Gérez tous les utilisateurs de la plateforme.' 
              : 'Gérez les membres de votre entreprise et leurs permissions.'}
          </p>
        </div>
        {!isSuperAdmin && hasPermission('TEAM_INVITE') && (
          <button className="primary-btn" onClick={() => setIsModalOpen(true)}>
            <UserPlus size={20} />
            <span>Ajouter un membre</span>
          </button>
        )}
      </header>

      <div className="filters-bar">
        <div className="search-box">
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Rechercher un membre..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-options">
          <div className="filter-group">
            <Filter size={18} />
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="ALL">Tous les rôles</option>
              <option value="Admin">Administrateurs</option>
              <option value="Membre">Membres</option>
            </select>
          </div>

          {isSuperAdmin && (
            <div className="filter-group">
              <Building2 size={18} />
              <select value={entrepriseFilter} onChange={(e) => setEntrepriseFilter(e.target.value)}>
                <option value="ALL">Toutes les entreprises</option>
                {enterprises.map(ent => (
                  <option key={ent.id_entreprise} value={ent.id_entreprise}>{ent.nom}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="members-container">
        {loading ? (
          <div className="loading-state">
            <div className="loader"></div>
            <p>Chargement des membres...</p>
          </div>
        ) : (
          <div className="members-table-wrapper premium-card">
            <table className="members-table">
              <thead>
                <tr>
                  <th>Membre</th>
                  <th>Rôle</th>
                  <th>Email</th>
                  {isSuperAdmin && <th>Entreprise</th>}
                  <th>Actions</th>
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
                        <div className="member-info">
                          <div className="member-avatar">
                            {member.prenom?.[0]}{member.nom?.[0]}
                          </div>
                          <div className="member-details">
                            <p className="member-name">{member.prenom} {member.nom}</p>
                            <p className="member-id">ID: {member.id_utilisateur || member.id}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span 
                          className="role-badge" 
                          style={{ 
                            backgroundColor: `${getRoleColor(typeof member.role === 'object' ? member.role.nom : member.role)}15`, 
                            color: getRoleColor(typeof member.role === 'object' ? member.role.nom : member.role) 
                          }}
                        >
                          <Shield size={12} />
                          {typeof member.role === 'object' ? member.role.nom : (member.role || 'Membre')}
                        </span>
                      </td>
                      <td>
                        <div className="member-email">
                          <Mail size={14} />
                          <span>{member.email}</span>
                        </div>
                      </td>
                      {isSuperAdmin && (
                        <td>
                          <div className="member-entreprise" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b' }}>
                            <Building2 size={14} />
                            <span>{member.entreprise?.nom || 'N/A'}</span>
                          </div>
                        </td>
                      )}
                      <td>
                        <div className="action-buttons">
                          {!isSuperAdmin && (
                            <>
                              <button className="icon-btn edit" title="Modifier"><Edit2 size={16} /></button>
                              <button className="icon-btn delete" title="Supprimer"><Trash2 size={16} /></button>
                            </>
                          )}
                          {isSuperAdmin && (
                             <button className="icon-btn edit" title="Voir détails"><Search size={16} /></button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
            
            {filteredMembers.length === 0 && (
              <div className="empty-table-state">
                <p>Aucun membre trouvé.</p>
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
