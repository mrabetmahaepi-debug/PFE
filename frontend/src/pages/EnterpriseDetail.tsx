import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Building2, 
  Users, 
  Briefcase, 
  MapPin, 
  Calendar, 
  Shield, 
  ChevronRight,
  ArrowLeft
} from 'lucide-react';
import { entrepriseService, type Entreprise } from '../services/entreprise.service';
import './Dashboard.css'; // Reuse SaaS styles

const EnterpriseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [enterprise, setEnterprise] = useState<Entreprise | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const data = await entrepriseService.getById(parseInt(id || '0'));
        setEnterprise(data);
      } catch (error) {
        console.error("Failed to fetch enterprise detail:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id]);

  if (loading) return <div className="dashboard-page">Loading...</div>;
  if (!enterprise) return <div className="dashboard-page">Enterprise not found</div>;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="dashboard-page"
    >
      <header className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button 
            onClick={() => navigate(-1)}
            style={{ background: 'white', border: '1px solid var(--saas-border)', padding: '0.5rem', borderRadius: '12px', cursor: 'pointer' }}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1>{enterprise.nom}</h1>
            <p className="subtitle">Enterprise Administration Hub</p>
          </div>
        </div>
        <div className="header-right">
          <span className={`badge-growth ${enterprise.statut === 'active' ? 'up' : 'down'}`}>
            {enterprise.statut?.toUpperCase() || 'ACTIVE'}
          </span>
        </div>
      </header>

      <div className="dashboard-layout-v3">
        {/* Info Card */}
        <div className="card-v3" style={{ gridColumn: 'span 1' }}>
          <div className="card-header-v3">
            <h3>General Information</h3>
            <Building2 size={20} color="var(--saas-primary)" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div className="icon-wrapper-circle"><MapPin size={18} /></div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--saas-text-muted)', display: 'block' }}>Address</label>
                <span style={{ fontWeight: 600 }}>{enterprise.adresse}</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div className="icon-wrapper-circle"><Calendar size={18} /></div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--saas-text-muted)', display: 'block' }}>Created At</label>
                <span style={{ fontWeight: 600 }}>{new Date(enterprise.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div className="icon-wrapper-circle"><Shield size={18} /></div>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--saas-text-muted)', display: 'block' }}>ID Platform</label>
                <span style={{ fontWeight: 600 }}>#{enterprise.id_entreprise}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Projects Card */}
        <div className="card-v3" style={{ gridColumn: 'span 1' }}>
          <div className="card-header-v3">
            <h3>Projects ({enterprise.projet?.length || 0})</h3>
            <Briefcase size={20} color="var(--saas-secondary)" />
          </div>
          <div className="feed-v3 custom-scroll" style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {enterprise.projet?.map((p: any) => (
              <div key={p.id_projet} className="feed-item-v3" style={{ cursor: 'pointer' }} onClick={() => navigate(`/projects/${p.id_projet}`)}>
                <div className="avatar-v3" style={{ background: 'var(--saas-primary-light)', color: 'var(--saas-primary)' }}>
                  {p.nom_p[0]}
                </div>
                <div className="feed-body-v3">
                  <p><strong>{p.nom_p}</strong></p>
                  <span>{p.statut || 'In Progress'}</span>
                </div>
                <ChevronRight size={16} style={{ marginLeft: 'auto', color: 'var(--saas-text-muted)' }} />
              </div>
            ))}
            {(!enterprise.projet || enterprise.projet.length === 0) && <p style={{ textAlign: 'center', color: 'var(--saas-text-muted)' }}>No projects found</p>}
          </div>
        </div>

        {/* Users Card */}
        <div className="card-v3" style={{ gridColumn: 'span 1' }}>
          <div className="card-header-v3">
            <h3>Team Members ({enterprise.utilisateur?.length || 0})</h3>
            <Users size={20} color="var(--saas-accent)" />
          </div>
          <div className="feed-v3 custom-scroll" style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {enterprise.utilisateur?.map((u: any) => (
              <div key={u.id_utilisateur} className="feed-item-v3" style={{ cursor: 'pointer' }} onClick={() => navigate(`/team/${u.id_utilisateur}`)}>
                <img 
                  src={`https://ui-avatars.com/api/?name=${u.prenom}+${u.nom}&background=random&color=fff`} 
                  alt="avatar" 
                  style={{ width: 40, height: 40, borderRadius: 12 }} 
                />
                <div className="feed-body-v3">
                  <p><strong>{u.prenom} {u.nom}</strong></p>
                  <span>{u.role?.nom || 'Member'}</span>
                </div>
                <ChevronRight size={16} style={{ marginLeft: 'auto', color: 'var(--saas-text-muted)' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default EnterpriseDetail;
