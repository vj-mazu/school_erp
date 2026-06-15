import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'shantiniketan-super-secret-key-123';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    schoolId: string;
    role: string;
    email: string;
    name: string;
  };
  academicYearId?: string; // Loaded dynamically via headers or falls back to current
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authentication token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded: any) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }

    req.user = {
      id: decoded.id,
      schoolId: decoded.schoolId,
      role: decoded.role,
      email: decoded.email,
      name: decoded.name,
    };

    // Grab academic year from header so users can switch context dynamically
    const headerYearId = req.headers['x-academic-year-id'];
    if (headerYearId && typeof headerYearId === 'string') {
      req.academicYearId = headerYearId;
    }

    next();
  });
}
