import express from "express";
import { authMiddleware } from "../../middleware/authMiddleware";
import { requireGlobalMember } from "../../middleware/requireGlobalMember";
import {
  disconnectGoogleController,
  disconnectOutlookController,
  getCalendarConfigController,
  getCalendarEventsController,
  getCalendarIntegrationsController,
  googleCallbackController,
  googleConnectController,
  outlookCallbackController,
  outlookConnectController,
} from "../../controllers/calendar.controller";

const router = express.Router();

/** OAuth callbacks — public (state JWT carries user id). */
router.get("/google/callback", googleCallbackController);
router.get("/outlook/callback", outlookCallbackController);

router.use(authMiddleware);
router.use(requireGlobalMember);

router.get("/config", getCalendarConfigController);
router.get("/integrations", getCalendarIntegrationsController);
router.get("/events", getCalendarEventsController);
router.get("/google/connect", googleConnectController);
router.get("/outlook/connect", outlookConnectController);
router.delete("/google", disconnectGoogleController);
router.delete("/outlook", disconnectOutlookController);

export default router;
