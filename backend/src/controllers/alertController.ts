import { Request, Response } from "express";
import { checkOverdueTasks } from "../services/alert.service";

export const triggerAlertCheck = async (_req: Request, res: Response) => {
  try {
    const count = await checkOverdueTasks();
    res.json({ 
      message: "Vérification des retards terminée", 
      alertsCreated: count 
    });
  } catch (error: any) {
    console.error("Alert check error:", error);
    res.status(500).json({ 
      error: "Erreur lors de la vérification des alertes",
      details: error.message 
    });
  }
};
