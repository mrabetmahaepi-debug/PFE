import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Filter, MoreVertical, Users, CheckCircle2, Briefcase, ShieldAlert, Building2, ArrowRight } from 'lucide-react';
import { projectService } from '../services/project.service';
import { useAuth } from '../hooks/useAuth';
import { ProjectStatus } from '../types/project';
import CreateProjectModal from '../components/CreateProjectModal';
import BackButton from '../components/BackButton';
import { useNavigate } from 'react-router-dom';
import './Projects.css';

const Projects: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const isSuperAdmin = user?.role === 'SuperAdmin';
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<ProjectStatus | 'ALL'>('ALL');
  const [enterpriseFilter, setEnterpriseFilter] = useState<string>('ALL');
  const [sortOption, setSortOption] = useState<string>('newest');
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const data = await projectService.getAll();
      setProjects(data);
    } catch (error) {
      console.error("Failed to fetch projects:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = projects.filter(p => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = p.nom_p?.toLowerCase().includes(searchLower) || 
                          p.responsable?.toLowerCase().includes(searchLower) ||
                          p.entreprise?.nom?.toLowerCase().includes(searchLower);
    const matchesFilter = filter === 'ALL' || p.statut_p === filter;
    const matchesEnterprise = enterpriseFilter === 'ALL' || p.id_entreprise?.toString() === enterpriseFilter;
    return matchesSearch && matchesFilter && matchesEnterprise;
  }).sort((a, b) => {
    if (sortOption === 'newest') return new Date(b.createdAt || b.date_debut || 0).getTime() - new Date(a.createdAt || a.date_debut || 0).getTime();
    if (sortOption === 'oldest') return new Date(a.createdAt || a.date_debut || 0).getTime() - new Date(b.createdAt || b.date_debut || 0).getTime();
    if (sortOption === 'prog_high') return (b.avancement || 0) - (a.avancement || 0);
    if (sortOption === 'prog_low') return (a.avancement || 0) - (b.avancement || 0);
    return 0;
  });

  const uniqueEnterprises = Array.from(new Set(projects.filter(p => p.entreprise).map(p => p.entreprise.id_entreprise)))
    .map(id => projects.find(p => p.entreprise?.id_entreprise === id)?.entreprise);

  const getStatusColor = (status: ProjectStatus) => {
    switch (status) {
      case ProjectStatus.IN_PROGRESS: return '#4f46e5';
      case ProjectStatus.COMPLETED: return '#10b981';
      case ProjectStatus.ON_HOLD: return '#f59e0b';
      case ProjectStatus.PLANNING: return '#64748b';
      default: return '#64748b';
    }
  };

  return (
    <div className="projects-page">
      <BackButton />
      <header className="page-header">
        <div>
          <h1>Projets {isSuperAdmin ? '(Supervision)' : ''}</h1>
          <p className="subtitle">
            {isSuperAdmin 
              ? 'Supervision globale de tous les projets de la plateforme.' 
              : 'Gérez et suivez l\'avancement de vos projets d\'équipe.'}
          </p>
        </div>
        {!isSuperAdmin && hasPermission('PROJECT_CREATE') && (
          <button className="primary-btn" onClick={() => setIsModalOpen(true)}>
            <Plus size={20} />
            <span>Nouveau Projet</span>
          </button>
        )}
      </header>

      {isSuperAdmin && (
        <div className="superadmin-banner">
          <ShieldAlert size={20} />
          <span>Mode Supervision : Vous consultez tous les projets en lecture seule.</span>
        </div>
      )}

      <div className="filters-bar">
        <div className="filters-left">
          <div className="search-box">
            <Search size={18} />
            <input 
              type="text" 
              placeholder="Rechercher par nom, responsable ou entreprise..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        
        <div className="filters-right">
          {isSuperAdmin && (
            <div className="filter-group">
              <Building2 size={16} />
              <select value={enterpriseFilter} onChange={(e) => setEnterpriseFilter(e.target.value)}>
                <option value="ALL">Toutes Entreprises</option>
                {uniqueEnterprises.map(e => e && (
                  <option key={e.id_entreprise} value={e.id_entreprise.toString()}>{e.nom}</option>
                ))}
              </select>
            </div>
          )}

          <div className="filter-group">
            <Filter size={16} />
            <select value={filter} onChange={(e) => setFilter(e.target.value as any)}>
              <option value="ALL">Tous Statuts</option>
              <option value={ProjectStatus.PLANNING}>Planning</option>
              <option value={ProjectStatus.IN_PROGRESS}>En cours</option>
              <option value={ProjectStatus.ON_HOLD}>En attente</option>
              <option value={ProjectStatus.COMPLETED}>Terminé</option>
            </select>
          </div>

          <div className="filter-group">
            <select value={sortOption} onChange={(e) => setSortOption(e.target.value)}>
              <option value="newest">Plus récents</option>
              <option value="oldest">Plus anciens</option>
              <option value="prog_high">Progression ↑</option>
              <option value="prog_low">Progression ↓</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="loader"></div>
          <p>Chargement des projets...</p>
        </div>
      ) : (
        <motion.div layout className="projects-grid">
          <AnimatePresence mode='popLayout'>
            {filteredProjects.map((project) => (
              <motion.div 
                key={project.id_projet}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                whileHover={{ y: -8, boxShadow: '0 20px 40px rgba(0,0,0,0.12)' }}
                className="project-super-card"
                onClick={() => navigate(`/projects/${project.id_projet}`)}
              >
                {/* Zone 1: Header */}
                <div className="card-top-zone">
                  <div className="project-title-area">
                    <h3 className="project-title">{project.nom_p}</h3>
                    <span 
                      className="status-pill" 
                      style={{ 
                        backgroundColor: `${getStatusColor(project.statut_p as any)}15`, 
                        color: getStatusColor(project.statut_p as any),
                        border: `1px solid ${getStatusColor(project.statut_p as any)}30`
                      }}
                    >
                      {project.statut_p?.replace('_', ' ')}
                    </span>
                  </div>
                  {!isSuperAdmin && (
                    <button className="card-action-btn" onClick={(e) => { e.stopPropagation(); }}>
                      <MoreVertical size={16} />
                    </button>
                  )}
                </div>
                
                {/* Zone 2: Body */}
                <div className="card-body-zone">
                  <p className="project-desc">{project.description_p || 'Aucune description fournie.'}</p>
                  <div className="entity-info">
                    <Building2 size={14} className="entity-icon" />
                    <span 
                      className="entity-link"
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        if (project.entreprise) navigate(`/enterprises/${project.entreprise.id_entreprise}`); 
                      }}
                    >
                      {project.entreprise?.nom || 'Plateforme'}
                    </span>
                  </div>
                </div>

                {/* Zone 3: Stats */}
                <div className="card-stats-zone">
                  <div className="stats-row">
                    <div className="stat-pill">
                      <Users size={14} />
                      <span>{project.membresCount || 0}</span>
                    </div>
                    <div className="stat-pill">
                      <CheckCircle2 size={14} />
                      <span>{project.tachesCount || 0} tâches</span>
                    </div>
                  </div>

                  <div className="progress-section">
                    <div className="progress-labels">
                      <span>Progression</span>
                      <span className="percent-label">{project.avancement || 0}%</span>
                    </div>
                    <div className="super-progress-bar">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${project.avancement || 0}%` }}
                        className="progress-track"
                        style={{ backgroundColor: getStatusColor(project.statut_p as any) }}
                      />
                    </div>
                    {project.tachesCount === 0 && (
                      <span className="empty-tasks-hint">Aucune tâche assignée</span>
                    )}
                  </div>
                </div>

                {/* Zone 4: Footer */}
                <div className="card-footer-zone">
                  <div className="responsable-area">
                    <div className="responsable-avatar">
                      {String(project.responsable || '?')[0].toUpperCase()}
                    </div>
                    <div className="responsable-info">
                      <span className="responsable-label">Responsable</span>
                      <span className="responsable-name">{project.responsable || 'Non assigné'}</span>
                    </div>
                  </div>
                  <div className="card-action-hint">
                    <span>Détails</span>
                    <ArrowRight size={14} />
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {!loading && filteredProjects.length === 0 && (
        <div className="empty-super-state">
          <div className="empty-icon-box">
            <Briefcase size={48} />
          </div>
          <h3>Aucun projet trouvé</h3>
          <p>{isSuperAdmin ? "Aucun projet n'a été créé sur la plateforme." : "Commencez par créer votre premier projet pour l'équipe."}</p>
        </div>
      )}

      {!isSuperAdmin && (
        <CreateProjectModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={fetchProjects} 
        />
      )}
    </div>
  );
};

export default Projects;
