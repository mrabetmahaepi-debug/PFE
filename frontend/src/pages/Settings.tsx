import React, { useState } from 'react';
import { User, Bell, Lock, Save, Camera, Key, Smartphone, LogOut, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import BackButton from '../components/BackButton';
import './Settings.css';

const Settings: React.FC = () => {
  const { user } = useAuth();
  const isSuperAdmin = (typeof user?.role === 'string' ? user.role : user?.role?.nom) === 'SuperAdmin';
  
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications' | 'permissions'>('profile');
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    nom: user?.nom || '',
    prenom: user?.prenom || '',
    email: user?.email || '',
    notifications: true,
    securityEmails: true
  });

  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswords({
      ...passwords,
      [name]: value
    });
  };

  return (
    <div className="settings-page">
      <BackButton />
      <header className="page-header">
        <div>
          <h1>Paramètres {isSuperAdmin ? 'Super Admin' : ''}</h1>
          <p className="subtitle">Gérez vos informations de compte et la sécurité de la plateforme.</p>
        </div>
      </header>

      <div className="settings-container">
        <aside className="settings-nav premium-card">
          <button 
            className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <User size={18} />
            <span>Profil</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            <Lock size={18} />
            <span>Sécurité</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            <Bell size={18} />
            <span>Notifications</span>
          </button>
          {isSuperAdmin && (
            <button 
              className={`nav-item ${activeTab === 'permissions' ? 'active' : ''}`}
              onClick={() => setActiveTab('permissions')}
            >
              <span>Rôles & Permissions</span>
            </button>
          )}
        </aside>

        <main className="settings-content">
          {activeTab === 'profile' && (
            <section className="settings-section premium-card">
              <div className="section-header">
                <h2>Informations personnelles</h2>
                <p>Mettez à jour vos informations de profil.</p>
              </div>

              <div className="profile-upload">
                <div className="avatar-large">
                  {user?.prenom?.[0]}{user?.nom?.[0]}
                  <button className="camera-overlay"><Camera size={16} /></button>
                </div>
                <div className="upload-info">
                  <h3>Photo de profil</h3>
                  <p>JPG, GIF ou PNG. Max 2MB.</p>
                </div>
              </div>

              <div className="settings-form">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Prénom</label>
                    <input type="text" name="prenom" value={formData.prenom} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label>Nom</label>
                    <input type="text" name="nom" value={formData.nom} onChange={handleChange} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Email professionnel</label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Rôle</label>
                  <input 
                    type="text" 
                    value={typeof user?.role === 'string' ? user.role : (user?.role?.nom || '')} 
                    disabled 
                    className="disabled-input" 
                  />
                </div>
                
                <div className="form-actions">
                  <button className="primary-btn">
                    <Save size={18} />
                    <span>Enregistrer les modifications</span>
                  </button>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'security' && (
            <section className="settings-section premium-card">
              <div className="section-header">
                <h2>Sécurité du compte</h2>
                <p>Gérez votre mot de passe et la protection de votre accès.</p>
              </div>

              <div className="security-form">
                <div className="password-section">
                  <h3>Changer le mot de passe</h3>
                  <div className="form-group">
                    <label>Mot de passe actuel</label>
                    <input 
                      type="password" 
                      name="current" 
                      value={passwords.current} 
                      onChange={handlePasswordChange}
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="form-group">
                    <label>Nouveau mot de passe</label>
                    <input 
                      type="password" 
                      name="new" 
                      value={passwords.new} 
                      onChange={handlePasswordChange}
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="form-group">
                    <label>Confirmer le nouveau mot de passe</label>
                    <input 
                      type="password" 
                      name="confirm" 
                      value={passwords.confirm} 
                      onChange={handlePasswordChange}
                      placeholder="••••••••"
                    />
                  </div>
                  <button className="secondary-btn">
                    <Key size={18} />
                    <span>Mettre à jour le mot de passe</span>
                  </button>
                </div>

                <hr className="divider" />

                <div className="mfa-section">
                  <div className="mfa-info">
                    <Smartphone size={24} />
                    <div>
                      <h3>Authentification à deux facteurs</h3>
                      <p>Ajoutez une couche de sécurité supplémentaire à votre compte.</p>
                    </div>
                    <button className="outline-btn">Activer</button>
                  </div>
                </div>

                <hr className="divider" />

                <div className="sessions-section">
                  <h3>Sessions actives</h3>
                  <p>Vous êtes actuellement connecté sur ces appareils.</p>
                  <div className="session-item">
                    <div className="session-icon"><Smartphone size={18} /></div>
                    <div className="session-details">
                      <p className="device">Windows PC • Paris, France</p>
                      <p className="status">Session actuelle • Actif maintenant</p>
                    </div>
                    <button className="text-btn-danger"><LogOut size={16} /> Déconnecter</button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'notifications' && (
            <section className="settings-section premium-card">
              <div className="section-header">
                <h2>Préférences de notifications</h2>
                <p>Choisissez comment vous souhaitez être informé.</p>
              </div>
              
              <div className="preferences-list">
                <div className="pref-card">
                  <div className="pref-info">
                    <h4>Notifications par email</h4>
                    <p>Recevoir des récapitulatifs quotidiens des tâches.</p>
                  </div>
                  <label className="switch">
                    <input type="checkbox" checked={formData.notifications} name="notifications" onChange={handleChange} />
                    <span className="slider round"></span>
                  </label>
                </div>
                
                <div className="pref-card">
                  <div className="pref-info">
                    <h4>Alertes de sécurité</h4>
                    <p>Être notifié en cas de tentative de connexion suspecte.</p>
                  </div>
                  <label className="switch">
                    <input type="checkbox" checked={formData.securityEmails} name="securityEmails" onChange={handleChange} />
                    <span className="slider round"></span>
                  </label>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'permissions' && (
            <section className="settings-section premium-card">
              <div className="section-header">
                <h2>Rôles & Permissions</h2>
                <p>Configurez les droits d'accès globaux et les niveaux de sécurité de la plateforme.</p>
              </div>

              <div className="permissions-detailed-view">
                <div className="info-card-highlight no-icon">
                  <div className="info-text">
                    <h4>Structure des Rôles</h4>
                    <p>Définissez précisément les actions autorisées pour chaque type d'utilisateur. Les modifications s'appliquent en temps réel à tous les membres concernés.</p>
                  </div>
                </div>

                <div className="roles-visual-grid">
                  <div className="role-card">
                    <div className="role-card-header">
                      <div>
                        <h5>Administrateur</h5>
                        <span className="user-count">Plein accès</span>
                      </div>
                    </div>
                    <ul className="role-features">
                      <li>Gestion des entreprises</li>
                      <li>Gestion des équipes</li>
                      <li>Configuration système</li>
                    </ul>
                  </div>

                  <div className="role-card">
                    <div className="role-card-header">
                      <div>
                        <h5>Chef de Projet</h5>
                        <span className="user-count">Accès managérial</span>
                      </div>
                    </div>
                    <ul className="role-features">
                      <li>Création de projets</li>
                      <li>Assignation des tâches</li>
                      <li>Rapports d'activité</li>
                    </ul>
                  </div>

                  <div className="role-card">
                    <div className="role-card-header">
                      <div>
                        <h5>Membre</h5>
                        <span className="user-count">Accès limité</span>
                      </div>
                    </div>
                    <ul className="role-features">
                      <li>Exécution des tâches</li>
                      <li>Commentaires & Fichiers</li>
                      <li>Suivi du temps</li>
                    </ul>
                  </div>
                </div>

                <div className="permissions-cta-box">
                  <div className="cta-content">
                    <h4>Configuration avancée</h4>
                    <p>Pour modifier les permissions granulaires (lecture, écriture, suppression) par module, utilisez l'éditeur complet.</p>
                  </div>
                  <button className="primary-btn pulse-effect" onClick={() => navigate('/permissions')}>
                    <span>Accéder à l'éditeur de permissions</span>
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
};

export default Settings;
