import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const SECRET = process.env.JWT_SECRET || "mysecretkey";

/**
 * Generate a JWT token.
 * Encodes: { id, email, role (string name), id_entreprise }
 */
export const generateToken = (user: any): string => {
  return jwt.sign(
    {
      id: user.id_utilisateur,
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
