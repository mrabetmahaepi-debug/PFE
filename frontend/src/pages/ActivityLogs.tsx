import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Building2, Calendar, ShieldCheck, Clock, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import BackButton from '../components/BackButton';

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
      <header className="page-header" style={{ marginBottom: '3.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem' }}>
          <div style={{ marginTop: '0.6rem' }}>
            <BackButton fallback="/dashboard" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 700, margin: 0, letterSpacing: '-0.025em', color: 'var(--saas-text-primary, #0f172a)', lineHeight: 1.2 }}>
              Activity History
            </h1>
            <p className="subtitle" style={{ margin: 0, fontSize: '1rem', color: 'var(--saas-text-muted, #64748b)', lineHeight: 1.5, opacity: 0.9 }}>
              Complete oversight of all platform actions.
            </p>
          </div>
        </div>
        
        <div style={{ marginTop: '0.6rem' }}>
          {!loading && (
            <span style={{ 
              background: 'var(--bg-surface, #f8fafc)', 
              padding: '0.35rem 1rem', 
              borderRadius: '2rem', 
              fontSize: '0.875rem', 
              fontWeight: 600, 
              color: 'var(--saas-text-muted, #64748b)',
              border: '1px solid var(--border, #e2e8f0)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
            }}>
              {filteredActivities.length} result{filteredActivities.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </header>

      <div className="search-bar premium-card" style={{ 
        marginBottom: '2.5rem', 
        display: 'flex', 
        gap: '1.5rem', 
        alignItems: 'center', 
        padding: '1.25rem 1.5rem', 
        flexWrap: 'wrap',
        background: 'var(--bg-main, #ffffff)',
        border: '1px solid var(--border, #e2e8f0)',
        borderRadius: '16px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '280px', background: 'var(--bg-surface, #f8fafc)', padding: '0.625rem 1rem', borderRadius: '10px', border: '1px solid var(--border, #e2e8f0)' }}>
          <Search size={18} className="text-muted" style={{ color: 'var(--saas-text-muted, #94a3b8)' }} />
          <input 
            type="text" 
            placeholder="Search by action, user, or company..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ border: 'none', outline: 'none', flex: 1, fontSize: '0.9rem', background: 'transparent', color: 'var(--text-main, #334155)' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <input 
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="text-btn"
            style={{ border: '1px solid var(--border, #e2e8f0)', background: 'var(--bg-main, #ffffff)', padding: '0.625rem 1rem', borderRadius: '10px', cursor: 'pointer', outline: 'none', fontSize: '0.9rem', color: 'var(--text-main, #334155)', fontWeight: 500 }}
          />
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
            className="text-btn" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid var(--border, #e2e8f0)', background: 'var(--bg-main, #ffffff)', padding: '0.625rem 1rem', borderRadius: '10px', cursor: 'pointer', outline: 'none', fontSize: '0.9rem', color: 'var(--text-main, #334155)', fontWeight: 500 }}
          >
          <option value="ALL">All Types</option>
          <option value="user">Users</option>
          <option value="project">Projects</option>
          <option value="enterprise">Companies</option>
          <option value="task">Tasks</option>
        </select>
      </div>
      </div>

      <div className="premium-card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border)' }}>
            <tr>
              <th style={{ padding: '1rem' }}>User</th>
              <th style={{ padding: '1rem' }}>Action</th>
              <th style={{ padding: '1rem' }}>Company</th>
              <th style={{ padding: '1rem' }}>Date</th>
              <th style={{ padding: '1rem' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading activities...
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
                      <span style={{ fontWeight: 500 }}>{activity.user || 'Unknown User'}</span>
                    </div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{activity.icon}</span>
                      {activity.action?.replace('Nouvelle entreprise créée', 'New company created').replace('Admin invité', 'Admin invited')}
                    </div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                      <Building2 size={14} /> {activity.enterprise}
                    </div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                      <Calendar size={14} /> {new Date(activity.date).toLocaleDateString('en-GB')}
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
                      {activity.status === 'ACTIVE' ? 'Completed / Active' : activity.status === 'ERROR' ? 'Error' : 'Pending'}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} style={{ padding: '4rem', textAlign: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)' }}>
                    <Activity size={40} style={{ opacity: 0.5 }} />
                    <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>No activities found</p>
                    <p style={{ fontSize: '0.9rem' }}>There are no registered actions on the platform yet.</p>
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
