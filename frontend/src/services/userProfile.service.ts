import api from './api';

export interface MyProfile {
  id_utilisateur: number;
  nom: string;
  prenom: string;
  email: string;
  poste?: string | null;
  telephone?: string | null;
  id_role?: number;
  id_entreprise?: number | null;
  photoUrl?: string | null;
}

export interface UpdateMyProfilePayload {
  nom?: string;
  prenom?: string;
  email?: string;
}

export const userProfileService = {
  async getMyProfile(): Promise<MyProfile> {
    const { data } = await api.get<MyProfile>('/users/me');
    return data;
  },

  async updateMyProfile(payload: UpdateMyProfilePayload): Promise<MyProfile> {
    const { data } = await api.put<MyProfile>('/users/me', payload);
    return data;
  },

  async uploadProfilePhoto(file: File): Promise<{ photoUrl: string; message?: string }> {
    const formData = new FormData();
    formData.append('photo', file);
    const { data } = await api.post<{ photoUrl: string; message?: string }>(
      '/upload/profile-picture',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return data;
  },

  async deleteProfilePhoto(): Promise<{ photoUrl: null; message?: string }> {
    const { data } = await api.delete<{ photoUrl: null; message?: string }>(
      '/upload/profile-picture'
    );
    return data;
  },
};
