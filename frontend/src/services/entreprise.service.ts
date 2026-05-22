import api from './api';

export interface Entreprise {
  id_entreprise: number;
  nom: string;
  adresse: string;
  phone?: string | null;
  telephone?: string | null;
  phoneCountryCode?: string | null;
  phoneNumber?: string | null;
  createdAt: string;
  statut?: string;
  admin?: {
    id_utilisateur?: number;
    nom: string | null;
    prenom: string | null;
    email: string | null;
    phone?: string | null;
    telephone?: string | null;
    phoneCountryCode?: string | null;
    phoneNumber?: string | null;
    /** Admin connection presence (computed server-side). */
    isOnline?: boolean;
    lastSeen?: string | null;
    createdAt?: string | null;
  };
  /** All tenant admins linked to this company (merged duplicates). */
  admins?: Entreprise['admin'][];
  responsibleAdmin?: Entreprise['admin'];
  projet?: any[];
  utilisateur?: any[];
}

export const entrepriseService = {
  async getAll(): Promise<Entreprise[]> {
    const response = await api.get<any>('/entreprises', {
      params: { page: 1, limit: 500 },
    });
    const result = response.data?.data;
    const raw: unknown[] =
      result && Array.isArray(result.items)
        ? result.items
        : Array.isArray(result)
          ? result
          : [];
    return raw.map((item) =>
      entrepriseService.normalize(item as Record<string, unknown>)
    );
  },

  normalize(payload: Record<string, unknown>): Entreprise {
    const ent = payload as Entreprise;
    const phone = ent.phone ?? ent.telephone ?? null;
    return {
      ...ent,
      phone,
      telephone: ent.telephone ?? phone,
      phoneCountryCode: ent.phoneCountryCode ?? null,
      phoneNumber: ent.phoneNumber ?? null,
      admin: ent.admin
        ? {
            ...ent.admin,
            phone: ent.admin.phone ?? ent.admin.telephone ?? null,
            telephone: ent.admin.telephone ?? ent.admin.phone ?? null,
          }
        : null,
      admins: (() => {
        const mapAdmin = (a: NonNullable<Entreprise['admin']>) => ({
          ...a,
          phone: a.phone ?? a.telephone ?? null,
          telephone: a.telephone ?? a.phone ?? null,
        });
        const fromApi = Array.isArray(ent.admins)
          ? ent.admins.filter(Boolean).map((a) => mapAdmin(a!))
          : [];
        if (fromApi.length) return fromApi;
        return ent.admin ? [mapAdmin(ent.admin)] : [];
      })(),
      responsibleAdmin: ent.responsibleAdmin
        ? {
            ...ent.responsibleAdmin,
            phone:
              ent.responsibleAdmin.phone ?? ent.responsibleAdmin.telephone ?? null,
            telephone:
              ent.responsibleAdmin.telephone ?? ent.responsibleAdmin.phone ?? null,
          }
        : ent.admin ?? null,
      projet: Array.isArray(ent.projet) ? ent.projet : [],
      utilisateur: (() => {
        const users = Array.isArray(ent.utilisateur) ? [...ent.utilisateur] : [];
        const adminList = Array.isArray(ent.admins)
          ? ent.admins.filter(Boolean)
          : ent.admin
            ? [ent.admin]
            : [];
        if (!adminList.length) return users;

        const freshById = new Map(
          adminList
            .filter((a) => a?.id_utilisateur != null)
            .map((a) => [a!.id_utilisateur!, a!])
        );

        return users.map((user) => {
          const row = user as {
            id_utilisateur?: number;
            email?: string | null;
            telephone?: string | null;
            createdAt?: string | null;
          };
          const fresh = freshById.get(row.id_utilisateur ?? -1);
          if (!fresh) return user;
          const tel = fresh.telephone ?? fresh.phone ?? row.telephone ?? null;
          return {
            ...user,
            email: fresh.email ?? row.email,
            telephone: tel,
            createdAt: fresh.createdAt ?? row.createdAt,
          };
        });
      })(),
    };
  },

  async getById(id: number): Promise<Entreprise | null> {
    const response = await api.get<any>(`/entreprises/${id}`);
    const payload = response.data?.data ?? response.data;
    if (!payload || typeof payload !== 'object' || !('id_entreprise' in payload)) {
      return null;
    }
    return entrepriseService.normalize(payload as Record<string, unknown>);
  },

  async create(data: Partial<Entreprise>): Promise<Entreprise> {
    const response = await api.post<any>('/entreprises', data);
    return response.data?.data || response.data;
  },

  async update(
    id: number,
    data: {
      nom: string;
      adresse?: string;
      phoneCountryCode?: string;
      phoneNumber?: string;
      admins?: Array<{
        id_utilisateur: number;
        email: string;
        telephone?: string | null;
      }>;
    }
  ): Promise<Entreprise> {
    const body: Record<string, unknown> = {
      nom: data.nom.trim(),
      adresse: data.adresse?.trim() ?? '',
    };
    if (data.phoneCountryCode !== undefined || data.phoneNumber !== undefined) {
      body.phoneCountryCode = data.phoneCountryCode;
      body.phoneNumber = data.phoneNumber ?? '';
    }
    if (data.admins?.length) {
      body.admins = data.admins;
    }

    const response = await api.put<{ data?: Entreprise }>(`/entreprises/${id}`, body);
    const payload = response.data?.data ?? response.data;
    if (!payload || typeof payload !== 'object' || !('id_entreprise' in payload)) {
      throw new Error('Réponse serveur invalide lors de la mise à jour');
    }
    return entrepriseService.normalize(payload as Record<string, unknown>);
  },

  async toggleStatus(id: number): Promise<Entreprise> {
    const response = await api.put<any>(`/entreprises/${id}/toggle-status`);
    return response.data?.data || response.data;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/entreprises/${id}`);
  },

  async inviteAdmin(data: any): Promise<any> {
    const response = await api.post('/entreprises/invite-admin', data);
    return response.data;
  }
};
