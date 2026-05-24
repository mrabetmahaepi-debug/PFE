/** UI placeholder rows when no assigned tasks exist (Member « Assigné à moi » only). */
export type MemberAssignedDemoRow = {
  id: string;
  nom: string;
  prioriteLabel: string;
  dueLabel: string;
  isDemo: true;
};

export const MEMBER_ASSIGNED_DEMO_ROWS: MemberAssignedDemoRow[] = [
  {
    id: 'demo-1',
    nom: '🧠 Work Smarter with ClickUp AI',
    prioriteLabel: 'Élevée',
    dueLabel: '5/14/26',
    isDemo: true,
  },
  {
    id: 'demo-2',
    nom: '🔗 Integrate Your Favorite Tools in ClickUp',
    prioriteLabel: 'Élevée',
    dueLabel: '5/13/26',
    isDemo: true,
  },
  {
    id: 'demo-3',
    nom: '📥 Import Your Work into ClickUp',
    prioriteLabel: 'Élevée',
    dueLabel: '5/12/26',
    isDemo: true,
  },
  {
    id: 'demo-4',
    nom: '🤝 Bring Your Team Onboard in Minutes',
    prioriteLabel: 'Élevée',
    dueLabel: '5/12/26',
    isDemo: true,
  },
  {
    id: 'demo-5',
    nom: '🎨 Design a Workflow That Works for You',
    prioriteLabel: 'Élevée',
    dueLabel: '5/11/26',
    isDemo: true,
  },
  {
    id: 'demo-6',
    nom: '🚀 Set up Your Tasks in Just 5 Minutes',
    prioriteLabel: 'Élevée',
    dueLabel: '5/10/26',
    isDemo: true,
  },
];
