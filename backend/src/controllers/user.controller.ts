import { Response } from "express";
import {
  getMyProfile,
  updateMyProfile,
  ProfileUpdateError,
} from "../services/user.service";

export const getMyProfileController = async (req: any, res: Response) => {
  try {
    const user = await getMyProfile(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    return res.status(200).json(user);
  } catch (error: any) {
    return res.status(500).json({
      message: "Erreur lors de la récupération du profil",
      error: error.message
    });
  }
};

export const updateMyProfileController = async (req: any, res: Response) => {
  try {
    const updatedUser = await updateMyProfile(req.user.id, req.body);
    return res.status(200).json(updatedUser);
  } catch (error: unknown) {
    if (error instanceof ProfileUpdateError) {
      return res.status(error.status).json({ message: error.message });
    }
    return res.status(500).json({
      message: "Erreur lors de la mise à jour du profil",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};