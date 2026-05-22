import api from './api';

export interface InvitationLookup {
  email: string;
  prenom?: string | null;
  nom?: string | null;
  role: string | null;
  entreprise: string | null;
  expires_at: string | null;
  inviter?: { name: string; email: string | null } | null;
}

export interface AcceptInvitationPayload {
  password: string;
  confirmPassword: string;
  prenom: string;
  nom: string;
}

export interface AcceptInvitationResponse {
  message: string;
  token?: string;
  user: {
    id: number;
    email: string;
    nom: string;
    prenom: string;
    role: string | null;
    id_role?: number;
    id_entreprise?: number | null;
  };
}

/**
 * Returned by the backend when no email provider (Brevo, SMTP) is
 * configured. The UI uses this to surface a precise setup banner instead
 * of a generic "could not send" message — we never fall back to a
 * "copy invitation link" UX.
 */
export interface InvitationSmtpSetupError {
  code: 'EMAIL_NOT_CONFIGURED' | 'SMTP_NOT_CONFIGURED';
  message: string;
  hint?: {
    recommended_provider?: 'brevo' | 'smtp';
    required_env?: string[];
    example_brevo?: Record<string, string | number | boolean>;
    alternative_smtp?: Record<string, string | number | boolean>;
    /** Legacy field, still tolerated for older backends. */
    example_gmail?: Record<string, string | number | boolean>;
  };
}

export interface AssignableRole {
  id_role: number;
  nom: string;
  description: string | null;
  id_entreprise: number | null;
}

export interface TeamInvitationPayload {
  emails: string[];
  /** @deprecated ignoré par le backend — toujours « Membre » */
  id_role?: number;
  prenom?: string;
  nom?: string;
}

export type TeamInvitationDelivery = 'sent' | 'skipped' | 'failed';

export type TeamInvitationResult =
  | {
      email: string;
      status: 'sent';
      token: string;
      link: string;
      expires_at: string | null;
      id_utilisateur: number;
      email_delivery: TeamInvitationDelivery;
      /** Returned when delivery failed — Brevo/SMTP error text. */
      delivery_error?: string;
    }
  | {
      email: string;
      status: 'skipped' | 'error';
      reason: string;
    };

export interface TeamInvitationResponse {
  message: string;
  role: { id_role: number; nom: string };
  workspace: string;
  inviter: string;
  email_configured: boolean;
  summary?: {
    total: number;
    invitation_created: number;
    skipped: number;
    failed: number;
    email_delivered: number;
    email_failed: number;
    email_skipped: number;
  };
  results: TeamInvitationResult[];
}

export const invitationService = {
  async lookupByToken(token: string): Promise<InvitationLookup> {
    const response = await api.get<InvitationLookup>(`/invitations/by-token/${encodeURIComponent(token)}`);
    return response.data;
  },

  async acceptByToken(
    token: string,
    payload: AcceptInvitationPayload,
  ): Promise<AcceptInvitationResponse> {
    const response = await api.post<AcceptInvitationResponse>(
      `/invitations/accept-by-token/${encodeURIComponent(token)}`,
      payload,
    );
    return response.data;
  },

  /**
   * Tenant-scoped multi-email invitation. The backend forces the user's
   * `id_entreprise`, validates the role belongs to the tenant, and returns
   * a per-email status (sent / skipped / error) so the UI can render
   * partial successes nicely.
   * Requires `TEAM_INVITE` or `TEAM_MANAGE_ROLES` on the backend.
   */
  async sendTeamInvitations(
    payload: TeamInvitationPayload,
  ): Promise<TeamInvitationResponse> {
    const response = await api.post<TeamInvitationResponse>(
      '/invitations/team',
      payload,
      { timeout: 90_000 },
    );
    return response.data;
  },

  /**
   * Lightweight, tenant-scoped role list for assignment flows
   * (invitations, member creation). Available to anyone with TEAM_INVITE
   * or TEAM_MANAGE_ROLES.
   */
  async listAssignableRoles(): Promise<AssignableRole[]> {
    const response = await api.get<AssignableRole[]>('/roles/assignable');
    return response.data;
  },
};
