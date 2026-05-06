import { Request, Response } from "express";
import { registerUser, loginUser, getMe } from "../services/auth.service";
import { generateToken } from "../utils/jwt";
import prisma from "../prisma/prismaClient";

export const registerController = async (req: Request, res: Response) => {
  try {
    const user = await registerUser(req.body);
    res.status(201).json(user);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
};

export const loginController = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const user = await loginUser(email, password);

    const token = generateToken(user);

    // Update lastLogin timestamp
    await prisma.utilisateur.update({
      where: { id_utilisateur: user.id_utilisateur },
      data: { lastLogin: new Date() }
    });

    res.json({ 
      token, 
      user: {
        id: user.id_utilisateur,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role?.nom || 'Admin',
        id_role: user.id_role
      },
      role: user.role?.nom || 'Admin',
      id_role: user.id_role
    });
  } catch (err: any) {
    res.status(401).json({ message: err.message });
  }
};

export const meController = async (req: any, res: Response) => {
  try {
    const user = await getMe(req.user.id);
    res.json({
      ...user,
      id_role: user.id_role
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};