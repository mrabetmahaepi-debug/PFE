import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Mail, Lock, Shield, Loader2 } from 'lucide-react';
import { teamService } from '../services/team.service';
import { useAuth } from '../hooks/useAuth';
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
    role: 'Membre'
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
        id_role: formData.role === 'Admin' ? 2 : (formData.role === 'PM' ? 3 : 4),
        poste: formData.role === 'PM' ? 'Chef de Projet' : formData.role,
        id_entreprise: currentUser?.id_entreprise || 1
      });
      onSuccess();
      onClose();
      setFormData({ nom: '', prenom: '', email: '', motDePasse: '', role: 'Membre' });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de l\'ajout du membre');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="modal-overlay">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="modal-container"
          >
            <div className="modal-header">
              <h2>Ajouter un membre</h2>
              <button onClick={onClose} className="close-btn"><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Prénom</label>
                  <div className="input-wrapper">
                    <User className="input-icon" size={18} />
                    <input 
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
                  <label>Nom</label>
                  <div className="input-wrapper">
                    <User className="input-icon" size={18} />
                    <input 
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
                <label>Email professionnel</label>
                <div className="input-wrapper">
                  <Mail className="input-icon" size={18} />
                  <input 
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
                <label>Mot de passe initial</label>
                <div className="input-wrapper">
                  <Lock className="input-icon" size={18} />
                  <input 
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
                <label>Rôle</label>
                <div className="input-wrapper">
                  <Shield className="input-icon" size={18} />
                  <select name="role" value={formData.role} onChange={handleChange}>
                    <option value="Membre">Membre de projet</option>
                    <option value="PM">Chef de Projet</option>
                    <option value="Admin">Administrateur</option>
                  </select>
                </div>
              </div>

              {error && <p className="form-error">{error}</p>}

              <div className="modal-footer">
                <button type="button" onClick={onClose} className="secondary-btn">Annuler</button>
                <button type="submit" className="primary-btn" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Ajouter le membre'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AddMemberModal;
