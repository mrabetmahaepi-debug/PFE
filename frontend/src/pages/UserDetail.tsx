import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Mail, 
  Phone, 
  Briefcase, 
  Building2, 
  Shield, 
  Calendar
} from 'lucide-react';
import { teamService } from '../services/team.service';
import type { User as UserType } from '../types/auth.types';
import BackButton from '../components/BackButton';
import './Dashboard.css';

const UserDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [member, setMember] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const data = await teamService.getMemberById(id || '0');
        setMember(data);
      } catch (error) {
        console.error("Failed to fetch user detail:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id]);

  if (loading) return <div className="dashboard-page">Loading...</div>;
  if (!member) return <div className="dashboard-page">User not found</div>;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="dashboard-page"
    >
      <header className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <BackButton fallback="/dashboard" />
          <div>
            <h1>{member.prenom} {member.nom}</h1>
            <p className="subtitle">User Profile & Activity</p>
          </div>
        </div>
        <div className="header-right">
          <span className={`badge-growth ${member.statut === 'ACTIVE' ? 'up' : 'down'}`}>
            {member.statut || 'ACTIVE'}
          </span>
        </div>
      </header>

      <div className="dashboard-layout-v3" style={{ gridTemplateColumns: '1fr 2fr' }}>
        {/* Profile Card */}
        <div className="card-v3">
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <img 
              src={`https://ui-avatars.com/api/?name=${member.prenom}+${member.nom}&background=6366f1&color=fff&size=128`} 
              alt="avatar" 
              style={{ width: 120, height: 120, borderRadius: 32, marginBottom: '1rem', border: '4px solid white', boxShadow: 'var(--saas-shadow)' }} 
            />
            <h2>{member.prenom} {member.nom}</h2>
            <p style={{ color: 'var(--saas-primary)', fontWeight: 700 }}>{typeof member.role === 'object' ? member.role?.nom : member.role}</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div className="icon-wrapper-circle"><Mail size={18} /></div>
              <div style={{ overflow: 'hidden' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--saas-text-muted)', display: 'block' }}>Email Address</label>
                <span style={{ fontWeight: 600, wordBreak: 'break-all' }}>{member.email}</span>
              </div>
            </div>
            {member.telephone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div className="icon-wrapper-circle"><Phone size={18} /></div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--saas-text-muted)', display: 'block' }}>Phone</label>
                  <span style={{ fontWeight: 600 }}>{member.telephone}</span>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div className="icon-wrapper-circle"><Briefcase size={18} /></div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--saas-text-muted)', display: 'block' }}>Poste / Position</label>
                <span style={{ fontWeight: 600 }}>{member.poste || 'Not specified'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Association Card */}
        <div className="card-v3">
          <div className="card-header-v3">
            <h3>Platform Association</h3>
            <Shield size={20} color="var(--saas-primary)" />
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div 
              className="stat-card-premium" 
              style={{ background: 'var(--saas-primary-light)', color: 'var(--saas-primary)', cursor: 'pointer' }}
              onClick={() => member.id_entreprise && navigate(`/enterprises/${member.id_entreprise}`)}
            >
              <div className="stat-card-top">
                <div className="icon-wrapper-circle" style={{ background: 'white' }}><Building2 size={20} /></div>
              </div>
              <div className="stat-main">
                <label>Entreprise</label>
                <h3 style={{ fontSize: '1.25rem', marginTop: '0.5rem' }}>{member.entreprise?.nom || 'Independent'}</h3>
                <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Click to view details</p>
              </div>
            </div>

            <div className="stat-card-premium">
              <div className="stat-card-top">
                <div className="icon-wrapper-circle"><Calendar size={20} /></div>
              </div>
              <div className="stat-main">
                <label>Joined Platform</label>
                <h3 style={{ fontSize: '1.25rem', marginTop: '0.5rem' }}>{new Date().toLocaleDateString()}</h3>
                <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Active member</p>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '2rem' }}>
            <h3>Recent Activity</h3>
            <p style={{ color: 'var(--saas-text-muted)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
              Detailed activity logs for this user are coming soon.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default UserDetail;
