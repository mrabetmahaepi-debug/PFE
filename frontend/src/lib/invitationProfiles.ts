/** Profils proposés lors d'une invitation équipe (admin). */
export const INVITATION_PROFILE_OPTIONS = [
  'Chef de projet',
  'Développeur',
] as const;

export type InvitationProfileOption = (typeof INVITATION_PROFILE_OPTIONS)[number];
