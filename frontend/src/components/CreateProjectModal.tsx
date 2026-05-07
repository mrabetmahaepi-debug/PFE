import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Type, AlignLeft, Loader2 } from 'lucide-react';
import { projectService } from '../services/project.service';
import './CreateProjectModal.css';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    nom_p: '',
    description_p: '',
    date_debut: new Date().toISOString().split('T')[0],
    date_fin: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      await projectService.create({
        ...formData,
        date_fin: new Date(formData.date_fin).toISOString(),
        statut_p: 'PLANNING'
      });
      setIsSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
        setIsSuccess(false);
        setFormData({
          nom_p: '',
          description_p: '',
          date_debut: new Date().toISOString().split('T')[0],
          date_fin: ''
        });
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Erreur lors de la création du projet');
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
              <h2>Nouveau Projet</h2>
              <button onClick={onClose} className="close-btn"><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Nom du projet</label>
                <div className="input-wrapper">
                  <Type className="input-icon" size={18} />
                  <input 
                    type="text" 
                    name="nom_p" 
                    placeholder="Ex: Refonte Site Web" 
                    value={formData.nom_p}
                    onChange={handleChange}
                    required 
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Description</label>
                <div className="input-wrapper">
                  <AlignLeft className="input-icon-top" size={18} />
                  <textarea 
                    name="description_p" 
                    placeholder="Décrivez brièvement les objectifs du projet..." 
                    value={formData.description_p}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Date de début</label>
                  <div className="input-wrapper">
                    <Calendar className="input-icon" size={18} />
                    <input 
                      type="date" 
                      name="date_debut" 
                      value={formData.date_debut}
                      onChange={handleChange}
                      required 
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Date de fin prévue</label>
                  <div className="input-wrapper">
                    <Calendar className="input-icon" size={18} />
                    <input 
                      type="date" 
                      name="date_fin" 
                      value={formData.date_fin}
                      onChange={handleChange}
                      required 
                    />
                  </div>
                </div>
              </div>

              {error && <p className="form-error">{error}</p>}
              {isSuccess && <p className="form-success" style={{ color: 'var(--saas-success)', fontWeight: 'bold', textAlign: 'center', padding: '1rem', background: '#dcfce7', borderRadius: '12px', marginBottom: '1rem' }}>Projet créé avec succès !</p>}

              <div className="modal-footer">
                <button type="button" onClick={onClose} className="secondary-btn" disabled={isSubmitting || isSuccess}>Annuler</button>
                <button type="submit" className="primary-btn" disabled={isSubmitting || isSuccess}>
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : isSuccess ? 'Succès !' : 'Créer le projet'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CreateProjectModal;
