import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Type, AlignLeft, Flag, Layers, Calendar, Loader2 } from 'lucide-react';
import { taskService } from '../services/task.service';
import { sprintService } from '../services/sprint.service';
import { TaskPriority, TaskStatus } from '../types/task';
import type { Sprint } from '../types/sprint';
import './CreateTaskModal.css';

interface CreateTaskModalProps {
  isOpen: boolean;
  projectId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ isOpen, projectId, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    nom_t: '',
    description_t: '',
    priorite_t: TaskPriority.MEDIUM,
    date_limite_t: '',
    id_sprint: ''
  });
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && projectId) {
      fetchSprints();
    }
  }, [isOpen, projectId]);

  const fetchSprints = async () => {
    try {
      const data = await sprintService.getByProject(projectId);
      setSprints(data);
    } catch (error) {
      console.error("Failed to fetch sprints:", error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) {
      setError('Veuillez sélectionner un projet d\'abord');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await taskService.create({
        ...formData,
        id_projet: parseInt(projectId),
        id_sprint: formData.id_sprint ? parseInt(formData.id_sprint) : undefined,
        statut_t: TaskStatus.TODO,
        date_limite_t: formData.date_limite_t ? new Date(formData.date_limite_t).toISOString() : undefined
      } as any);
      onSuccess();
      onClose();
      setFormData({ nom_t: '', description_t: '', priorite_t: TaskPriority.MEDIUM, date_limite_t: '', id_sprint: '' });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la création de la tâche');
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
              <h2>Nouvelle Tâche</h2>
              <button onClick={onClose} className="close-btn"><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Titre de la tâche</label>
                <div className="input-wrapper">
                  <Type className="input-icon" size={18} />
                  <input 
                    type="text" 
                    name="nom_t" 
                    placeholder="Ex: Designer le logo" 
                    value={formData.nom_t}
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
                    name="description_t" 
                    placeholder="Détails de la tâche..." 
                    value={formData.description_t}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Priorité</label>
                  <div className="input-wrapper">
                    <Flag className="input-icon" size={18} />
                    <select name="priorite_t" value={formData.priorite_t} onChange={handleChange}>
                      <option value={TaskPriority.LOW}>Basse</option>
                      <option value={TaskPriority.MEDIUM}>Moyenne</option>
                      <option value={TaskPriority.HIGH}>Haute</option>
                      <option value={TaskPriority.CRITICAL}>Critique</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Échéance</label>
                  <div className="input-wrapper">
                    <Calendar className="input-icon" size={18} />
                    <input 
                      type="date" 
                      name="date_limite_t" 
                      value={formData.date_limite_t}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Sprint (Optionnel)</label>
                <div className="input-wrapper">
                  <Layers className="input-icon" size={18} />
                  <select name="id_sprint" value={formData.id_sprint} onChange={handleChange}>
                    <option value="">Aucun sprint</option>
                    {sprints.map(s => (
                      <option key={s.id_sprint} value={s.id_sprint}>{s.nom_s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {error && <p className="form-error">{error}</p>}

              <div className="modal-footer">
                <button type="button" onClick={onClose} className="secondary-btn">Annuler</button>
                <button type="submit" className="primary-btn" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Créer la tâche'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CreateTaskModal;
