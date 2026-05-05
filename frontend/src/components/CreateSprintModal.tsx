import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Type, Loader2 } from 'lucide-react';
import { sprintService } from '../services/sprint.service';
import './CreateProjectModal.css'; // Reusing similar modal styles

interface CreateSprintModalProps {
  isOpen: boolean;
  projectId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateSprintModal: React.FC<CreateSprintModalProps> = ({ isOpen, projectId, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    nom_s: '',
    date_debut_s: '',
    date_fin_s: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;

    setIsSubmitting(true);
    setError('');

    try {
      await sprintService.create({
        ...formData,
        id_projet: parseInt(projectId),
        date_debut_s: new Date(formData.date_debut_s).toISOString(),
        date_fin_s: new Date(formData.date_fin_s).toISOString(),
      });
      onSuccess();
      onClose();
      setFormData({ nom_s: '', date_debut_s: '', date_fin_s: '' });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la création du sprint');
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
              <h2>Nouveau Sprint</h2>
              <button onClick={onClose} className="close-btn"><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Nom du sprint</label>
                <div className="input-wrapper">
                  <Type className="input-icon" size={18} />
                  <input 
                    type="text" 
                    name="nom_s" 
                    placeholder="Ex: Sprint 1 - Core Features" 
                    value={formData.nom_s}
                    onChange={handleChange}
                    required 
                  />
                </div>
              </div>

              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Date de début</label>
                  <div className="input-wrapper">
                    <Calendar className="input-icon" size={18} />
                    <input 
                      type="date" 
                      name="date_debut_s" 
                      value={formData.date_debut_s}
                      onChange={handleChange}
                      required 
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Date de fin</label>
                  <div className="input-wrapper">
                    <Calendar className="input-icon" size={18} />
                    <input 
                      type="date" 
                      name="date_fin_s" 
                      value={formData.date_fin_s}
                      onChange={handleChange}
                      required 
                    />
                  </div>
                </div>
              </div>

              {error && <p className="form-error">{error}</p>}

              <div className="modal-footer">
                <button type="button" onClick={onClose} className="secondary-btn">Annuler</button>
                <button type="submit" className="primary-btn" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Créer le sprint'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CreateSprintModal;
