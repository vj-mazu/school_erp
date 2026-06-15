import { Router } from 'express';
import prisma from '../utils/db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { authorizeRoles } from '../middleware/rbac';
import { logAuditEvent } from '../middleware/audit';
import { HomeworkStatus } from '@prisma/client';

const router = Router();

// LIST HOMEWORK
router.get('/', authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  const { sectionId, subjectId } = req.query;
  const academicYearId = req.academicYearId || '11111111-1111-1111-1111-111111111111';

  try {
    const filters: any = { academicYearId };
    if (sectionId) filters.sectionId = sectionId as string;
    if (subjectId) filters.subjectId = subjectId as string;

    const list = await prisma.homework.findMany({
      where: filters,
      include: {
        section: { include: { class: true } },
        subject: true,
        staff: true
      },
      orderBy: { assignedDate: 'desc' }
    });
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to retrieve homework', error: error.message });
  }
});

// ASSIGN HOMEWORK
router.post('/', authenticateToken as any, authorizeRoles('SUPER_ADMIN', 'PRINCIPAL', 'CLASS_TEACHER', 'SUBJECT_TEACHER') as any, logAuditEvent('ASSIGN_HOMEWORK', 'homework') as any, async (req: AuthenticatedRequest, res) => {
  const { sectionId, subjectId, title, description, assignedDate, dueDate, attachmentUrls } = req.body;
  const academicYearId = req.academicYearId || '11111111-1111-1111-1111-111111111111';

  try {
    const staff = await prisma.staff.findFirst({ where: { userId: req.user?.id } });
    if (!staff) return res.status(403).json({ message: 'Only registered teachers can assign homework' });

    const task = await prisma.homework.create({
      data: {
        sectionId,
        subjectId,
        staffId: staff.id,
        academicYearId,
        title,
        description,
        assignedDate: new Date(assignedDate || new Date()),
        dueDate: new Date(dueDate),
        attachmentUrls: attachmentUrls || []
      }
    });

    res.json(task);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to assign homework', error: error.message });
  }
});

// SUBMIT HOMEWORK
router.post('/:id/submit', authenticateToken as any, authorizeRoles('STUDENT') as any, async (req: AuthenticatedRequest, res) => {
  const { submissionText, attachmentUrls } = req.body;
  const homeworkId = req.params.id;

  try {
    const student = await prisma.student.findFirst({ where: { userId: req.user?.id } });
    if (!student) return res.status(403).json({ message: 'Student profile missing' });

    const submission = await prisma.homeworkSubmission.create({
      data: {
        homeworkId,
        studentId: student.id,
        submittedAt: new Date(),
        submissionText,
        attachmentUrls: attachmentUrls || [],
        status: HomeworkStatus.SUBMITTED
      }
    });
    res.json(submission);
  } catch (error: any) {
    res.status(500).json({ message: 'Homework submission failed', error: error.message });
  }
});

// GRADE SUBMISSION (TEACHER)
router.put('/submission/:id', authenticateToken as any, authorizeRoles('SUPER_ADMIN', 'PRINCIPAL', 'CLASS_TEACHER', 'SUBJECT_TEACHER') as any, logAuditEvent('GRADE_HOMEWORK', 'homework_submissions') as any, async (req: AuthenticatedRequest, res) => {
  const { grade, teacherRemarks } = req.body;

  try {
    const submission = await prisma.homeworkSubmission.update({
      where: { id: req.params.id },
      data: {
        grade,
        teacherRemarks,
        status: HomeworkStatus.GRADED
      }
    });
    res.json(submission);
  } catch (error: any) {
    res.status(500).json({ message: 'Grading update failed', error: error.message });
  }
});

export default router;
