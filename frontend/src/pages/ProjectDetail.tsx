import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Building2, Users, CheckSquare, Clock, Layout } from 'lucide-react';
import { projectService } from '../services/project.service';
import { type Projet } from '../types/project';
import './Projects.css';

const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Projet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchProject(parseInt(id));
    }
  }, [id]);

  const fetchProject = async (projectId: number) => {
    try {
      setLoading(true);
      const data = await projectService.getById(projectId);
      setProject(data);
    } catch (error) {
      console.error("Failed to fetch project:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading-screen">Chargement...</div>;
  if (!project) return <div className="error-screen">Projet non trouvé.</div>;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="project-detail-page"
      style={{ padding: '2rem' }}
    >
      <header className="page-header" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="icon-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1>{project.nom_p}</h1>
            <p className="subtitle">{project.description_p || 'Aucune description fournie.'}</p>
          </div>
        </div>
        <div className={`status-badge ${project.statut_p?.toLowerCase()}`}>
          {project.statut_p}
        </div>
      </header>

      <div className="project-overview-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        <div className="main-info">
          <section className="premium-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
            <h3>Informations générales</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1rem' }}>
              <div className="info-item">
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Entreprise</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Building2 size={16} /> <span>{project.entreprise?.nom || 'N/A'}</span>
                </div>
              </div>
              <div className="info-item">
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Dates</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Calendar size={16} /> <span>{new Date(project.date_debut || '').toLocaleDateString()} - {new Date(project.date_fin || '').toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="premium-card" style={{ padding: '2rem' }}>
            <h3>Statistiques du projet</h3>
            <div className="stats-strip" style={{ display: 'flex', gap: '2rem', marginTop: '1rem' }}>
              <div className="mini-stat">
                <CheckSquare size={18} />
                <span>{project._count?.tache || 0} Tâches</span>
              </div>
              <div className="mini-stat">
                <Users size={18} />
                <span>{project.membre_projet?.length || 0} Membres</span>
              </div>
              <div className="mini-stat">
                <Clock size={18} />
                <span>{project.avancement || 0}% Avancement</span>
              </div>
            </div>
          </section>
        </div>

        <div className="side-info">
          <section className="premium-card" style={{ padding: '1.5rem' }}>
            <h3>Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
              <button className="primary-btn" style={{ width: '100%' }} onClick={() => navigate('/tasks')}>
                <Layout size={18} /> Voir le Kanban
              </button>
            </div>
          </section>
        </div>
      </div>
    </motion.div>
  );
};

export default ProjectDetail;
