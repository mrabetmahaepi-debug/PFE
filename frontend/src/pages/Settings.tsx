import React, { useState, useRef } from 'react';
import { User, Bell, Lock, Camera, Key, Smartphone, LogOut, Loader } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import BackButton from '../components/BackButton';
import api from '../services/api';
import './Settings.css';

const Settings: React.FC = () => {
  const { user } = useAuth();
  const roleStr = typeof user?.role === 'string' ? user.role : user?.role?.nom;
  
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications'>('profile');
  
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

  // Profile picture state
  const [photoPreview, setPhotoPreview] = useState<string | null>((user as any)?.photoUrl ? `http://localhost:5000${(user as any).photoUrl}` : null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
      setUploadError('Format non supporté. Utilisez JPG, PNG ou GIF.');
      return;
    }
    // Validate size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('La photo ne doit pas dépasser 2MB.');
      return;
    }

    // Immediate preview
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    // Upload to backend
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const res = await api.post('/upload/profile-picture', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setPhotoPreview(`http://localhost:5000${res.data.photoUrl}`);
    } catch (err: any) {
      setUploadError(err.response?.data?.error || 'Erreur lors de l\'upload');
    } finally {
      setUploading(false);
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const initials = `${user?.prenom?.[0] || ''}${user?.nom?.[0] || ''}`;

  return (
    <div className="settings-page">
      <BackButton />
      <header className="page-header">
        <div>
          <h1>Paramètres {roleStr === 'SuperAdmin' ? 'Super Admin' : ''}</h1>
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
        </aside>

        <main className="settings-content">
          {activeTab === 'profile' && (
            <section className="settings-section premium-card">
              <div className="section-header">
                <h2>Informations personnelles</h2>
                <p>Mettez à jour vos informations de profil.</p>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />

              <div className="profile-upload">
                <div 
                  className="avatar-large avatar-clickable"
                  onClick={handleAvatarClick}
                  title="Cliquer pour changer la photo"
                >
                  {uploading ? (
                    <span className="avatar-loader"><Loader size={24} className="spin" /></span>
                  ) : photoPreview ? (
                    <img src={photoPreview} alt="Photo de profil" className="avatar-photo" />
                  ) : (
                    <span>{initials}</span>
                  )}
                  <span className="camera-overlay"><Camera size={16} /></span>
                </div>
                <div className="upload-info">
                  <h3>Photo de profil</h3>
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
                    value={roleStr || ''} 
                    disabled 
                    className="disabled-input" 
                  />
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
        </main>
      </div>
    </div>
  );
};

export default Settings;
