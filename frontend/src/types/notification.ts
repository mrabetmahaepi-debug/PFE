export interface AppNotification {
  num_notification: number;
  sujet: string | null;
  message: string | null;
  type: string | null;
  is_read: boolean;
  date_envoi: string | null;
  id_utilisateur: number | null;
  metadata?: string | null;
}

export type NotificationUiKind =
  | 'workspace'
  | 'invite'
  | 'welcome'
  | 'project'
  | 'task_assigned'
  | 'task_done'
  | 'sprint'
  | 'invite_accepted'
  | 'role'
  | 'deadline'
  | 'risk'
  | 'default';
