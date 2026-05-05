import prisma from "../prisma/prismaClient";

export const generateChatbotReply = (message: string): string => {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("progress") || lowerMessage.includes("avancement")) {
    return "Vous pouvez consulter l'avancement du projet dans la section progression.";
  }

  if (lowerMessage.includes("retard")) {
    return "Certaines tâches peuvent être en retard. Vérifiez la section notifications pour plus de détails.";
  }

  if (lowerMessage.includes("tâche") || lowerMessage.includes("tache")) {
    return "Vous pouvez consulter et gérer vos tâches dans la section dédiée aux tâches.";
  }

  if (lowerMessage.includes("sprint")) {
    return "Vous pouvez suivre l'état du sprint à partir de la section de progression des sprints.";
  }

  return "Je suis votre assistant projet. Je peux vous aider concernant les tâches, les retards, les sprints et l'avancement du projet.";
};

export const saveChatbotMessage = async (userId: number, message: string) => {
  const reply = generateChatbotReply(message);

  return prisma.chatbot.create({
    data: {
      id_utilisateur: userId,
      message,
      reponse: reply,
    },
  });
};

export const getMyChatHistory = async (userId: number) => {
  return prisma.chatbot.findMany({
    where: { id_utilisateur: userId },
    orderBy: { date_msg: "desc" },
  });
};