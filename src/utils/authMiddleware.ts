import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

interface MyContext extends Request {
  user?: {
    id: string;
    roles: string[];
  };
}

const checkAuthorization = async (
  req: MyContext,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: string;
      roles: string[];
    };

    req.user = decoded;
    next();
  } catch (error) {
    console.error("Authorization error:", error);
    res.status(401).json({ message: "Unauthorized" });
  }
};

export default checkAuthorization;
