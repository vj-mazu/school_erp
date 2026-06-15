import { Router } from 'express';
import prisma from '../utils/db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { authorizeRoles } from '../middleware/rbac';
import { logAuditEvent } from '../middleware/audit';
import { TargetAudience } from '@prisma/client';

const router = Router();

// LIST CIRCULARS
router.get('/', authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  const academicYearId = req.academicYearId || '11111111-1111-1111-1111-111111111111';
  try {
    const list = await prisma.circular.findMany({
      where: {
        academicYearId,
        schoolId: req.user?.schoolId
      },
      include: { creatorUser: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to retrieve circulars', error: error.message });
  }
});

// CREATE & PUBLISH CIRCULAR
router.post('/', authenticateToken as any, authorizeRoles('SUPER_ADMIN', 'PRINCIPAL', 'ADMIN') as any, logAuditEvent('CREATE_CIRCULAR', 'circulars') as any, async (req: AuthenticatedRequest, res) => {
  const { title, body, targetAudience, targetClassIds, targetSectionIds, requiresAcknowledgement } = req.body;
  const academicYearId = req.academicYearId || '11111111-1111-1111-1111-111111111111';

  try {
    const circular = await prisma.circular.create({
      data: {
        schoolId: req.user!.schoolId,
        academicYearId,
        title,
        body,
        targetAudience: targetAudience as TargetAudience,
        targetClassIds: targetClassIds || [],
        targetSectionIds: targetSectionIds || [],
        requiresAcknowledgement: !!requiresAcknowledgement,
        isPublished: true,
        publishedAt: new Date(),
        createdBy: req.user?.id
      }
    });

    res.json(circular);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to create circular', error: error.message });
  }
});

// ACKNOWLEDGE CIRCULAR
router.post('/:id/acknowledge', authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  try {
    const ack = await prisma.circularAcknowledgement.create({
      data: {
        circularId: req.params.id,
        userId: req.user!.id
      }
    });
    res.json(ack);
  } catch (error: any) {
    res.status(500).json({ message: 'Acknowledgement failed', error: error.message });
  }
});

export default router;
