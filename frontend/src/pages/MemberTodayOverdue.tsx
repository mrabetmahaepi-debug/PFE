import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import MemberTodayRecentActivity from '../components/MemberTodayRecentActivity';
import MemberTasksPageCardHeader from '../components/MemberTasksPageCardHeader';
import type { Tache } from '../types/task';
import {
  TODAY_WORK_GROUPS,
  filterTodayPageTab,
  groupMemberTodayTasks,
  type TodayWorkGroupKey,
} from '../lib/memberTasksViews';
import { memberStatusPillClass, todayGroupKeyToPillTone } from '../lib/memberStatusPill';
import '../styles/memberStatusPill.css';
import './MemberTodayOverdue.css';

type WorkTab = 'todo' | 'done' | 'delegated';

interface MemberTodayOverdueProps {
  tasks: Tache[];
  loading: boolean;
  userId?: number;
  /** Deep-link: auto-expand this group only (e.g. En retard from dashboard). */
  expandGroup?: TodayWorkGroupKey | null;
}

type TodayTabTone = 'gray' | 'purple' | 'green';

const TABS: { id: WorkTab; label: string; tone: TodayTabTone }[] = [
  { id: 'todo', label: 'À faire', tone: 'gray' },
  { id: 'done', label: 'Terminé', tone: 'green' },
  { id: 'delegated', label: 'Délégué', tone: 'purple' },
];

const MemberTodayOverdue: React.FC<MemberTodayOverdueProps> = ({
  tasks,
  loading,
  userId,
  expandGroup = null,
}) => {
  const [activeTab, setActiveTab] = useState<WorkTab>('todo');

  const [expanded, setExpanded] = useState<Set<TodayWorkGroupKey>>(() => {
    const init = new Set<TodayWorkGroupKey>();
    for (const g of TODAY_WORK_GROUPS) {
      init.add(expandGroup ? g.key === expandGroup : true);
    }
    return init;
  });

  useEffect(() => {
    if (!expandGroup) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(expandGroup);
      return next;
    });
  }, [expandGroup]);

  const tabTasks = useMemo(
    () => filterTodayPageTab(tasks, activeTab, userId),
    [tasks, activeTab, userId]
  );

  const grouped = useMemo(
    () => groupMemberTodayTasks(tabTasks),
    [tabTasks]
  );

  const tabCounts = useMemo(
    () => ({
      todo: filterTodayPageTab(tasks, 'todo', userId).length,
      done: filterTodayPageTab(tasks, 'done', userId).length,
      delegated: filterTodayPageTab(tasks, 'delegated', userId).length,
    }),
    [tasks, userId]
  );

  const toggleGroup = (key: TodayWorkGroupKey) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="member-today-page">
      <div className="member-today-shell-card">
        <MemberTasksPageCardHeader currentLabel="Aujourd'hui et en retard" />
        <div className="member-today-grid">
        <section className="member-today-card member-today-card--work" aria-labelledby="member-work-title">
          <h2 id="member-work-title" className="member-today-card-title">
            Mon travail
          </h2>

          <div className="member-today-tabs" role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-label={`${tab.label}, ${tabCounts[tab.id]} tâche${
                  tabCounts[tab.id] !== 1 ? 's' : ''
                }`}
                className={`member-today-tab member-today-tab--${tab.tone} ${
                  activeTab === tab.id ? 'is-active' : ''
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="member-today-tab-label">{tab.label}</span>
                <span className="member-today-tab-count">{tabCounts[tab.id]}</span>
              </button>
            ))}
          </div>

          <div className="member-today-work-body">
            {loading ? (
              <p className="member-today-loading">Chargement…</p>
            ) : (
              <>
                {TODAY_WORK_GROUPS.map((group) => {
                  const open = expanded.has(group.key);
                  const items = grouped.get(group.key) ?? [];
                  const count = items.length;
                  return (
                    <div
                      key={group.key}
                      className={`member-today-group ${open ? 'is-open' : ''}`}
                    >
                      <button
                        type="button"
                        className="member-today-group-header"
                        onClick={() => toggleGroup(group.key)}
                        aria-expanded={open}
                      >
                        <span className="member-today-group-chevron" aria-hidden>
                          {open ? (
                            <ChevronDown size={14} strokeWidth={2} />
                          ) : (
                            <ChevronRight size={14} strokeWidth={2} />
                          )}
                        </span>
                        <span
                          className={memberStatusPillClass(
                            todayGroupKeyToPillTone(group.key)
                          )}
                        >
                          {group.label}
                        </span>
                        <span className="member-today-group-count">{count}</span>
                      </button>
                      {open && count > 0 && (
                        <ul className="member-today-group-tasks" role="list">
                          {items.map((t) => (
                            <li key={t.id_tache} className="member-today-task-item">
                              {t.nom_t}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}

                {activeTab === 'todo' && (
                  <p className="member-today-helper">
                    Les tâches et rappels qui vous sont assignés s&apos;afficheront ici.
                  </p>
                )}
              </>
            )}
          </div>
        </section>

        <section
          className="member-today-card member-today-card--activity"
          aria-labelledby="member-activity-title"
        >
          <h2 id="member-activity-title" className="member-today-card-title">
            Activité récente
          </h2>
          <MemberTodayRecentActivity />
        </section>
        </div>
      </div>
    </div>
  );
};

export default MemberTodayOverdue;
