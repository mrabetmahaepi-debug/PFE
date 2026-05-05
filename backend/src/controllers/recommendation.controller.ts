import { Request, Response } from "express";
import { getRecommendedProjectManagers } from "../services/recommendation.service";

export const getRecommendationsController = async (
  req: Request,
  res: Response
) => {
  try {
    const projectId = Number(req.params.projectId);

    if (!projectId) {
      return res.status(400).json({
        message: "projectId invalide"
      });
    }

    const recommendations = await getRecommendedProjectManagers(projectId);

    return res.status(200).json({
      projectId,
      recommendations
    });
  } catch (error: any) {
    return res.status(500).json({
      message: "Erreur recommendation",
      error: error.message
    });
  }
};