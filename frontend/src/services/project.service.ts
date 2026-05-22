import api from './api';
import type { User } from '../types/auth.types';
import type { Projet, CreateProjetData } from '../types/project';
import type { ProjectTree } from '../types/hierarchy';
import { hierarchyService } from './hierarchy.service';
import {
  assertCanManageProjectTeamFromSession,
  assertCanMutateProjectFromSession,
  type ProjectManageContext,
} from '../lib/projectManageAccess';

/** Corps JSON aligné sur le contrôleur (nom_p + alias anglais, members avec `role`). */
export function buildCreateProjectRequestBody(input: {
  nom_p: string;
  description_p: string;
  date_debut: string;
  date_fin: string;
  chefId: number;
  extraMembers: { userId: number; projectRole: string }[];
  spaceId?: number | null;
}): CreateProjetData {
  const nom = input.nom_p.trim();
  const date_debut = input.date_debut
    ? new Date(input.date_debut).toISOString()
    : new Date().toISOString();
  const date_fin = input.date_fin
    ? new Date(input.date_fin).toISOString()
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const members = input.extraMembers.map((m) => ({
    userId: Number(m.userId),
    role: m.projectRole,
    projectRole: m.projectRole,
    roleProjet: m.projectRole,
  }));
  return {
    nom_p: nom,
    name: nom,
    description_p: input.description_p,
    ...(input.description_p ? { description: input.description_p } : {}),
    date_debut,
    date_fin,
    startDate: date_debut,
    endDate: date_fin,
    statut_p: 'PLANNING',
    status: 'PLANNING',
    projectManagerId: input.chefId,
    chefDeProjetId: input.chefId,
    members,
    ...(input.spaceId != null && input.spaceId > 0
      ? { id_space: input.spaceId, spaceId: input.spaceId }
      : {}),
  };
}

export const projectService = {
  async getAll(): Promise<Projet[]> {
    const response = await api.get<Projet[]>('/projets');
    return response.data;
  },

  async getById(id: string | number): Promise<Projet> {
    const response = await api.get<Projet>(`/projets/${id}`);
    return response.data;
  },

  async create(data: CreateProjetData): Promise<Projet> {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[projectService.create] POST /api/projets', data);
    }
    const response = await api.post<Projet>('/projets', data);
    return response.data;
  },

  /** Remplace chef + membres (`membre_projet`) pour un projet existant. */
  async getTeamCandidates(projectId: string | number): Promise<User[]> {
    const response = await api.get<User[]>(`/projets/${projectId}/team-candidates`);
    return response.data ?? [];
  },

  async updateTeam(
    projectId: string | number,
    data: CreateProjetData,
    ctx?: { project?: ProjectManageContext; user?: User | null }
  ): Promise<void> {
    assertCanManageProjectTeamFromSession(ctx?.project, ctx?.user);
    await api.put(`/projets/${projectId}/team`, data);
  },

  async update(
    id: string | number,
    data: Partial<CreateProjetData>,
    ctx?: { project?: ProjectManageContext }
  ): Promise<Projet> {
    assertCanMutateProjectFromSession(ctx?.project, 'edit');
    const response = await api.put<Projet>(`/projets/${id}`, data);
    return response.data;
  },

  async delete(id: string | number, ctx?: { project?: ProjectManageContext }): Promise<void> {
    assertCanMutateProjectFromSession(ctx?.project, 'delete');
    await api.delete(`/projets/${id}`);
  },

  async assignChef(
    projectId: number | string,
    userId: number,
    ctx?: { project?: ProjectManageContext }
  ): Promise<void> {
    assertCanMutateProjectFromSession(ctx?.project, 'edit');
    await api.put(`/projets/${projectId}/update-chef`, { id_utilisateur: userId });
  },

  async getProgress(projectId: number): Promise<{ progressPercent: number; progress?: number }> {
    const response = await api.get<{ progressPercent: number; progress?: number }>(`/taches/progress/project/${projectId}`);
    return response.data;
  },

  async getTree(projectId: number | string): Promise<ProjectTree> {
    const response = await api.get(`/projets/${projectId}/tree`);
    return hierarchyService.normalizeTree(response.data, projectId);
  }
};
