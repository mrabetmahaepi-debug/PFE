import { Request, Response } from "express";
import { registerUser, loginUser, getMe } from "../services/auth.service";
import { generateToken } from "../utils/jwt";

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

    res.json({ token });
  } catch (err: any) {
    res.status(401).json({ message: err.message });
  }
};

export const meController = async (req: any, res: Response) => {
  try {
    const user = await getMe(req.user.id);
    res.json(user);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};