import { Response } from "express";
import { getMyBadges } from "../services/badge.service";

export const getMyBadgesController = async (req: any, res: Response) => {
  try {
    const badges = await getMyBadges(req.user.id);

    return res.status(200).json({
      userId: req.user.id,
      badges
    });
  } catch (error: any) {
    return res.status(500).json({
      message: "Erreur lors de la récupération des badges",
      error: error.message
    });
  }
};