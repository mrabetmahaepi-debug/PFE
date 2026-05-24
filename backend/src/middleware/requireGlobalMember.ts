import { Response, NextFunction } from "express";
import { isGlobalMemberUser } from "../lib/isGlobalMember";

/** Restrict route to global Membre role only. */
export function requireGlobalMember(req: any, res: Response, next: NextFunction) {
  if (!req.user?.id) {
    return res.status(401).json({ message: "Non authentifié" });
  }
  if (!isGlobalMemberUser(req.user)) {
    return res.status(403).json({
      message: "Cette fonctionnalité est réservée aux membres.",
      code: "MEMBER_ONLY",
    });
  }
  next();
}
