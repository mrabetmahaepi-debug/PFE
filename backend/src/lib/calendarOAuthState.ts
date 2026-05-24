import jwt from "jsonwebtoken";
import { trimEnvValue } from "../config/env";

const rawSecret = trimEnvValue(process.env.JWT_SECRET);
const SECRET = rawSecret.length > 0 ? rawSecret : "mysecretkey";

export type CalendarProvider = "google" | "outlook";

export function signCalendarOAuthState(
  userId: number,
  provider: CalendarProvider
): string {
  return jwt.sign(
    { purpose: "calendar_oauth", userId, provider },
    SECRET,
    { expiresIn: "15m" }
  );
}

export function verifyCalendarOAuthState(token: string): {
  userId: number;
  provider: CalendarProvider;
} {
  const decoded = jwt.verify(token, SECRET) as {
    purpose?: string;
    userId?: number;
    provider?: string;
  };
  if (decoded.purpose !== "calendar_oauth") {
    throw new Error("Invalid OAuth state");
  }
  const userId = Number(decoded.userId);
  if (!Number.isFinite(userId) || userId < 1) {
    throw new Error("Invalid OAuth state user");
  }
  const provider = decoded.provider;
  if (provider !== "google" && provider !== "outlook") {
    throw new Error("Invalid OAuth provider");
  }
  return { userId, provider };
}
