import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  User,
  Bell,
  Lock,
  Camera,
  Key,
  Smartphone,
  LogOut,
  Loader,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { isSuperAdmin as detectSuperAdmin } from '../lib/permissions';
import { resolveProfilePhotoUrl, getUserInitials } from '../lib/profilePhoto';
import { userProfileService } from '../services/userProfile.service';
import BackButton from '../components/BackButton';
import './Settings.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACCEPTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
];
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

type ProfileForm = {
  nom: string;
  prenom: string;
  email: string;
  notifications: boolean;
  securityEmails: boolean;
};

function formFromUser(
  user: { nom?: string; prenom?: string; email?: string } | null
): Pick<ProfileForm, 'nom' | 'prenom' | 'email'> {
  return {
    nom: user?.nom ?? '',
    prenom: user?.prenom ?? '',
    email: user?.email ?? '',
  };
}

const Settings: React.FC = () => {
  const { user, updateUser, refreshUser } = useAuth();
  const superAdmin = detectSuperAdmin(user);
  const roleStr =
    typeof user?.role === 'string' ? user.role : user?.role?.nom;

  const [activeTab, setActiveTab] = useState<
    'profile' | 'security' | 'notifications'
  >('profile');

  const [savedForm, setSavedForm] = useState(() => formFromUser(user));
  const [formData, setFormData] = useState<ProfileForm>(() => ({
    ...formFromUser(user),
    notifications: true,
    securityEmails: true,
  }));

  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: '',
  });

  const [photoPreview, setPhotoPreview] = useState<string | null>(() =>
    resolveProfilePhotoUrl(user?.photoUrl)
  );
  const [uploading, setUploading] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [deletePhotoModalOpen, setDeletePhotoModalOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoBlockRef = useRef<HTMLDivElement>(null);

  const hasProfilePhoto = Boolean(user?.photoUrl);

  useEffect(() => {
    const base = formFromUser(user);
    setSavedForm(base);
    setFormData((prev) => ({ ...prev, ...base }));
    setPhotoPreview(resolveProfilePhotoUrl(user?.photoUrl));
  }, [user?.nom, user?.prenom, user?.email, user?.photoUrl]);

  useEffect(() => {
    if (!photoMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (
        photoBlockRef.current &&
        !photoBlockRef.current.contains(e.target as Node)
      ) {
        setPhotoMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [photoMenuOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
    if (name === 'nom' || name === 'prenom' || name === 'email') {
      setSaveError(null);
      setSaveSuccess(null);
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswords({ ...passwords, [name]: value });
  };

  const handleAvatarClick = () => {
    if (uploading || deletingPhoto) return;
    setPhotoMenuOpen((open) => !open);
  };

  const handleModifyPhoto = () => {
    setPhotoMenuOpen(false);
    setUploadError(null);
    fileInputRef.current?.click();
  };

  const handleRequestDeletePhoto = () => {
    setPhotoMenuOpen(false);
    setDeletePhotoModalOpen(true);
  };

  const handleConfirmDeletePhoto = async () => {
    setDeletingPhoto(true);
    setUploadError(null);
    setUploadSuccess(null);
    try {
      await userProfileService.deleteProfilePhoto();
      updateUser({ photoUrl: null });
      await refreshUser();
      setPhotoPreview(null);
      setUploadSuccess('Photo de profil supprimée.');
      setDeletePhotoModalOpen(false);
    } catch (err: unknown) {
      const ax = err as {
        response?: { data?: { error?: string; message?: string } };
      };
      setUploadError(
        ax.response?.data?.error ||
          ax.response?.data?.message ||
          'Erreur lors de la suppression.'
      );
    } finally {
      setDeletingPhoto(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploadSuccess(null);

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setUploadError('Format non supporté. Utilisez PNG, JPG, JPEG ou WEBP.');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setUploadError('La photo ne doit pas dépasser 2 Mo.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      const { photoUrl } = await userProfileService.uploadProfilePhoto(file);
      const resolved = resolveProfilePhotoUrl(photoUrl);
      setPhotoPreview(resolved);
      updateUser({ photoUrl });
      await refreshUser();
      setUploadSuccess('Photo de profil mise à jour.');
    } catch (err: unknown) {
      const ax = err as {
        response?: { data?: { error?: string; message?: string } };
      };
      setUploadError(
        ax.response?.data?.error ||
          ax.response?.data?.message ||
          'Erreur lors du téléversement.'
      );
      setPhotoPreview(resolveProfilePhotoUrl(user?.photoUrl));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCancelProfile = useCallback(() => {
    setFormData((prev) => ({ ...prev, ...savedForm }));
    setPhotoPreview(resolveProfilePhotoUrl(user?.photoUrl));
    setSaveError(null);
    setSaveSuccess(null);
    setUploadError(null);
    setUploadSuccess(null);
  }, [savedForm, user?.photoUrl]);

  const handleSaveProfile = async () => {
    setSaveError(null);
    setSaveSuccess(null);

    const nom = formData.nom.trim();
    const prenom = formData.prenom.trim();
    const email = formData.email.trim().toLowerCase();

    if (!prenom) {
      setSaveError('Le prénom est requis.');
      return;
    }
    if (!nom) {
      setSaveError('Le nom est requis.');
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setSaveError('Adresse e-mail invalide.');
      return;
    }

    const unchanged =
      nom === savedForm.nom &&
      prenom === savedForm.prenom &&
      email === savedForm.email;
    if (unchanged) {
      setSaveError('Aucune modification à enregistrer.');
      return;
    }

    setSaving(true);
    try {
      const updated = await userProfileService.updateMyProfile({
        nom,
        prenom,
        email,
      });
      const next = {
        nom: updated.nom,
        prenom: updated.prenom,
        email: updated.email,
      };
      setSavedForm(next);
      setFormData((prev) => ({ ...prev, ...next }));
      updateUser(next);
      await refreshUser();
      setSaveSuccess('Profil enregistré avec succès.');
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setSaveError(
        ax.response?.data?.message || "Erreur lors de l'enregistrement."
      );
    } finally {
      setSaving(false);
    }
  };

  const initials = getUserInitials(user);

  return (
    <div className="settings-page">
      <BackButton />
      <header className="page-header settings-page-header">
        <h1>Paramètres{superAdmin ? ' Super Admin' : ''}</h1>
      </header>

      <div className="settings-container">
        <aside className="settings-nav premium-card">
          <button
            type="button"
            className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <User size={18} />
            <span>Profil</span>
          </button>
          <button
            type="button"
            className={`nav-item ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            <Lock size={18} />
            <span>Sécurité</span>
          </button>
          <button
            type="button"
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
              <div className="section-header section-header--profile">
                <h2 className="settings-profile-heading">Informations personnelles</h2>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                className="settings-file-input"
                onChange={handleFileChange}
              />

              <div className="profile-upload">
                <div className="profile-photo-block" ref={photoBlockRef}>
                  <button
                    type="button"
                    className="avatar-large avatar-clickable"
                    onClick={handleAvatarClick}
                    title="Gérer la photo de profil"
                    disabled={uploading || deletingPhoto}
                    aria-expanded={photoMenuOpen}
                    aria-haspopup="menu"
                  >
                    {uploading || deletingPhoto ? (
                      <span className="avatar-loader">
                        <Loader size={24} className="spin" />
                      </span>
                    ) : photoPreview ? (
                      <img
                        src={photoPreview}
                        alt="Photo de profil"
                        className="avatar-photo"
                      />
                    ) : (
                      <span className="avatar-initials">{initials}</span>
                    )}
                    <span className="avatar-hover-overlay" aria-hidden>
                      <Camera size={22} />
                      <span className="avatar-hover-label">Modifier</span>
                    </span>
                  </button>

                  {photoMenuOpen && (
                    <div
                      className="profile-photo-menu"
                      role="menu"
                      aria-label="Actions photo de profil"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        className="profile-photo-menu-item"
                        onClick={handleModifyPhoto}
                      >
                        <Pencil size={16} aria-hidden />
                        <span>Modifier la photo</span>
                      </button>
                      {hasProfilePhoto && (
                        <button
                          type="button"
                          role="menuitem"
                          className="profile-photo-menu-item profile-photo-menu-item--danger"
                          onClick={handleRequestDeletePhoto}
                        >
                          <Trash2 size={16} aria-hidden />
                          <span>Supprimer la photo</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="upload-info">
                  <h3>Photo de profil</h3>
                  {uploadError && (
                    <p
                      className="settings-feedback settings-feedback--error"
                      role="alert"
                    >
                      <AlertCircle size={14} aria-hidden />
                      {uploadError}
                    </p>
                  )}
                  {uploadSuccess && (
                    <p
                      className="settings-feedback settings-feedback--success"
                      role="status"
                    >
                      <CheckCircle2 size={14} aria-hidden />
                      {uploadSuccess}
                    </p>
                  )}
                </div>
              </div>

              <div className="settings-form">
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="settings-prenom">Prénom</label>
                    <input
                      id="settings-prenom"
                      type="text"
                      name="prenom"
                      value={formData.prenom}
                      onChange={handleChange}
                      autoComplete="given-name"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="settings-nom">Nom</label>
                    <input
                      id="settings-nom"
                      type="text"
                      name="nom"
                      value={formData.nom}
                      onChange={handleChange}
                      autoComplete="family-name"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="settings-email">E-mail</label>
                  <input
                    id="settings-email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    autoComplete="email"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="settings-role">Rôle</label>
                  <input
                    id="settings-role"
                    type="text"
                    value={roleStr || ''}
                    disabled
                    className="disabled-input"
                  />
                </div>

                {saveError && (
                  <p
                    className="settings-feedback settings-feedback--error"
                    role="alert"
                  >
                    <AlertCircle size={14} aria-hidden />
                    {saveError}
                  </p>
                )}
                {saveSuccess && (
                  <p
                    className="settings-feedback settings-feedback--success"
                    role="status"
                  >
                    <CheckCircle2 size={14} aria-hidden />
                    {saveSuccess}
                  </p>
                )}

                <div className="form-actions settings-form-actions">
                  <button
                    type="button"
                    className="settings-btn settings-btn--ghost"
                    onClick={handleCancelProfile}
                    disabled={saving || uploading}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    className="settings-btn settings-btn--primary"
                    onClick={handleSaveProfile}
                    disabled={saving || uploading}
                  >
                    {saving ? (
                      <>
                        <Loader size={16} className="spin" />
                        Enregistrement…
                      </>
                    ) : (
                      'Enregistrer'
                    )}
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
                  <button
                    type="button"
                    className="settings-btn settings-btn--secondary"
                  >
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
                      <p>
                        Ajoutez une couche de sécurité supplémentaire à votre
                        compte.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="settings-btn settings-btn--outline"
                    >
                      Activer
                    </button>
                  </div>
                </div>

                <hr className="divider" />

                <div className="sessions-section">
                  <h3>Sessions actives</h3>
                  <p>Vous êtes actuellement connecté sur ces appareils.</p>
                  <div className="session-item">
                    <div className="session-icon">
                      <Smartphone size={18} />
                    </div>
                    <div className="session-details">
                      <p className="device">Windows PC • Paris, France</p>
                      <p className="status">
                        Session actuelle • Actif maintenant
                      </p>
                    </div>
                    <button type="button" className="text-btn-danger">
                      <LogOut size={16} /> Déconnecter
                    </button>
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
                    <input
                      type="checkbox"
                      checked={formData.notifications}
                      name="notifications"
                      onChange={handleChange}
                    />
                    <span className="slider round" />
                  </label>
                </div>

                <div className="pref-card">
                  <div className="pref-info">
                    <h4>Alertes de sécurité</h4>
                    <p>
                      Être notifié en cas de tentative de connexion suspecte.
                    </p>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={formData.securityEmails}
                      name="securityEmails"
                      onChange={handleChange}
                    />
                    <span className="slider round" />
                  </label>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>

      {deletePhotoModalOpen && (
        <div
          className="profile-photo-delete-overlay"
          role="presentation"
          onClick={() => !deletingPhoto && setDeletePhotoModalOpen(false)}
        >
          <div
            className="profile-photo-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-photo-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="delete-photo-title">Supprimer la photo</h3>
            <p>Voulez-vous supprimer votre photo de profil ?</p>
            <div className="profile-photo-delete-actions">
              <button
                type="button"
                className="settings-btn settings-btn--ghost"
                onClick={() => setDeletePhotoModalOpen(false)}
                disabled={deletingPhoto}
              >
                Annuler
              </button>
              <button
                type="button"
                className="settings-btn profile-photo-delete-confirm"
                onClick={handleConfirmDeletePhoto}
                disabled={deletingPhoto}
              >
                {deletingPhoto ? (
                  <>
                    <Loader size={16} className="spin" aria-hidden />
                    Suppression…
                  </>
                ) : (
                  'Supprimer'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
