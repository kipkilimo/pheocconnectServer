import jwt, { JwtPayload } from "jsonwebtoken";
import { IncomingMessage } from "http";

interface ContextParams {
  req: IncomingMessage;
}

export const context = async ({ req }: ContextParams) => {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) return {};

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

    return { user };
  } catch {
    return {};
  }
};
