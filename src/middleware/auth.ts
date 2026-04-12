import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

interface AuthRequest extends Request {
  userId?: string;
}

// Define protected routes that require authentication
const protectedPaths = [
  "/profile",
  "/dashboard",
  "/settings",
  "/admin",
  "/resources/uploads/paper/admin",
  "/resources/uploads/assignment/admin",
  "/resources/uploads/exam/admin",
  // Add more protected routes as needed
].map((path) => path.toLowerCase().trim());

const auth = (req: AuthRequest, res: Response, next: NextFunction) => {
  // Normalize the request path (ignoring case and trailing slashes)
  const normalizedPath = req.path.toLowerCase().trim();

  // Check if the request path is protected
  if (!protectedPaths.includes(normalizedPath)) {
    return next(); // If it's not protected, proceed to the next middleware
  }

  // Check for the token in the Authorization header
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    console.log("No token found");
    return res
      .status(401)
      .json({ message: "Please sign in to access this resource." });
  }

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    req.userId = decoded.userId;
    console.log("Token is valid, user ID:", req.userId);
    next(); // Token is valid, proceed to the next middleware
  } catch (err) {
    console.log("Invalid token");
    return res.status(401).json({ message: "Invalid token" });
  }
};

// Export the auth middleware function
export default auth;
