import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

// ── Auth & user-profile ────────────────────────────────────────────────────
import authRoutes from "./routes/auth.route";
import userRoutes from "./routes/user.route";

// ── AI / smart features ───────────────────────────────────────────────────
import notificationRoutes from "./routes/notification.route";
import chatbotRoutes from "./routes/chatbot.route";
import badgeRoutes from "./routes/badge.route";
import recommendationRoutes from "./routes/recommendation.route";

// ── Company & access management ───────────────────────────────────────────
import entrepriseRoutes from "./routes/entrepriseRoutes";
import invitationRoutes from "./routes/invitationRoutes";
import utilisateurRoutes from "./routes/utilisateurRoutes";
import roleRoutes from "./routes/roleRoutes";
import permissionRoutes from "./routes/permissionRoutes";

// ── Project management ────────────────────────────────────────────────────
import projetRoutes from "./routes/projetRoutes";
import sprintRoutes from "./routes/sprintRoutes";
import tacheRoutes from "./routes/tacheRoutes";
import affectationRoutes from "./routes/affectationRoutes";
import superAdminRoutes from "./routes/superAdmin.route";
import alertRoutes from "./routes/alertRoutes";
import accessRoutes from "./routes/access.route";
import messagingRoutes from "./routes/messaging.route";
import activityRoutes from "./routes/activityRoutes";
import uploadRoutes from "./routes/upload.route";
import statsRoutes from "./routes/statsRoutes";

const app = express();
const PORT = process.env.PORT || 5000;

// ── Global middleware ─────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads')); // Serve profile pictures

// ── Health check ──────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({ status: "ok", message: "API Gestion Projet fonctionne 🚀" });
});

// ── Public routes (no auth required) ─────────────────────────────────────
app.use("/api/auth", authRoutes);           // POST /register, POST /login, GET /me

// ── Authenticated routes ──────────────────────────────────────────────────
app.use("/api/users", userRoutes);          // GET /me, PUT /me (self-profile)

app.use("/api/notifications", notificationRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/badges", badgeRoutes);
app.use("/api/recommendations", recommendationRoutes);

app.use("/api/entreprises", entrepriseRoutes);
app.use("/api/invitations", invitationRoutes);
app.use("/api/utilisateurs", utilisateurRoutes); // admin user management

app.use("/api/roles", roleRoutes);
app.use("/api/permissions", permissionRoutes);

app.use("/api/projets", projetRoutes);
app.use("/api/sprints", sprintRoutes);
app.use("/api/taches", tacheRoutes);
app.use("/api/affectations", affectationRoutes);
app.use("/api/superadmin", superAdminRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/access", accessRoutes);
app.use("/api/messaging", messagingRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/stats", statsRoutes);

// Register Global Error Handler
import { errorHandler } from "./middleware/errorHandler";
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

export default app;


