import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Sparkles } from 'lucide-react';
import AdminAppliedScenarioPanel from './AdminAppliedScenarioPanel';
import {
  priorityLabel,
  recommendationExplanation,
  type AdminRecommendation,
} from '../lib/adminRecommendations';
import type { AdminAppliedScenario } from '../lib/adminRecommendationScenario';
import { formatAppliedScenarioDate } from '../lib/adminRecommendationScenario';
import { formatActivityTimestamp } from '../lib/formatActivityTimestamp';
import './AdminRecommendationCard.css';

type AdminRecommendationCardProps = {
  recommendation: AdminRecommendation;
  index?: number;
  providerBadge?: string;
  variant?: 'active' | 'applied';
  appliedAt?: string;
  resultSummary?: string | null;
  scenario?: AdminAppliedScenario | null;
  onApply?: (recommendation: AdminRecommendation) => void;
  onDismiss?: (recommendation: AdminRecommendation) => void;
};

const AdminRecommendationCard: React.FC<AdminRecommendationCardProps> = ({
  recommendation,
  index = 0,
  providerBadge,
  variant = 'active',
  appliedAt,
  resultSummary,
  scenario,
  onApply,
  onDismiss,
}) => {
  const explanation = recommendationExplanation(recommendation);
  const isApplied = variant === 'applied';
  const displayDate = appliedAt ?? recommendation.date;
  const appliedScenario = isApplied ? scenario : null;

  return (
    <motion.article
      className={`admin-rec-card${isApplied ? ' admin-rec-card--applied' : ''}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.22 }}
    >
      <motion.div
        className="admin-rec-card-icon"
        aria-hidden
        whileHover={isApplied ? undefined : { scale: 1.05, rotate: 4 }}
        transition={{ type: 'spring', stiffness: 400, damping: 18 }}
      >
        {isApplied ? (
          <CheckCircle2 size={18} strokeWidth={2} />
        ) : (
          <Sparkles size={18} strokeWidth={2} />
        )}
      </motion.div>
      <motion.div
        className="admin-rec-card-body"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: index * 0.05 + 0.06, duration: 0.2 }}
      >
        <header className="admin-rec-card-head">
          <motion.div className="admin-rec-card-head-main">
            <h3>{recommendation.title}</h3>
            <motion.div
              className="admin-rec-card-badges"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.05 + 0.08, duration: 0.18 }}
            >
              {providerBadge ? (
                <span className="admin-rec-provider-badge">{providerBadge}</span>
              ) : null}
              {isApplied ? (
                <span className="admin-rec-status-badge admin-rec-status-badge--applied">
                  Appliquée
                </span>
              ) : (
                <span className={`admin-rec-priority admin-rec-priority--${recommendation.priority}`}>
                  {priorityLabel(recommendation.priority)}
                </span>
              )}
            </motion.div>
          </motion.div>
        </header>
        {!isApplied && explanation ? (
          <p className="admin-rec-card-desc">{explanation}</p>
        ) : null}
        {isApplied && resultSummary ? (
          <p className="admin-rec-card-result">{resultSummary}</p>
        ) : null}
        {!isApplied ? (
          <p className="admin-rec-card-action">
            <span className="admin-rec-card-action-label">Action suggérée</span>
            {recommendation.suggestedAction}
          </p>
        ) : null}
        {isApplied && appliedScenario ? (
          <AdminAppliedScenarioPanel scenario={appliedScenario} />
        ) : null}
        <footer className="admin-rec-card-foot">
          <time className="admin-rec-card-date" dateTime={displayDate}>
            {isApplied
              ? `Appliquée ${formatAppliedScenarioDate(displayDate)}`
              : formatActivityTimestamp(displayDate)}
          </time>
          {!isApplied && onApply && onDismiss ? (
            <motion.div
              className="admin-rec-card-actions"
              whileHover={{ scale: 1.01 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              <button
                type="button"
                className="admin-rec-btn admin-rec-btn--ghost"
                onClick={() => onDismiss(recommendation)}
              >
                Ignorer
              </button>
              <button
                type="button"
                className="admin-rec-btn admin-rec-btn--apply"
                onClick={() => onApply(recommendation)}
              >
                Appliquer
              </button>
            </motion.div>
          ) : null}
        </footer>
      </motion.div>
    </motion.article>
  );
};

export default AdminRecommendationCard;
