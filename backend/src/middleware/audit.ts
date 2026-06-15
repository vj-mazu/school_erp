import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import prisma from '../utils/db';

export function logAuditEvent(action: string, tableName: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const originalJson = res.json;
    
    // Intercept the response to capture success and record id if needed
    res.json = function (body: any): Response {
      res.json = originalJson; // restore original function
      
      const response = res.json(body);
      
      // Only log successful modifications
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Run async in background to avoid blocking response
        prisma.auditLog.create({
          data: {
            userId: req.user?.id || null,
            action,
            tableName,
            recordId: body?.id || body?.data?.id || null,
            oldValues: req.body ? req.body : undefined,
            newValues: body ? body : undefined,
            ipAddress: req.ip || req.socket.remoteAddress || null,
            userAgent: req.headers['user-agent'] || null,
          }
        }).catch((err) => {
          console.error('[AUDIT LOG ERROR]:', err);
        });
      }
      
      return response;
    };
    
    next();
  };
}
