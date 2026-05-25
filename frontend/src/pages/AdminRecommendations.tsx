import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, RefreshCw, Sparkles, Wand2 } from 'lucide-react';
import AdminRecommendationApplyModal from '../components/AdminRecommendationApplyModal';
import AdminRecommendationCard from '../components/AdminRecommendationCard';
import EditProjectTeamModal from '../components/EditProjectTeamModal';
import {
  resolveApplyProjectPath,
  type AdminApplyContext,
} from '../lib/adminRecommendationApply';
import {
  buildApplyScenario,
  parseStoredScenario,
} from '../lib/adminRecommendationScenario';
import {
  filterVisibleRecommendations,
  providerBadgeLabel,
  providerLabel,
  type AdminAppliedRecommendation,
  type AdminRecommendation,
  type AdminRecommendationTab,
} from '../lib/adminRecommendations';
import { adminRecommendationsService } from '../services/adminRecommendations.service';
import { AI_NOT_CONFIGURED_MSG } from '../services/ai.service';
import { projectService } from '../services/project.service';
import type { Projet } from '../types/project';
import './AdminRecommendations.css';

const SUCCESS_TOAST = 'Recommandation appliquée avec succès.';

function mapAppliedRecommendation(item: AdminAppliedRecommendation): AdminAppliedRecommendation {
  const rawMeta =
    item.scenario && typeof item.scenario === 'object'
      ? { scenario: item.scenario as Record<string, unknown> }
      : null;
  return {
    ...item,
    scenario: parseStoredScenario(item, rawMeta),
  };
}

function toAppliedCardRecommendation(
  item: AdminAppliedRecommendation
): AdminRecommendation {
  return {
    id: item.id,
    title: item.title,
    explanation: item.resultSummary ?? '',
    priority: 'faible',
    suggestedAction: '',
    actionPath: '/projects',
    actionType: (item.actionType as AdminRecommendation['actionType']) ?? 'open_portfolio',
    date: item.appliedAt,
  };
}

const AdminRecommendations: React.FC = () => {
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState<AdminRecommendation[]>([]);
  const [appliedRecommendations, setAppliedRecommendations] = useState<
    AdminAppliedRecommendation[]
  >([]);
  const [activeTab, setActiveTab] = useState<AdminRecommendationTab>('active');
  const [provider, setProvider] = useState<'groq' | 'openai' | 'data-driven' | null>(
    'data-driven'
  );
  const [aiConfigured, setAiConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archivedIds, setArchivedIds] = useState<Set<string>>(() => new Set());
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [applyTarget, setApplyTarget] = useState<AdminRecommendation | null>(null);
  const [applyContext, setApplyContext] = useState<AdminApplyContext | null>(null);
  const [applyLoading, setApplyLoading] = useState(false);
  const [teamModalProject, setTeamModalProject] = useState<Projet | null>(null);

  const providerBadge = providerBadgeLabel(provider, aiConfigured);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const result = await adminRecommendationsService.getRecommendations();
      setRecommendations(result.recommendations ?? []);
      setAppliedRecommendations(
        (result.appliedRecommendations ?? []).map((item) => mapAppliedRecommendation(item))
      );
      setProvider(result.provider ?? 'data-driven');
      setAiConfigured(result.configured);
      if (result.success === false && result.message) {
        setError(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de charger les recommandations.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!successMessage) return;
    const timer = window.setTimeout(() => setSuccessMessage(null), 5000);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

  const visibleRecommendations = useMemo(
    () => filterVisibleRecommendations(recommendations, archivedIds),
    [recommendations, archivedIds]
  );

  const archiveRecommendation = useCallback((id: string) => {
    setArchivedIds((prev) => new Set(prev).add(id));
    setRecommendations((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const recordState = useCallback(
    async (
      recommendation: AdminRecommendation,
      status: 'applied' | 'dismissed',
      resultSummary?: string,
      metadata?: Record<string, unknown>
    ) => {
      await adminRecommendationsService.recordState({
        recommendationId: recommendation.id,
        status,
        actionType: recommendation.actionType,
        title: recommendation.title,
        resultSummary,
        projectId: recommendation.projectId ?? null,
        metadata: {
          ...metadata,
          provider,
          explanation: recommendation.explanation,
          suggestedAction: recommendation.suggestedAction,
        },
      });
      archiveRecommendation(recommendation.id);
    },
    [archiveRecommendation, provider]
  );

  const handleDismiss = useCallback(
    async (recommendation: AdminRecommendation) => {
      try {
        await recordState(recommendation, 'dismissed', 'Recommandation ignorée');
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossible d'ignorer la recommandation.");
      }
    },
    [recordState]
  );

  const finalizeApply = useCallback(
    async (
      recommendation: AdminRecommendation,
      summary: string,
      metadata?: Record<string, unknown>
    ) => {
      const appliedAt = new Date().toISOString();
      const scenario = buildApplyScenario(
        recommendation,
        applyContext,
        summary,
        metadata,
        appliedAt
      );
      await recordState(recommendation, 'applied', summary, { ...metadata, scenario });
      setAppliedRecommendations((prev) => {
        const next: AdminAppliedRecommendation = {
          id: recommendation.id,
          title: recommendation.title,
          resultSummary: summary,
          actionType: recommendation.actionType,
          appliedAt,
          status: 'applied',
          provider,
          scenario,
        };
        return [next, ...prev.filter((item) => item.id !== recommendation.id)];
      });
      setApplyTarget(null);
      setApplyContext(null);
      setTeamModalProject(null);
      setSuccessMessage(SUCCESS_TOAST);
      setActiveTab('applied');
    },
    [applyContext, provider, recordState]
  );

  const handleApply = useCallback(async (recommendation: AdminRecommendation) => {
    setApplyTarget(recommendation);
    setApplyContext(null);
    setTeamModalProject(null);
    setApplyLoading(true);
    setError(null);

    try {
      const context = await adminRecommendationsService.getApplyContext(recommendation);

      if (context.actionType === 'add_member' && context.projectId) {
        const project = await projectService.getById(context.projectId);
        setTeamModalProject(project);
        setApplyLoading(false);
        return;
      }

      if (context.actionType === 'open_portfolio') {
        setApplyTarget(null);
        window.location.assign(recommendation.actionPath);
        return;
      }

      setApplyContext(context);
    } catch (err) {
      setApplyTarget(null);
      setError(err instanceof Error ? err.message : "Impossible de préparer l'action.");
    } finally {
      setApplyLoading(false);
    }
  }, []);

  const handleApplyModalApplied = useCallback(
    async (summary: string, metadata?: Record<string, unknown>) => {
      if (!applyTarget) return;
      try {
        await finalizeApply(applyTarget, summary, metadata);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossible d'enregistrer l'action.");
      }
    },
    [applyTarget, finalizeApply]
  );

  const handleTeamModalSuccess = useCallback(async () => {
    if (!applyTarget) return;
    try {
      await finalizeApply(
        applyTarget,
        `Équipe du projet mise à jour (${applyTarget.title}).`,
        { projectId: applyTarget.projectId }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer l'action.");
    }
  }, [applyTarget, finalizeApply]);

  const closeApplyModal = useCallback(() => {
    setApplyTarget(null);
    setApplyContext(null);
  }, []);

  const handleApplyModalViewTeam = useCallback(() => {
    closeApplyModal();
    navigate('/team');
  }, [closeApplyModal, navigate]);

  const handleApplyModalViewProject = useCallback(() => {
    const path = resolveApplyProjectPath(applyTarget, applyContext);
    closeApplyModal();
    navigate(path);
  }, [applyContext, applyTarget, closeApplyModal, navigate]);

  const handleApplyModalRetryAnalysis = useCallback(() => {
    closeApplyModal();
    void loadData(true);
  }, [closeApplyModal, loadData]);

  if (loading) {
    return (
      <motion.div
        className="admin-rec-page admin-rec-page--admin admin-rec-page--loading"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div
          className="admin-rec-loading-icon"
          animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.06, 1] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden
        >
          <Wand2 size={28} strokeWidth={2} />
        </motion.div>
        <p className="admin-rec-loading-title">Analyse IA de votre portefeuille…</p>
        <p className="admin-rec-loading-sub">
          Projets, tâches, échéances et charge d&apos;équipe en cours d&apos;évaluation.
        </p>
      </motion.div>
    );
  }

  const teamChefId =
    teamModalProject?.chef_de_projet_id ??
    (teamModalProject as { chef_id?: number | null } | null)?.chef_id ??
    null;

  const activeCount = visibleRecommendations.length;
  const appliedCount = appliedRecommendations.length;
  const showActiveList = activeTab === 'active' && !error;
  const showAppliedList = activeTab === 'applied' && !error;

  return (
    <>
      <motion.div
        className="admin-rec-page admin-rec-page--admin"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
      >
        {successMessage ? (
          <motion.div
            className="admin-rec-toast"
            role="status"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <CheckCircle2 size={16} aria-hidden />
            {successMessage}
          </motion.div>
        ) : null}

        <motion.div
          className="admin-rec-tabs"
          role="tablist"
          aria-label="Recommandations"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04, duration: 0.2 }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'active'}
            className={`admin-rec-tab${activeTab === 'active' ? ' admin-rec-tab--active' : ''}`}
            onClick={() => setActiveTab('active')}
          >
            Actives
            <span className="admin-rec-tab-count">{activeCount}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'applied'}
            className={`admin-rec-tab${activeTab === 'applied' ? ' admin-rec-tab--active' : ''}`}
            onClick={() => setActiveTab('applied')}
          >
            Appliquées
            <span className="admin-rec-tab-count">{appliedCount}</span>
          </button>
          <div className="admin-rec-tabs-spacer" />
          <button
            type="button"
            className={`admin-rec-refresh${refreshing ? ' is-spinning' : ''}`}
            onClick={() => void loadData(true)}
            aria-label="Actualiser les recommandations"
          >
            <RefreshCw size={16} />
          </button>
        </motion.div>

        <motion.section
          className="admin-rec-insights-banner"
          aria-label="Assistant insights"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.22 }}
        >
          <Sparkles size={16} aria-hidden />
          <span>
            {providerLabel(provider, aiConfigured)}
            {' · '}
            Basé sur vos projets et votre équipe uniquement.
          </span>
        </motion.section>

        {!aiConfigured && !error ? (
          <motion.div className="admin-rec-notice" role="status">
            {AI_NOT_CONFIGURED_MSG}. Les recommandations sont calculées dynamiquement à partir de vos
            données.
          </motion.div>
        ) : null}

        {error ? (
          <motion.div className="admin-rec-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p>{error}</p>
            <button type="button" className="cu-link-btn" onClick={() => void loadData()}>
              Réessayer
            </button>
          </motion.div>
        ) : showActiveList && activeCount > 0 ? (
          <motion.div
            className="admin-rec-list"
            role="tabpanel"
            aria-label="Recommandations actives"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {visibleRecommendations.map((recommendation, index) => (
              <AdminRecommendationCard
                key={recommendation.id}
                recommendation={recommendation}
                index={index}
                providerBadge={providerBadge}
                variant="active"
                onApply={handleApply}
                onDismiss={handleDismiss}
              />
            ))}
          </motion.div>
        ) : showAppliedList && appliedCount > 0 ? (
          <motion.div
            className="admin-rec-list"
            role="tabpanel"
            aria-label="Recommandations appliquées"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {appliedRecommendations.map((item, index) => (
              <AdminRecommendationCard
                key={item.id}
                recommendation={toAppliedCardRecommendation(item)}
                index={index}
                providerBadge={providerBadgeLabel(item.provider ?? provider, aiConfigured)}
                variant="applied"
                appliedAt={item.appliedAt}
                resultSummary={item.resultSummary}
                scenario={item.scenario}
              />
            ))}
          </motion.div>
        ) : (
          <div className="admin-rec-empty" role="tabpanel">
            <motion.div
              className="admin-rec-empty-icon"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              aria-hidden
            >
              <Sparkles size={28} strokeWidth={1.75} />
            </motion.div>
            <p>
              {activeTab === 'applied'
                ? 'Aucune recommandation appliquée'
                : 'Aucune recommandation active'}
            </p>
            <span>
              {activeTab === 'applied'
                ? 'Les recommandations que vous appliquez apparaîtront ici.'
                : 'Votre portefeuille est en bonne voie. Revenez plus tard pour de nouveaux insights.'}
            </span>
          </div>
        )}
      </motion.div>

      <AdminRecommendationApplyModal
        isOpen={Boolean(applyTarget && applyContext && !teamModalProject)}
        recommendation={applyTarget}
        context={applyContext}
        loading={applyLoading}
        onClose={closeApplyModal}
        onApplied={handleApplyModalApplied}
        onViewTeam={handleApplyModalViewTeam}
        onViewProject={handleApplyModalViewProject}
        onRetryAnalysis={handleApplyModalRetryAnalysis}
      />

      {teamModalProject && applyTarget ? (
        <EditProjectTeamModal
          isOpen
          projectId={teamModalProject.id_projet}
          projectNom={teamModalProject.nom_p}
          chefId={teamChefId}
          team={teamModalProject.projectTeam}
          project={teamModalProject}
          onClose={() => {
            setApplyTarget(null);
            setTeamModalProject(null);
          }}
          onSuccess={() => void handleTeamModalSuccess()}
        />
      ) : null}
    </>
  );
};

export default AdminRecommendations;




