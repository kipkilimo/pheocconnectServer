import jwt, { JwtPayload, Secret, SignOptions } from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

/* ============================================
 TYPES
============================================ */

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  sessionId?: string;
}

interface TokenResult {
  accessToken: string;
  refreshToken: string;
}

interface TokenData {
  id: string;
  email: string;
  role: string;
  sessionId?: string;
  type: "access" | "refresh";
}

interface DecodedToken extends JwtPayload {
  id: string;
  email: string;
  role: string;
  sessionId?: string;
  type: "access" | "refresh";
}

// User type for context
export interface ContextUser {
  id: string;
  email: string;
  role: string;
  sessionId?: string;
}

/* ============================================
 CONFIGURATION
============================================ */

const config = {
  accessSecret: process.env.JWT_SECRET!,
  refreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!,
  accessExpiry: process.env.JWT_ACCESS_EXPIRY || "3h",
  refreshExpiry: process.env.JWT_REFRESH_EXPIRY || "7d",
};

// Validate required secrets
if (!config.accessSecret) {
  throw new Error(
    "JWT_SECRET is required but not defined in environment variables",
  );
}

/* ============================================
 HELPER FUNCTION FOR SIGNING TOKENS
============================================ */

const signToken = (
  data: TokenData,
  secret: string,
  expiresIn: string,
): string => {
  return jwt.sign(data, secret as Secret, { expiresIn } as SignOptions);
};

/* ============================================
 TOKEN GENERATION
============================================ */

export const generateTokens = (payload: TokenPayload): TokenResult => {
  const baseTokenData = {
    id: payload.userId,
    email: payload.email,
    role: payload.role,
    sessionId: payload.sessionId,
  };

  const accessToken = signToken(
    { ...baseTokenData, type: "access" as const },
    config.accessSecret,
    config.accessExpiry,
  );

  const refreshToken = signToken(
    { ...baseTokenData, type: "refresh" as const },
    config.refreshSecret,
    config.refreshExpiry,
  );

  return { accessToken, refreshToken };
};

/* ============================================
 TOKEN VERIFICATION
============================================ */

const verifyToken = (
  token: string,
  secret: string,
  expectedType: "access" | "refresh",
): DecodedToken | null => {
  try {
    const decoded = jwt.verify(token, secret as Secret) as DecodedToken;

    if (decoded.type && decoded.type !== expectedType) {
      console.error(`Invalid token type: expected ${expectedType} token`);
      return null;
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.error(`${expectedType} token expired`);
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.error(`Invalid ${expectedType} token:`, error.message);
    } else {
      console.error(`${expectedType} token verification failed:`, error);
    }
    return null;
  }
};

export const verifyAccessToken = (token: string): DecodedToken | null => {
  return verifyToken(token, config.accessSecret, "access");
};

export const verifyRefreshToken = (token: string): DecodedToken | null => {
  return verifyToken(token, config.refreshSecret, "refresh");
};

/* ============================================
 REFRESH TOKEN ROTATION
============================================ */

export const refreshAccessToken = (refreshToken: string): string | null => {
  const decoded = verifyRefreshToken(refreshToken);

  if (!decoded?.id || !decoded?.email || !decoded?.role) {
    return null;
  }

  return signToken(
    {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      sessionId: decoded.sessionId,
      type: "access",
    },
    config.accessSecret,
    config.accessExpiry,
  );
};

/* ============================================
 EXTRACT TOKEN FROM HEADER
============================================ */

const extractToken = (authHeader?: string): string | null => {
  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }

  return parts[1];
};

/* ============================================
 EXPRESS MIDDLEWARE
============================================ */

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const token = extractToken(req.headers.authorization);

  if (token) {
    const decoded = verifyAccessToken(token);
    if (decoded) {
      // Convert decoded token to context user format
      (req as any).user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        sessionId: decoded.sessionId,
      };
    }
  }

  next();
};

/* ============================================
 APOLLO SERVER CONTEXT - FIXED
============================================ */

export const createContext = async ({ req }: { req: Request }) => {
  const token = extractToken(req.headers.authorization);

  if (!token) {
    if (process.env.NODE_ENV === "development") {
      console.log("[Context] No token provided");
    }
    return { user: null };
  }

  const decoded = verifyAccessToken(token);

  if (!decoded) {
    if (process.env.NODE_ENV === "development") {
      console.log("[Context] Invalid token");
    }
    return { user: null };
  }

  // Ensure the user object has the expected structure
  const user: ContextUser = {
    id: decoded.id,
    email: decoded.email,
    role: decoded.role,
    sessionId: decoded.sessionId,
  };

  if (process.env.NODE_ENV === "development") {
    console.log(`[Context] User authenticated: ${user.email} (${user.role})`);
  }

  return { user };
};

// Alias for backward compatibility
export const context = createContext;

/* ============================================
 TOKEN UTILITIES
============================================ */

export const decodeToken = (token: string): DecodedToken | null => {
  try {
    return jwt.decode(token) as DecodedToken;
  } catch (error) {
    console.error("Token decode failed:", error);
    return null;
  }
};

export const isTokenExpired = (token: string): boolean => {
  const decoded = decodeToken(token);
  if (!decoded?.exp) return true;
  return Date.now() >= decoded.exp * 1000;
};

export const getTokenExpiryTime = (token: string): Date | null => {
  const decoded = decodeToken(token);
  if (!decoded?.exp) return null;
  return new Date(decoded.exp * 1000);
};

export const getTokenTimeRemaining = (token: string): number | null => {
  const decoded = decodeToken(token);
  if (!decoded?.exp) return null;
  const remainingMs = decoded.exp * 1000 - Date.now();
  return Math.max(0, remainingMs);
};

/* ============================================
 HELPER: Get user from context safely
============================================ */

export const getUserFromContext = (context: any): ContextUser | null => {
  if (!context || !context.user) {
    return null;
  }

  // Ensure user has required fields
  const user = context.user;
  if (!user.id || !user.email || !user.role) {
    console.warn("[getUserFromContext] User missing required fields");
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    sessionId: user.sessionId,
  };
};

/* ============================================
 HELPER: Check user role
============================================ */

export const hasRole = (
  user: ContextUser | null,
  allowedRoles: string[],
): boolean => {
  if (!user) return false;
  return allowedRoles.includes(user.role);
};

/* ============================================
 HELPER: Debug auth state
============================================ */

export const debugAuthState = (req: Request) => {
  const token = extractToken(req.headers.authorization);
  const decoded = token ? verifyAccessToken(token) : null;

  console.log("=== AUTH DEBUG ===");
  console.log("Token present:", !!token);
  console.log("Token valid:", !!decoded);
  if (decoded) {
    console.log("User ID:", decoded.id);
    console.log("User Email:", decoded.email);
    console.log("User Role:", decoded.role);
    console.log("Token Type:", decoded.type);
    console.log(
      "Token Expiry:",
      decoded.exp ? new Date(decoded.exp * 1000).toISOString() : "N/A",
    );
  }
  console.log("=================");

  return { tokenPresent: !!token, tokenValid: !!decoded, user: decoded };
};
