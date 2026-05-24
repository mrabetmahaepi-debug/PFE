import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import {
  formatAppliedScenarioDate,
  type AdminAppliedScenario,
} from '../lib/adminRecommendationScenario';
import './AdminAppliedScenarioPanel.css';

type AdminAppliedScenarioPanelProps = {
  scenario: AdminAppliedScenario;
};

type ScenarioSectionProps = {
  title: string;
  tone: 'before' | 'explain' | 'action' | 'modify' | 'result' | 'time';
  items?: string[];
  text?: string;
};

const ScenarioSection: React.FC<ScenarioSectionProps> = ({ title, tone, items, text }) => {
  const hasItems = Boolean(items?.length);
  const hasText = Boolean(text?.trim());

  if (!hasItems && !hasText) return null;

  return (
    <div className={`admin-rec-scenario-step admin-rec-scenario-step--${tone}`}>
      <motion.div
        className="admin-rec-scenario-step-marker"
        aria-hidden
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.18 }}
      />
      <motion.div
        className="admin-rec-scenario-step-body"
        initial={{ opacity: 0, x: -4 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
      >
        <h4 className="admin-rec-scenario-step-title">{title}</h4>
        {hasText ? <p className="admin-rec-scenario-step-text">{text}</p> : null}
        {hasItems ? (
          <ul className="admin-rec-scenario-step-list">
            {items!.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
      </motion.div>
    </div>
  );
};

const AdminAppliedScenarioPanel: React.FC<AdminAppliedScenarioPanelProps> = ({ scenario }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      className="admin-rec-scenario"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <button
        type="button"
        className={`admin-rec-scenario-toggle${expanded ? ' admin-rec-scenario-toggle--open' : ''}`}
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        Voir le scénario complet
        <ChevronDown size={14} aria-hidden className="admin-rec-scenario-toggle-icon" />
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            className="admin-rec-scenario-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <div className="admin-rec-scenario-timeline">
              <ScenarioSection title="Avant l'application" tone="before" items={scenario.before} />
              <ScenarioSection
                title="Explication IA"
                tone="explain"
                text={scenario.explanation}
              />
              <ScenarioSection
                title="Action appliquée"
                tone="action"
                items={scenario.actionDetails}
              />
              <ScenarioSection
                title="Modifications effectuées"
                tone="modify"
                items={scenario.modifications}
              />
              <ScenarioSection title="Résultat" tone="result" items={scenario.results} />
              <ScenarioSection
                title="Appliquée le"
                tone="time"
                text={formatAppliedScenarioDate(scenario.appliedAt)}
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
};

export default AdminAppliedScenarioPanel;
