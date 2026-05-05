import { Request, Response } from "express";
import { saveChatbotMessage, getMyChatHistory } from "../services/chatbot.service";

export const sendMessageToChatbotController = async (req: any, res: Response) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        message: "Le champ message est obligatoire"
      });
    }

    const chat = await saveChatbotMessage(req.user.id, message);

    return res.status(201).json({
      userMessage: chat.message,
      botReply: chat.reponse,
      date: chat.date_msg
    });
  } catch (error: any) {
    return res.status(500).json({
      message: "Erreur lors de la communication avec le chatbot",
      error: error.message
    });
  }
};

export const getMyChatHistoryController = async (req: any, res: Response) => {
  try {
    const history = await getMyChatHistory(req.user.id);
    return res.status(200).json(history);
  } catch (error: any) {
    return res.status(500).json({
      message: "Erreur lors de la récupération de l'historique du chatbot",
      error: error.message
    });
  }
};