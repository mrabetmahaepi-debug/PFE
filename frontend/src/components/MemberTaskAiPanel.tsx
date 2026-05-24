import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ClipboardList,
  FileText,
  ListTree,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import {
  aiService,
  type MemberTaskAssistantAction,
  type TaskAssistantResponse,
} from '../services/ai.service';
import './TaskAiPanel.css';

const MEMBER_ACTIONS: {
  action: MemberTaskAssistantAction;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    action: 'generate_description',
    label: 'Générer une description',
    icon: <FileText size={15} aria-hidden />,
  },
  {
    action: 'generate_subtasks',
    label: 'Générer des sous-tâches',
    icon: <ListTree size={15} aria-hidden />,
  },
  {
    action: 'summarize_task',
    label: 'Résumer la tâche',
    icon: <ClipboardList size={15} aria-hidden />,
  },
  {
    action: 'suggest_next_steps',
    label: 'Proposer les prochaines étapes',
    icon: <Sparkles size={15} aria-hidden />,
  },
];

export interface MemberTaskAiPanelProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: number;
  onApplyDescription?: (text: string) => void;
  onApplySubtasks?: (items: string[]) => void;
}

const MemberTaskAiPanel: React.FC<MemberTaskAiPanelProps> = ({
  isOpen,
  onClose,
  taskId,
  onApplyDescription,
  onApplySubtasks,
}) => {
  const [mode, setMode] = useState<'live' | 'simulated'>('simulated');
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] =
    useState<MemberTaskAssistantAction | null>(null);
  const [result, setResult] = useState<TaskAssistantResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setResult(null);
    setError('');
    setActiveAction(null);
    void aiService
      .getStatus()
      .then((s) => setMode(s.configured ? 'live' : 'simulated'))
      .catch(() => setMode('simulated'));
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
    async (action: MemberTaskAssistantAction) => {
      setActiveAction(action);
      setLoading(true);
      setError('');
      setResult(null);
      try {
        const data = await aiService.taskAssistant({ taskId, action });
        setResult(data);
        if (data.simulated || !data.configured) {
          setMode('simulated');
        } else {
          setMode('live');
        }
      } catch (err: unknown) {
        const ax = err as {
          response?: { data?: { message?: string } };
          message?: string;
        };
        setError(
          ax?.response?.data?.message ||
            ax?.message ||
            'Erreur lors de la requête IA'
        );
      } finally {
        setLoading(false);
      }
    },
    [taskId]
  );

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
            aria-labelledby="member-task-ai-panel-title"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="cu-task-ai-panel-header">
              <h2 id="member-task-ai-panel-title" className="cu-task-ai-panel-title">
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
                {mode === 'live'
                  ? 'Enrichissez votre tâche avec l’assistant IA.'
                  : 'Mode local : suggestions générées à partir des données de la tâche.'}
              </p>

              {error ? (
                <div className="cu-task-ai-alert cu-task-ai-alert--error">
                  {error}
                </div>
              ) : null}

              <div className="cu-task-ai-actions">
                {MEMBER_ACTIONS.map(({ action, label, icon }) => (
                  <button
                    key={action}
                    type="button"
                    className={`cu-task-ai-action-btn ${
                      activeAction === action ? 'is-active' : ''
                    }`}
                    disabled={loading}
                    onClick={() => void runAction(action)}
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="cu-task-ai-loading">
                  <Loader2 size={16} className="animate-spin" aria-hidden />
                  Génération en cours…
                </div>
              ) : null}

              {!loading && result ? (
                <div className="cu-task-ai-result">
                  {result.action === 'generate_description' && result.description ? (
                    <>
                      <span className="cu-task-ai-result-label">Description</span>
                      <p className="cu-task-ai-result-text">{result.description}</p>
                      {onApplyDescription ? (
                        <div className="cu-task-ai-result-footer">
                          <button
                            type="button"
                            className="cu-task-ai-apply-btn"
                            onClick={() => {
                              onApplyDescription(result.description!);
                              onClose();
                            }}
                          >
                            Insérer dans la description
                          </button>
                        </div>
                      ) : null}
                    </>
                  ) : null}

                  {result.action === 'generate_subtasks' &&
                  (result.subtasks?.length ?? 0) > 0 ? (
                    <>
                      <span className="cu-task-ai-result-label">Sous-tâches</span>
                      <ul className="cu-task-ai-result-list">
                        {result.subtasks!.map((s, i) => (
                          <li key={`${i}-${s}`}>{s}</li>
                        ))}
                      </ul>
                      {onApplySubtasks ? (
                        <div className="cu-task-ai-result-footer">
                          <button
                            type="button"
                            className="cu-task-ai-apply-btn"
                            onClick={() => {
                              onApplySubtasks(result.subtasks!);
                              onClose();
                            }}
                          >
                            Ajouter comme sous-tâches
                          </button>
                        </div>
                      ) : null}
                    </>
                  ) : null}

                  {result.action === 'summarize_task' && result.summary ? (
                    <>
                      <span className="cu-task-ai-result-label">Résumé</span>
                      <p className="cu-task-ai-result-text">{result.summary}</p>
                    </>
                  ) : null}

                  {result.action === 'suggest_next_steps' &&
                  (result.steps?.length ?? 0) > 0 ? (
                    <>
                      <span className="cu-task-ai-result-label">
                        Prochaines étapes
                      </span>
                      <ul className="cu-task-ai-result-list">
                        {result.steps!.map((s, i) => (
                          <li key={`${i}-${s}`}>{s}</li>
                        ))}
                      </ul>
                    </>
                  ) : null}

                  {result.simulated ? (
                    <p className="cu-task-ai-provider">Mode local (sans API)</p>
                  ) : result.provider && result.provider !== 'simulated' ? (
                    <p className="cu-task-ai-provider">
                      Via {result.provider === 'openai' ? 'OpenAI' : 'Groq'}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(panel, document.body);
};

export default MemberTaskAiPanel;
