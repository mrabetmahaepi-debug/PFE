import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  Users, 
  ChevronRight, 
  Plus, 
  Search, 
  Loader2, 
  Building2,
  CheckCircle2,
  AlertCircle,
  XCircle
} from 'lucide-react';
import { accessService } from '../services/access.service';
import type { AdminAccess } from '../services/access.service';
import BackButton from '../components/BackButton';
import './ProjectAccess.css';

interface Admin {
  id_utilisateur: number;
  nom: string;
  prenom: string;
  email: string;
  entreprise?: {
    nom: string;
  };
}

interface Project {
  id_projet: number;
  nom_p: string;
  entreprise?: {
    nom: string;
  };
}

const ProjectAccess: React.FC = () => {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedAdminId, setSelectedAdminId] = useState<number | null>(null);
  const [adminAccess, setAdminAccess] = useState<AdminAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessLoading, setAccessLoading] = useState(false);
  const [searchAdmin, setSearchAdmin] = useState('');
  const [searchProject, setSearchProject] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedAdminId) {
      fetchAdminAccess(selectedAdminId);
    } else {
      setAdminAccess([]);
    }
  }, [selectedAdminId]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [adminsData, projectsData] = await Promise.all([
        accessService.getAdmins(),
        accessService.getProjects()
      ]);
      console.log("DEBUG - Admins received:", adminsData);
      console.log("DEBUG - Projects received:", projectsData);
      setAdmins(adminsData);
      setProjects(projectsData);
    } catch (error) {
      console.error("Failed to fetch initial data:", error);
      showMessage('error', "Impossible de charger les données");
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminAccess = async (adminId: number) => {
    try {
      setAccessLoading(true);
      const data = await accessService.getAdminAccess(adminId);
      setAdminAccess(data);
    } catch (error) {
      console.error("Failed to fetch admin access:", error);
      showMessage('error', "Impossible de charger les accès");
    } finally {
      setAccessLoading(false);
    }
  };

  const handleAssign = async (projectId: number) => {
    if (!selectedAdminId) return;
    try {
      await accessService.assignProject(selectedAdminId, projectId);
      showMessage('success', "Accès accordé");
      fetchAdminAccess(selectedAdminId);
    } catch (error: any) {
      showMessage('error', error.response?.data?.message || "Échec de l'attribution");
    }
  };

  const handleUnassign = async (projectId: number) => {
    if (!selectedAdminId) return;
    try {
      await accessService.unassignProject(selectedAdminId, projectId);
      showMessage('success', "Accès retiré");
      fetchAdminAccess(selectedAdminId);
    } catch (error: any) {
      showMessage('error', error.response?.data?.message || "Échec de la suppression");
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const filteredAdmins = admins.filter(a => 
    `${a.nom} ${a.prenom} ${a.email}`.toLowerCase().includes(searchAdmin.toLowerCase())
  );

  const selectedAdmin = admins.find(a => a.id_utilisateur === selectedAdminId);

  const isAssigned = (projectId: number) => adminAccess.some(access => access.id_projet === projectId);

  const filteredProjects = projects.filter(p => 
    p.nom_p.toLowerCase().includes(searchProject.toLowerCase())
  );

  if (loading) {
    return (
      <div className="loading-screen">
        <Loader2 className="animate-spin" size={40} />
        <p>Initialisation du centre d'accès...</p>
      </div>
    );
  }

  return (
    <div className="access-page">
      <BackButton />
      <header className="page-header">
        <div className="title-section">
          <Shield className="header-icon" size={32} />
          <div>
            <h1>Gestion des Accès Projets</h1>
            <p>Attribuez des privilèges d'administration aux projets spécifiques</p>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {message && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`alert-toast ${message.type}`}
          >
            {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="access-container">
        {/* Sidebar: Admin Selection */}
        <div className="admins-sidebar premium-card">
          <div className="search-box">
            <Search size={18} />
            <input 
              type="text" 
              placeholder="Rechercher un Admin..." 
              value={searchAdmin}
              onChange={(e) => setSearchAdmin(e.target.value)}
            />
          </div>
          <div className="admins-list">
            {filteredAdmins.map(admin => (
              <motion.div 
                key={admin.id_utilisateur}
                whileHover={{ x: 4 }}
                className={`admin-item ${selectedAdminId === admin.id_utilisateur ? 'active' : ''}`}
                onClick={() => setSelectedAdminId(admin.id_utilisateur)}
              >
                <div className="admin-avatar">
                  {admin.prenom[0]}{admin.nom[0]}
                </div>
                <div className="admin-info">
                  <p className="admin-name">{admin.prenom} {admin.nom}</p>
                  <p className="admin-entreprise">{admin.entreprise?.nom || 'N/A'}</p>
                </div>
                <ChevronRight size={16} className="chevron" />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Main Content: Project Management */}
        <div className="projects-management">
          <AnimatePresence mode="wait">
            {!selectedAdminId ? (
              <motion.div 
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="select-placeholder premium-card"
              >
                <Users size={48} />
                <h3>Sélectionnez un administrateur</h3>
                <p>Choisissez un admin dans la liste pour gérer ses accès aux projets.</p>
              </motion.div>
            ) : (
              <motion.div 
                key="access-view"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="access-view"
              >
                <div className="selected-admin-header premium-card">
                  <div className="admin-detail-badge">
                    <div className="avatar-large">{selectedAdmin?.prenom[0]}{selectedAdmin?.nom[0]}</div>
                    <div className="detail-info">
                      <h2>{selectedAdmin?.prenom} {selectedAdmin?.nom}</h2>
                      <p>{selectedAdmin?.email}</p>
                    </div>
                  </div>
                  <div className="stats-row">
                    <div className="stat">
                      <span className="stat-value">{adminAccess.length}</span>
                      <span className="stat-label">Projets assignés</span>
                    </div>
                  </div>
                </div>

                <div className="projects-grid-container">
                  <div className="grid-header">
                    <h3>Disponibilité des Projets</h3>
                    <div className="search-box small">
                      <Search size={14} />
                      <input 
                        type="text" 
                        placeholder="Rechercher un projet..." 
                        value={searchProject}
                        onChange={(e) => setSearchProject(e.target.value)}
                      />
                    </div>
                  </div>

                  {accessLoading ? (
                    <div className="grid-loading">
                      <Loader2 className="animate-spin" />
                      <span>Chargement des accès...</span>
                    </div>
                  ) : (
                    <div className="projects-grid">
                      {filteredProjects.map(project => {
                        const assigned = isAssigned(project.id_projet);
                        return (
                          <motion.div 
                            key={project.id_projet}
                            whileHover={{ y: -2 }}
                            className={`project-access-card premium-card ${assigned ? 'assigned' : ''}`}
                          >
                            <div className="project-icon">
                              <Building2 size={20} />
                            </div>
                            <div className="project-info">
                              <h4>{project.nom_p}</h4>
                              <p className="proj-entreprise">{project.entreprise?.nom}</p>
                            </div>
                            <div className="project-action">
                              {assigned ? (
                                <button 
                                  className="action-btn unassign"
                                  onClick={() => handleUnassign(project.id_projet)}
                                  title="Retirer l'accès"
                                >
                                  <XCircle size={20} />
                                </button>
                              ) : (
                                <button 
                                  className="action-btn assign"
                                  onClick={() => handleAssign(project.id_projet)}
                                  title="Donner l'accès"
                                >
                                  <Plus size={20} />
                                </button>
                              )}
                            </div>
                            {assigned && <div className="assigned-ribbon">Accès Accordé</div>}
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default ProjectAccess;
