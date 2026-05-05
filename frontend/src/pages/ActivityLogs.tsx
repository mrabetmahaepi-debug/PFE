import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Search, Building2, Calendar, ShieldCheck, Clock, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

import './Dashboard.css'; // Reusing some premium styles

const ActivityLogs: React.FC = () => {
  const navigate = useNavigate();

  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterDate, setFilterDate] = useState('');

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const res = await api.get('/activities');
        const allActivities = res.data || [];
        
        console.log("ActivityLogs received:", allActivities.length, "activities");
        setActivities(allActivities);
      } catch (err) {
        console.error("Failed to fetch activities", err);
      } finally {
        setLoading(false);
      }
    };
    fetchActivities();
  }, []);

  const filteredActivities = useMemo(() => {
    console.log("ActivityLogs - Toutes les activités reçues (avant filtre):", activities.length);
    
    const result = activities.filter(act => {
      const search = searchTerm.toLowerCase().trim();
      const matchSearch = !search || 
        String(act.user || '').toLowerCase().includes(search) || 
        String(act.action || '').toLowerCase().includes(search) || 
        String(act.enterprise || '').toLowerCase().includes(search);
        
      const matchType = !filterType || filterType === 'ALL' || act.type === filterType;
      
      let matchDate = true;
      if (filterDate) {
        try {
          const d = new Date(filterDate);
          if (!isNaN(d.getTime()) && act.date) {
            matchDate = new Date(act.date).toDateString() === d.toDateString();
          }
        } catch (e) {
          // ignore invalid date
        }
      }

      return matchSearch && matchType && matchDate;
    });
    
    console.log("ActivityLogs - Activités après filtres:", result.length);
    return result;
  }, [activities, searchTerm, filterType, filterDate]);

  const handleRowClick = (type: string, id: number) => {
    switch (type) {
      case 'user': navigate('/team'); break;
      case 'project': navigate(`/projects/${id}`); break;
      case 'enterprise': navigate('/enterprises'); break;
      case 'task': navigate('/tasks'); break;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="activity-logs-page"
      style={{ padding: '2rem' }}
    >
      <header className="page-header" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="icon-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <h1>Historique des activités</h1>
              {!loading && (
                <span style={{ background: 'var(--bg-surface)', padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {filteredActivities.length} résultat{filteredActivities.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="subtitle">Supervision complète de toutes les actions sur la plateforme.</p>
          </div>
        </div>
      </header>

      <div className="search-bar premium-card" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center', padding: '1rem', flexWrap: 'wrap' }}>
        <Search size={20} className="text-muted" />
        <input 
          type="text" 
          placeholder="Rechercher une action, un utilisateur, une entreprise..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ border: 'none', outline: 'none', flex: 1, minWidth: '250px', fontSize: '0.9rem', background: 'transparent' }}
        />
        <input 
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="text-btn"
          style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', outline: 'none' }}
        />
        <select 
          value={filterType} 
          onChange={(e) => setFilterType(e.target.value)}
          className="text-btn" 
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid var(--border)', background: 'var(--bg-surface)', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', outline: 'none' }}
        >
          <option value="ALL">Tous les types</option>
          <option value="user">Utilisateurs</option>
          <option value="project">Projets</option>
          <option value="enterprise">Entreprises</option>
          <option value="task">Tâches</option>
        </select>
      </div>

      <div className="premium-card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border)' }}>
            <tr>
              <th style={{ padding: '1rem' }}>Utilisateur</th>
              <th style={{ padding: '1rem' }}>Action</th>
              <th style={{ padding: '1rem' }}>Entreprise</th>
              <th style={{ padding: '1rem' }}>Date</th>
              <th style={{ padding: '1rem' }}>Statut</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Chargement des activités...
                </td>
              </tr>
            ) : filteredActivities.length > 0 ? (
              filteredActivities.map(activity => (
                <tr 
                  key={activity.id} 
                  onClick={() => handleRowClick(activity.type, activity.entityId)}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div className="avatar-small" style={{ width: '32px', height: '32px', fontSize: '0.75rem', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                        {String(activity.user || '?')[0]?.toUpperCase() || '?'}
                      </div>
                      <span style={{ fontWeight: 500 }}>{activity.user || 'Utilisateur inconnu'}</span>
                    </div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{activity.icon}</span>
                      {activity.action}
                    </div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                      <Building2 size={14} /> {activity.enterprise}
                    </div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                      <Calendar size={14} /> {activity.date.toLocaleDateString()}
                    </div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span 
                      className="status-badge" 
                      style={{ 
                        background: activity.status === 'ACTIVE' ? '#dcfce7' : activity.status === 'ERROR' ? '#fee2e2' : '#fef3c7',
                        color: activity.status === 'ACTIVE' ? '#16a34a' : activity.status === 'ERROR' ? '#ef4444' : '#d97706',
                        display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600
                      }}
                    >
                      {activity.status === 'ACTIVE' ? <ShieldCheck size={12} /> : activity.status === 'ERROR' ? <Activity size={12} /> : <Clock size={12} />}
                      {activity.status === 'ACTIVE' ? 'Terminé / Actif' : activity.status === 'ERROR' ? 'Erreur' : 'En attente'}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} style={{ padding: '4rem', textAlign: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)' }}>
                    <Activity size={40} style={{ opacity: 0.5 }} />
                    <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>Aucune activité trouvée</p>
                    <p style={{ fontSize: '0.9rem' }}>Il n'y a pas encore d'actions enregistrées sur la plateforme.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};

export default ActivityLogs;
