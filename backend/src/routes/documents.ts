import { Router } from 'express';
import prisma from '../utils/db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { authorizeRoles } from '../middleware/rbac';
import { logAuditEvent } from '../middleware/audit';
import { TcStatus, ConductType, CertificateType } from '@prisma/client';

const router = Router();

// NO-DUES VERIFICATION
router.get('/no-dues/:studentId', authenticateToken as any, async (req, res) => {
  const { studentId } = req.params;
  const academicYearId = req.headers['x-academic-year-id'] as string || '11111111-1111-1111-1111-111111111111';

  try {
    // 1. Fee Dues Check
    const pendingInvoices = await prisma.feeInvoice.findMany({
      where: {
        studentId,
        academicYearId,
        status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] }
      }
    });

    const feeDuesAmount = pendingInvoices.reduce((acc, inv) => acc + parseFloat(inv.amountAfterConcession.toString()), 0);
    const feesClear = feeDuesAmount === 0;

    // 2. Library Dues Check (Mocked - can be connected to library tables if active)
    const libraryClear = true;
    const libraryDuesMessage = libraryClear ? 'No pending books' : '2 books overdue';

    // 3. Hostel Dues Check (Mocked)
    const hostelClear = true;

    res.json({
      feesClear,
      feeDuesAmount,
      libraryClear,
      libraryDuesMessage,
      hostelClear,
      canProceed: feesClear && libraryClear && hostelClear
    });
  } catch (error: any) {
    res.status(500).json({ message: 'No-dues verification failed', error: error.message });
  }
});

// INITIATE TRANSFER CERTIFICATE
router.post('/tc/initiate/:studentId', authenticateToken as any, authorizeRoles('SUPER_ADMIN', 'ADMIN') as any, logAuditEvent('INITIATE_TC', 'transfer_certificates') as any, async (req: AuthenticatedRequest, res) => {
  const { studentId } = req.params;
  const { reasonForLeaving, conduct, classLastStudied, whetherPassed, totalWorkingDays, daysAttended, remarks } = req.body;
  const academicYearId = req.academicYearId || '11111111-1111-1111-1111-111111111111';

  try {
    // Verify dues are cleared
    const pendingInvoices = await prisma.feeInvoice.findFirst({
      where: { studentId, status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] } }
    });

    if (pendingInvoices) {
      return res.status(400).json({ message: 'Cannot initiate TC: Outstanding fee dues pending.' });
    }

    // Count TCs to generate next number
    const countTcs = await prisma.transferCertificate.count({ where: { schoolId: req.user?.schoolId } });
    const tcNumber = `TC/${new Date().getFullYear()}/${String(countTcs + 1).padStart(4, '0')}`;

    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const attendancePercent = totalWorkingDays > 0 ? (daysAttended / totalWorkingDays) * 100 : 100;

    const tc = await prisma.transferCertificate.create({
      data: {
        schoolId: req.user!.schoolId,
        studentId,
        tcNumber,
        academicYearId,
        applicationDate: new Date(),
        issueDate: new Date(),
        reasonForLeaving,
        classLastStudied: classLastStudied || student.classId,
        whetherPassed: !!whetherPassed,
        totalWorkingDays: parseInt(totalWorkingDays || 220),
        daysAttended: parseInt(daysAttended || 200),
        attendancePercent: parseFloat(attendancePercent.toFixed(2)),
        conduct: (conduct || 'GOOD') as ConductType,
        feesPaidUpTo: new Date(),
        duesCleared: true,
        libraryBooksReturned: true,
        remarks,
        status: TcStatus.PENDING_APPROVAL,
        requestedBy: req.user?.id
      }
    });

    res.json(tc);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to initiate TC', error: error.message });
  }
});

// APPROVE & ISSUE TC (PRINCIPAL)
router.put('/tc/:id/approve', authenticateToken as any, authorizeRoles('SUPER_ADMIN', 'PRINCIPAL') as any, logAuditEvent('APPROVE_TC', 'transfer_certificates') as any, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;

  try {
    const tc = await prisma.transferCertificate.update({
      where: { id },
      data: {
        status: TcStatus.APPROVED,
        approvedBy: req.user?.id,
        issueDate: new Date()
      }
    });

    // Update student status to TC_ISSUED
    await prisma.student.update({
      where: { id: tc.studentId },
      data: {
        status: 'TC_ISSUED',
        leavingDate: new Date()
      }
    });

    res.json(tc);
  } catch (error: any) {
    res.status(500).json({ message: 'TC approval failed', error: error.message });
  }
});

// GET TC DRAFTS
router.get('/tc', authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  try {
    const list = await prisma.transferCertificate.findMany({
      where: { schoolId: req.user?.schoolId },
      include: {
        student: { include: { class: true, section: true } },
        requestedUser: true,
        approvedUser: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to retrieve TCs', error: error.message });
  }
});

// GENERATE BULK ID CARDS
router.get('/id-cards/bulk', authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  const { classId, sectionId } = req.query;
  try {
    const students = await prisma.student.findMany({
      where: {
        classId: classId as string,
        sectionId: sectionId as string,
        status: 'ACTIVE'
      },
      include: { class: true, section: true }
    });

    res.json(students);
  } catch (error: any) {
    res.status(500).json({ message: 'ID Cards list extraction failed', error: error.message });
  }
});

export default router;
