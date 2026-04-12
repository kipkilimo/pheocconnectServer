import { Request, Response, NextFunction } from 'express';

export interface MyContext {
  req: Request & { user?: { id: string; roles: string[] } };
  res: Response;
  next: NextFunction;
}
