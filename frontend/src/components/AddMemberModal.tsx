import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Mail, Lock, Shield, Loader2, ChevronDown } from 'lucide-react';
import { teamService } from '../services/team.service';
import { useAuth } from '../hooks/useAuth';
import { PROJECT_POSTE_OPTIONS } from '../lib/projectRoleLabels';
import './AddMemberModal.css';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AddMemberModal: React.FC<AddMemberModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user: currentUser } = useAuth();
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    email: '',
    motDePasse: '',
    poste: 'Membre',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      await teamService.addMember({
        nom: formData.nom,
        prenom: formData.prenom,
        email: formData.email,
        password: formData.motDePasse,
        id_role: 4,
        poste: formData.poste,
        id_entreprise: currentUser?.id_entreprise || 1,
      });
      console.info('[roleAssignment:addMemberModal]', {
        selectedRole: formData.poste,
      });
      onSuccess();
      onClose();
      setFormData({ nom: '', prenom: '', email: '', motDePasse: '', poste: 'Membre' });
    } catch (err: any) {
      setError(err.response?.data?.message || "Erreur lors de l'ajout du membre");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          className="modal-overlay compact-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="modal-container compact-modal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-header compact-modal-header">
              <div>
                <h2>Inviter un membre</h2>
                <p>Ajoutez un collaborateur à votre entreprise</p>
              </div>
              <button
                onClick={onClose}
                className="close-btn"
                aria-label="Fermer"
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form compact-modal-form">
              <div className="compact-modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="invite-prenom">Prénom</label>
                    <div className="input-wrapper">
                      <User className="input-icon" size={16} />
                      <input
                        id="invite-prenom"
                        type="text"
                        name="prenom"
                        placeholder="Jean"
                        value={formData.prenom}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="invite-nom">Nom</label>
                    <div className="input-wrapper">
                      <User className="input-icon" size={16} />
                      <input
                        id="invite-nom"
                        type="text"
                        name="nom"
                        placeholder="Dupont"
                        value={formData.nom}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="invite-email">Email professionnel</label>
                  <div className="input-wrapper">
                    <Mail className="input-icon" size={16} />
                    <input
                      id="invite-email"
                      type="email"
                      name="email"
                      placeholder="jean.dupont@entreprise.com"
                      value={formData.email}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="invite-password">Mot de passe initial</label>
                  <div className="input-wrapper">
                    <Lock className="input-icon" size={16} />
                    <input
                      id="invite-password"
                      type="password"
                      name="motDePasse"
                      placeholder="••••••••"
                      value={formData.motDePasse}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="invite-poste">Rôle / Poste</label>
                  <div className="input-wrapper">
                    <Shield className="input-icon" size={16} />
                    <select
                      id="invite-poste"
                      name="poste"
                      value={formData.poste}
                      onChange={handleChange}
                      required
                    >
                      {PROJECT_POSTE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="select-chevron" />
                  </div>
                </div>

                {error && <p className="form-error">{error}</p>}
              </div>

              <div className="modal-footer compact-modal-footer">
                <button type="button" onClick={onClose} className="secondary-btn">
                  Annuler
                </button>
                <button type="submit" className="primary-btn" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    'Ajouter le membre'
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default AddMemberModal;
