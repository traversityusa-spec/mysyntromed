import type { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../firebaseAdmin.js';

export type UserRole = 'client' | 'admin' | 'specialist';

export type AuthedRequest = Request & {
  user?: {
    uid: string;
    email?: string;
    displayName?: string;
    role?: UserRole;
  };
};

export const requireAuth = async (req: AuthedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header.' });
  }

  const token = authHeader.slice('Bearer '.length);

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    let email = decoded.email;
    let roleClaim = decoded.role;

    const role: UserRole | undefined =
      roleClaim === 'client' || roleClaim === 'admin' || roleClaim === 'specialist'
        ? roleClaim
        : undefined;

    req.user = { uid: decoded.uid, email: email, role };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

export const requireRole =
  (...allowedRoles: UserRole[]) =>
  (req: AuthedRequest, res: Response, next: NextFunction) => {
    const role = req.user?.role;

    if (!role || !allowedRoles.includes(role)) {
      return res.status(403).json({ error: 'Forbidden for this role.' });
    }

    next();
  };
