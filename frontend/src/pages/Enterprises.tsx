import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, UserPlus, Building2, MapPin, Calendar, Trash2, Edit2, Search, Loader2, X, Check, Mail, Lock, User } from 'lucide-react';
import { entrepriseService, type Entreprise } from '../services/entreprise.service';
import BackButton from '../components/BackButton';
import './Enterprises.css';

const Enterprises: React.FC = () => {
  const [entreprises, setEntreprises] = useState<Entreprise[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEntreprise, setNewEntreprise] = useState({ nom: '', adresse: '' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteData, setInviteData] = useState({ nom: '', prenom: '', email: '', mot_de_passe: '', id_entreprise: 0 });
  const [isInviting, setIsInviting] = useState(false);
  const [isCreatingFromInvite, setIsCreatingFromInvite] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEntreprises();
  }, []);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setActionMessage({ type, text });
    setTimeout(() => setActionMessage(null), 3000);
  };

  const fetchEntreprises = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await entrepriseService.getAll();
      setEntreprises(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch enterprises:", error);
      setError("Impossible de charger les entreprises. Vérifiez votre connexion ou les permissions.");
      showMessage('error', 'Erreur lors du chargement des entreprises');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntreprise.nom.trim()) {
      showMessage('error', 'Le nom de l\'entreprise est obligatoire');
      return;
    }
    const isDuplicate = entreprises.some(ent => ent.nom.toLowerCase() === newEntreprise.nom.trim().toLowerCase() && ent.id_entreprise !== editingId);
    if (isDuplicate) {
      showMessage('error', 'Une entreprise avec ce nom existe déjà');
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        await entrepriseService.update(editingId, newEntreprise);
        showMessage('success', 'Entreprise modifiée avec succès');
      } else {
        const created = await entrepriseService.create(newEntreprise);
        showMessage('success', 'Entreprise ajoutée avec succès');
        if (isCreatingFromInvite && created?.id_entreprise) {
          setEntreprises(prev => [...prev, created]);
          setInviteData(prev => ({ ...prev, id_entreprise: created.id_entreprise }));
        }
      }
      closeEnterpriseModal();
      fetchEntreprises(); // Recharger la liste depuis le serveur
    } catch (error: any) {
      console.error("DEBUG - Frontend Error Info:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      const errorMsg = error.response?.data?.message || error.message || "Échec de l'enregistrement";
      const details = error.response?.data?.errors?.[0]?.message;
      showMessage('error', details ? `${errorMsg}: ${details}` : errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (id: number) => {
    try {
      const updated = await entrepriseService.toggleStatus(id);
      setEntreprises(entreprises.map(ent => ent.id_entreprise === id ? { ...ent, statut: updated.statut } : ent));
      showMessage('success', `Statut ${updated.statut === 'active' ? 'activé' : 'désactivé'}`);
    } catch (error) {
      console.error("Failed to toggle status:", error);
      showMessage('error', 'Échec du changement de statut');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette entreprise ?")) return;
    try {
      await entrepriseService.delete(id);
      setEntreprises(entreprises.filter(e => e.id_entreprise !== id));
      showMessage('success', 'Entreprise supprimée');
    } catch (error) {
      console.error("Failed to delete enterprise:", error);
      showMessage('error', 'Échec de la suppression de l\'entreprise');
    }
  };

  const openEditModal = (entreprise: Entreprise) => {
    setNewEntreprise({ nom: entreprise.nom, adresse: entreprise.adresse || '' });
    setEditingId(entreprise.id_entreprise);
    setIsModalOpen(true);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteData.id_entreprise) {
      showMessage('error', 'Veuillez sélectionner une entreprise');
      return;
    }
    setIsInviting(true);
    try {
      const result = await entrepriseService.inviteAdmin(inviteData);
      const msg = result?.message || 'Administrateur créé avec succès';
      showMessage('success', msg);
      setIsInviteModalOpen(false);
      setInviteData({ nom: '', prenom: '', email: '', mot_de_passe: '', id_entreprise: 0 });
      fetchEntreprises(); // Refresh list to show new admin
    } catch (error: any) {
      console.error("Failed to invite admin:", error);
      // Show the exact backend error message
      const backendMsg = error.response?.data?.message;
      const validationErrors = error.response?.data?.errors;
      let errorMsg = backendMsg || "Échec de l'invitation";
      if (validationErrors && Array.isArray(validationErrors)) {
        errorMsg = validationErrors.map((e: any) => e.message).join(', ');
      }
      showMessage('error', errorMsg);
    } finally {
      setIsInviting(false);
    }
  };

  const closeInviteModal = () => {
    setIsInviteModalOpen(false);
    setInviteData({ nom: '', prenom: '', email: '', mot_de_passe: '', id_entreprise: 0 });
  };

  const closeEnterpriseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setIsCreatingFromInvite(false);
    setNewEntreprise({ nom: '', adresse: '' });
  };

  const filteredEntreprises = (entreprises || []).filter(e => 
    (e.nom || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="loading-screen">
        <Loader2 className="animate-spin" size={40} />
        <p>Chargement des entreprises...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="enterprises-page">
        <header className="page-header">
          <h1>Gestion des Entreprises</h1>
        </header>
        <div className="error-banner premium-card" style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px' }}>
          <X size={48} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ color: '#991b1b', marginBottom: '0.5rem' }}>Oups ! Quelque chose s'est mal passé</h3>
          <p style={{ color: '#b91c1c', marginBottom: '1.5rem' }}>{error}</p>
          <button className="primary-btn" onClick={fetchEntreprises} style={{ margin: '0 auto' }}>Réessayer</button>
        </div>
      </div>
    );
  }

  return (
    <div className="enterprises-page">
      <BackButton />
      <header className="page-header">
        <div>
          <h1>Gestion des Entreprises</h1>
          <p className="subtitle">Gérez les sociétés clientes de la plateforme.</p>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '1rem' }}>
          <button className="secondary-btn" onClick={() => setIsInviteModalOpen(true)} style={{ backgroundColor: '#fff', color: '#6366f1', border: '1px solid #6366f1' }}>
            <UserPlus size={20} />
            <span>Inviter un Admin</span>
          </button>
          <button className="primary-btn" onClick={() => { setEditingId(null); setNewEntreprise({nom: '', adresse: ''}); setIsModalOpen(true); }}>
            <Plus size={20} />
            <span>Nouvelle Entreprise</span>
          </button>
        </div>
      </header>

      {actionMessage && (
        <div className={`action-message ${actionMessage.type} premium-card`}>
          {actionMessage.type === 'success' ? <Check size={18} /> : <X size={18} />}
          <span>{actionMessage.text}</span>
        </div>
      )}

      <div className="search-bar premium-card">
        <Search size={20} />
        <input 
          type="text" 
          placeholder="Rechercher une entreprise..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="enterprises-grid">
        {filteredEntreprises.length === 0 ? (
          <div className="empty-state premium-card" style={{ padding: '3rem', textAlign: 'center', gridColumn: '1 / -1' }}>
            <Building2 size={48} color="#cbd5e1" style={{ margin: '0 auto 1rem' }} />
            <p style={{ color: '#64748b' }}>Aucune entreprise trouvée.</p>
          </div>
        ) : (
          <AnimatePresence>
            {filteredEntreprises.map((e) => (
              <motion.div 
                key={e.id_entreprise}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="enterprise-card premium-card"
              >
                <div className="card-header" style={{ position: 'relative' }}>
                  <div className="enterprise-icon">
                    <Building2 size={24} />
                  </div>
                  <div style={{ position: 'absolute', top: 0, right: '80px'}}>
                    <span className={`status-badge ${e.statut === 'inactive' ? 'inactive' : 'active'}`}>
                      {e.statut === 'inactive' ? 'Inactif' : 'Actif'}
                    </span>
                  </div>
                  <div className="card-actions">
                    <button onClick={() => handleToggleStatus(e.id_entreprise)} className="icon-btn" title={e.statut === 'inactive' ? 'Activer' : 'Désactiver'} style={{ padding: '4px', cursor: 'pointer', border: 'none', background: 'none' }}>
                      <div className={`status-dot ${e.statut === 'inactive' ? 'inactive' : 'active'}`}></div>
                    </button>
                    <button onClick={() => openEditModal(e)} className="icon-btn edit"><Edit2 size={16} /></button>
                    <button onClick={() => handleDelete(e.id_entreprise)} className="icon-btn delete"><Trash2 size={16} /></button>
                  </div>
                </div>
                
                <div className="card-body">
                  <h3>{e.nom}</h3>
                  <div className="info-row">
                    <MapPin size={16} />
                    <span>{e.adresse || 'N/A'}</span>
                  </div>
                  <div className="info-row">
                    <Calendar size={16} />
                    <span>Depuis le {e.createdAt ? new Date(e.createdAt).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>

                <div className="card-footer">
                  <div className="admin-info">
                    <div className="avatar-small">
                      {e.admin ? `${(e.admin.prenom || "?")[0]}${(e.admin.nom || "?")[0]}`.toUpperCase() : '?'}
                    </div>
                    <div className="admin-details">
                      <p className="admin-label">Administrateur</p>
                      <p className="admin-name">{e.admin ? `${e.admin.prenom || ""} ${e.admin.nom || ""}` : 'Non assigné'}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay" style={{ zIndex: isCreatingFromInvite ? 2000 : undefined }}>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="modal-container"
          >
            <div className="modal-header">
              <h2>{editingId ? 'Modifier l\'entreprise' : 'Ajouter une entreprise'}</h2>
              <button onClick={closeEnterpriseModal} className="close-btn"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateOrUpdate} className="modal-form">
              <div className="form-group">
                <label>Nom de l'entreprise</label>
                <input 
                  type="text" 
                  required 
                  value={newEntreprise.nom}
                  onChange={(e) => setNewEntreprise({...newEntreprise, nom: e.target.value})}
                  placeholder="Ex: Tech Solutions"
                />
              </div>
              <div className="form-group">
                <label>Adresse / Siège social</label>
                <input 
                  type="text" 
                  value={newEntreprise.adresse}
                  onChange={(e) => setNewEntreprise({...newEntreprise, adresse: e.target.value})}
                  placeholder="Ex: Tunis, Tunisie"
                />
              </div>
              <div className="modal-footer">
                <button type="button" onClick={closeEnterpriseModal} className="secondary-btn">Annuler</button>
                <button type="submit" className="primary-btn" disabled={isSaving}>
                  {isSaving ? <Loader2 className="animate-spin" size={20} /> : (editingId ? 'Enregistrer les modifications' : 'Créer l\'entreprise')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {isInviteModalOpen && (
        <div className="modal-overlay">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="modal-container"
          >
            <div className="modal-header">
              <h2>Inviter un Administrateur</h2>
              <button onClick={closeInviteModal} className="close-btn"><X size={20} /></button>
            </div>
            <form onSubmit={handleInvite} className="modal-form">
              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Prénom</label>
                  <div className="input-with-icon" style={{ position: 'relative' }}>
                    <User size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input 
                      type="text" 
                      required 
                      style={{ paddingLeft: '40px' }}
                      value={inviteData.prenom}
                      onChange={(e) => setInviteData({...inviteData, prenom: e.target.value})}
                      placeholder="Prénom"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Nom</label>
                  <div className="input-with-icon" style={{ position: 'relative' }}>
                    <User size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input 
                      type="text" 
                      required 
                      style={{ paddingLeft: '40px' }}
                      value={inviteData.nom}
                      onChange={(e) => setInviteData({...inviteData, nom: e.target.value})}
                      placeholder="Nom"
                    />
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label>Email</label>
                <div className="input-with-icon" style={{ position: 'relative' }}>
                  <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input 
                    type="email" 
                    required 
                    style={{ paddingLeft: '40px' }}
                    value={inviteData.email}
                    onChange={(e) => setInviteData({...inviteData, email: e.target.value})}
                    placeholder="admin@entreprise.com"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Mot de passe temporaire</label>
                <div className="input-with-icon" style={{ position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input 
                    type="password" 
                    required 
                    style={{ paddingLeft: '40px' }}
                    value={inviteData.mot_de_passe}
                    onChange={(e) => setInviteData({...inviteData, mot_de_passe: e.target.value})}
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Entreprise</label>
                <div className="input-with-icon" style={{ position: 'relative' }}>
                  <Building2 size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <select 
                    required 
                    style={{ paddingLeft: '40px', width: '100%', height: '42px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    value={inviteData.id_entreprise || ''}
                    onChange={(e) => {
                      if (e.target.value === 'NEW') {
                        setIsCreatingFromInvite(true);
                        setEditingId(null);
                        setNewEntreprise({ nom: '', adresse: '' });
                        setIsModalOpen(true);
                      } else {
                        setInviteData({...inviteData, id_entreprise: parseInt(e.target.value)});
                      }
                    }}
                  >
                    <option value="">Sélectionner une entreprise...</option>
                    {entreprises.map(ent => (
                      <option key={ent.id_entreprise} value={ent.id_entreprise}>{ent.nom}</option>
                    ))}
                    <option value="NEW" style={{ fontWeight: 'bold', color: 'var(--primary)', background: '#f8fafc' }}>
                      + Créer une nouvelle entreprise
                    </option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={closeInviteModal} className="secondary-btn">Annuler</button>
                <button type="submit" className="primary-btn" disabled={isInviting}>
                  {isInviting ? <Loader2 className="animate-spin" size={20} /> : 'Envoyer l\'invitation'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Enterprises;
