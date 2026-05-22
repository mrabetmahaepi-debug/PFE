import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FileText,
  ListTree,
  Loader2,
  Sparkles,
  Target,
  Wand2,
  X,
} from 'lucide-react';
import {
  aiService,
  AI_NOT_CONFIGURED_MSG,
  type TaskAssistantAction,
  type TaskAssistantResponse,
} from '../services/ai.service';
import './TaskAiPanel.css';

const ACTIONS: {
  action: TaskAssistantAction;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    action: 'generate_description',
    label: 'Générer la description',
    icon: <FileText size={15} aria-hidden />,
  },
  {
    action: 'generate_subtasks',
    label: 'Générer des sous-tâches',
    icon: <ListTree size={15} aria-hidden />,
  },
  {
    action: 'similar_tasks',
    label: 'Tâches similaires',
    icon: <Target size={15} aria-hidden />,
  },
  {
    action: 'improve_title',
    label: 'Améliorer le titre',
    icon: <Wand2 size={15} aria-hidden />,
  },
];

export interface TaskAiPanelProps {
  isOpen: boolean;
  onClose: () => void;
  taskTitle: string;
  taskDescription: string;
  onApplyDescription?: (text: string) => void;
  onApplyTitle?: (text: string) => void;
}

const TaskAiPanel: React.FC<TaskAiPanelProps> = ({
  isOpen,
  onClose,
  taskTitle,
  taskDescription,
  onApplyDescription,
  onApplyTitle,
}) => {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<TaskAssistantAction | null>(null);
  const [result, setResult] = useState<TaskAssistantResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setResult(null);
    setError('');
    setActiveAction(null);
    void aiService
      .getStatus()
      .then((s) => setConfigured(s.configured))
      .catch(() => setConfigured(false));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const runAction = useCallback(
    async (action: TaskAssistantAction) => {
      setActiveAction(action);
      setLoading(true);
      setError('');
      setResult(null);
      try {
        const data = await aiService.taskAssistant({
          taskTitle: taskTitle.trim() || 'Sans titre',
          taskDescription: taskDescription.trim(),
          action,
        });
        setResult(data);
      } catch (err: unknown) {
        const ax = err as {
          response?: { data?: { message?: string; code?: string } };
          message?: string;
        };
        const msg =
          ax?.response?.data?.message ||
          ax?.message ||
          'Erreur lors de la requête IA';
        setError(msg);
        if (ax?.response?.data?.code === 'AI_NOT_CONFIGURED') {
          setConfigured(false);
        }
      } finally {
        setLoading(false);
      }
    },
    [taskTitle, taskDescription]
  );

  const showNotConfigured =
    configured === false ||
    error === AI_NOT_CONFIGURED_MSG ||
    result?.code === 'AI_NOT_CONFIGURED';

  const panel = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="cu-task-ai-panel-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            className="cu-task-ai-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-ai-panel-title"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="cu-task-ai-panel-header">
              <h2 id="task-ai-panel-title" className="cu-task-ai-panel-title">
                <Sparkles size={18} aria-hidden />
                Assistant IA
              </h2>
              <button
                type="button"
                className="cu-task-ai-panel-close"
                onClick={onClose}
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="cu-task-ai-panel-body">
              <p className="cu-task-ai-panel-hint">
                Choisissez une action pour enrichir votre tâche (Groq IA).
              </p>

              {configured === false && (
                <div className="cu-task-ai-alert cu-task-ai-alert--warn">
                  {AI_NOT_CONFIGURED_MSG}
                </div>
              )}

              {error && configured !== false && (
                <div className="cu-task-ai-alert cu-task-ai-alert--error">
                  {error}
                </div>
              )}

              <div className="cu-task-ai-actions">
                {ACTIONS.map(({ action, label, icon }) => (
                  <button
                    key={action}
                    type="button"
                    className={`cu-task-ai-action-btn ${
                      activeAction === action ? 'is-active' : ''
                    }`}
                    disabled={loading || configured === false}
                    onClick={() => void runAction(action)}
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </div>

              {loading && (
                <div className="cu-task-ai-loading">
                  <Loader2 size={16} className="animate-spin" aria-hidden />
                  Génération en cours…
                </div>
              )}

              {!loading && result && (
                <div className="cu-task-ai-result">
                  {result.action === 'generate_description' && result.description && (
                    <>
                      <span className="cu-task-ai-result-label">Description</span>
                      <p className="cu-task-ai-result-text">{result.description}</p>
                      {onApplyDescription && (
                        <div className="cu-task-ai-result-footer">
                          <button
                            type="button"
                            className="cu-task-ai-apply-btn"
                            onClick={() => {
                              onApplyDescription(result.description!);
                              onClose();
                            }}
                          >
                            Appliquer
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {result.action === 'improve_title' && result.title && (
                    <>
                      <span className="cu-task-ai-result-label">Titre suggéré</span>
                      <p className="cu-task-ai-result-text">{result.title}</p>
                      {onApplyTitle && (
                        <div className="cu-task-ai-result-footer">
                          <button
                            type="button"
                            className="cu-task-ai-apply-btn"
                            onClick={() => {
                              onApplyTitle(result.title!);
                              onClose();
                            }}
                          >
                            Appliquer
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {result.action === 'generate_subtasks' &&
                    (result.subtasks?.length ?? 0) > 0 && (
                      <>
                        <span className="cu-task-ai-result-label">Sous-tâches</span>
                        <ul className="cu-task-ai-result-list">
                          {result.subtasks!.map((s, i) => (
                            <li key={`${i}-${s}`}>{s}</li>
                          ))}
                        </ul>
                      </>
                    )}

                  {result.action === 'similar_tasks' &&
                    (result.suggestions?.length ?? 0) > 0 && (
                      <>
                        <span className="cu-task-ai-result-label">
                          Tâches similaires
                        </span>
                        <ul className="cu-task-ai-result-list">
                          {result.suggestions!.map((s, i) => (
                            <li key={`${i}-${s}`}>{s}</li>
                          ))}
                        </ul>
                      </>
                    )}

                  {result.provider && (
                    <p className="cu-task-ai-provider">Via Groq</p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(panel, document.body);
};

export default TaskAiPanel;
