import jwt from "jsonwebtoken";
import { trimEnvValue } from "../config/env";

const JWT_DEFAULT_DEV = "mysecretkey";
const rawSecret = trimEnvValue(process.env.JWT_SECRET);
const SECRET = rawSecret.length > 0 ? rawSecret : JWT_DEFAULT_DEV;

/** True when running with the insecure dev fallback secret. */
export function isUsingDefaultJwtSecret(): boolean {
  return SECRET === JWT_DEFAULT_DEV;
}

/**
 * Generate a JWT token.
 * Encodes: { id, email, role (string name), id_entreprise }
 */
export const generateToken = (user: any): string => {
  return jwt.sign(
    {
      id: Number(user.id_utilisateur),
      email: user.email,
      role: user.role?.nom || "membre",
      id_role: user.id_role,
      id_entreprise: user.id_entreprise ?? null,
    },
    SECRET,
    { expiresIn: "1d" }
  );
};

export const verifyToken = (token: string): any => {
  return jwt.verify(token, SECRET);
};
