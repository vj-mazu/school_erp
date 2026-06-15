import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';

export function authorizeRoles(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `Forbidden: Role ${req.user.role} does not have access to this resource` 
      });
    }

    next();
  };
}
