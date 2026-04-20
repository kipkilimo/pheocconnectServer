import jwt, { JwtPayload } from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

// Express middleware version for app.use()
export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (token) {
    try {
      const user = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
      (req as any).user = user;
    } catch (error) {
      console.error("JWT verification failed:", error);
    }
  }

  next();
};

// Apollo Server context version
export const context = async ({ req }: { req: Request }) => {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) return {};

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    return { user };
  } catch (error) {
    console.error("JWT verification failed:", error);
    return {};
  }
};
