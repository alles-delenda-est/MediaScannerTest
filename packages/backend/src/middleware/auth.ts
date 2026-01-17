import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UnauthorizedError, ForbiddenError } from './error-handler.js';
import type { AuthUser, UserRole } from '@media-scanner/shared';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const token = extractToken(req);

    if (!token) {
      throw new UnauthorizedError('Token manquant');
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as JWTPayload;

    req.user = {
      id: decoded.userId,
      email: decoded.email,
      name: null,
      avatarUrl: null,
      role: decoded.role,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Token invalide'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Token expiré'));
    } else {
      next(error);
    }
  }
}

export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const token = extractToken(req);

    if (token) {
      const decoded = jwt.verify(token, env.JWT_SECRET) as JWTPayload;

      req.user = {
        id: decoded.userId,
        email: decoded.email,
        name: null,
        avatarUrl: null,
        role: decoded.role,
      };
    }

    next();
  } catch {
    // Token invalid, continue without user
    next();
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('Authentification requise'));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError('Droits insuffisants'));
      return;
    }

    next();
  };
}

function extractToken(req: Request): string | null {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Check cookie
  if (req.cookies?.token) {
    return req.cookies.token;
  }

  return null;
}

export function generateToken(user: {
  id: string;
  email: string;
  role: UserRole;
}): string {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}
