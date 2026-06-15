import { Router } from 'express';
import prisma from '../utils/db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { authorizeRoles } from '../middleware/rbac';
import { logAuditEvent } from '../middleware/audit';
import { DayOfWeek, PeriodType, SubjectType, LanguageType } from '@prisma/client';

const router = Router();

// 1. SUBJECTS
router.get('/subjects', authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  try {
    const subjects = await prisma.subject.findMany({
      where: { schoolId: req.user?.schoolId }
    });
    res.json(subjects);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to retrieve subjects', error: error.message });
  }
});

router.post('/subjects', authenticateToken as any, authorizeRoles('SUPER_ADMIN', 'ADMIN') as any, async (req: AuthenticatedRequest, res) => {
  const { name, code, subjectType, languageType, isElective } = req.body;
  try {
    const sub = await prisma.subject.create({
      data: {
        schoolId: req.user!.schoolId,
        name,
        code: code.toUpperCase(),
        subjectType: subjectType as SubjectType,
        languageType: (languageType || 'NA') as LanguageType,
        isElective: !!isElective
      }
    });
    res.json(sub);
  } catch (error: any) {
    res.status(500).json({ message: 'Subject creation failed', error: error.message });
  }
});

// 2. TIMETABLE
router.get('/timetable', authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  const { sectionId } = req.query;
  const academicYearId = req.academicYearId || '11111111-1111-1111-1111-111111111111';
  try {
    const timetable = await prisma.timetable.findMany({
      where: {
        sectionId: sectionId as string,
        academicYearId
      },
      include: {
        subject: true,
        staff: true
      },
      orderBy: [
        { dayOfWeek: 'asc' },
        { periodNumber: 'asc' }
      ]
    });
    res.json(timetable);
  } catch (error: any) {
    res.status(500).json({ message: 'Timetable load failed', error: error.message });
  }
});

router.post('/timetable', authenticateToken as any, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'PRINCIPAL') as any, logAuditEvent('SET_TIMETABLE', 'timetable') as any, async (req: AuthenticatedRequest, res) => {
  const { sectionId, dayOfWeek, periodNumber, startTime, endTime, subjectId, staffId, roomNumber, periodType } = req.body;
  const academicYearId = req.academicYearId || '11111111-1111-1111-1111-111111111111';

  try {
    const slot = await prisma.timetable.upsert({
      where: {
        sectionId_dayOfWeek_periodNumber_academicYearId: {
          sectionId,
          dayOfWeek: dayOfWeek as DayOfWeek,
          periodNumber: parseInt(periodNumber),
          academicYearId
        }
      },
      update: {
        startTime,
        endTime,
        subjectId: subjectId || null,
        staffId: staffId || null,
        roomNumber,
        periodType: periodType as PeriodType
      },
      create: {
        sectionId,
        academicYearId,
        dayOfWeek: dayOfWeek as DayOfWeek,
        periodNumber: parseInt(periodNumber),
        startTime,
        endTime,
        subjectId: subjectId || null,
        staffId: staffId || null,
        roomNumber,
        periodType: periodType as PeriodType
      }
    });

    res.json(slot);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to update timetable slot', error: error.message });
  }
});

// 3. EXAMS
router.get('/exams', authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  const academicYearId = req.academicYearId || '11111111-1111-1111-1111-111111111111';
  try {
    const exams = await prisma.examType.findMany({
      where: { academicYearId },
      orderBy: { examOrder: 'asc' }
    });
    res.json(exams);
  } catch (error: any) {
    res.status(500).json({ message: 'Exams fetch failed', error: error.message });
  }
});

router.post('/exams', authenticateToken as any, authorizeRoles('SUPER_ADMIN', 'PRINCIPAL', 'ADMIN') as any, async (req: AuthenticatedRequest, res) => {
  const { name, shortName, examOrder, weightagePercent, appliesToClasses, startDate, endDate } = req.body;
  const academicYearId = req.academicYearId || '11111111-1111-1111-1111-111111111111';

  try {
    const exam = await prisma.examType.create({
      data: {
        schoolId: req.user!.schoolId,
        academicYearId,
        name,
        shortName,
        examOrder: parseInt(examOrder),
        weightagePercent: parseFloat(weightagePercent),
        appliesToClasses: appliesToClasses || [],
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      }
    });
    res.json(exam);
  } catch (error: any) {
    res.status(500).json({ message: 'Exam creation failed', error: error.message });
  }
});

// 4. MARKS MANAGEMENT
function calculateGrade(percentage: number): { grade: string; gradePoint: number } {
  if (percentage >= 91) return { grade: 'A1', gradePoint: 10.0 };
  if (percentage >= 81) return { grade: 'A2', gradePoint: 9.0 };
  if (percentage >= 71) return { grade: 'B1', gradePoint: 8.0 };
  if (percentage >= 61) return { grade: 'B2', gradePoint: 7.0 };
  if (percentage >= 51) return { grade: 'C1', gradePoint: 6.0 };
  if (percentage >= 41) return { grade: 'C2', gradePoint: 5.0 };
  if (percentage >= 33) return { grade: 'D', gradePoint: 4.0 };
  return { grade: 'E', gradePoint: 0.0 };
}

// GET STUDENT MARKS GRID
router.get('/marks', authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  const { examTypeId, classId, sectionId, subjectId } = req.query;
  const academicYearId = req.academicYearId || '11111111-1111-1111-1111-111111111111';

  if (!examTypeId || !classId || !sectionId || !subjectId) {
    return res.status(400).json({ message: 'examTypeId, classId, sectionId, and subjectId are required' });
  }

  try {
    // 1. Get class subject configuration (max marks)
    const classSubject = await prisma.classSubject.findFirst({
      where: { classId: classId as string, subjectId: subjectId as string }
    });

    const maxTheory = classSubject?.maxMarksTheory || 100;
    const maxPractical = classSubject?.maxMarksPractical || 0;

    // 2. Get students
    const students = await prisma.student.findMany({
      where: { classId: classId as string, sectionId: sectionId as string, status: 'ACTIVE' },
      orderBy: { rollNumber: 'asc' }
    });

    // 3. Get entered marks
    const entered = await prisma.marks.findMany({
      where: {
        examTypeId: examTypeId as string,
        subjectId: subjectId as string,
        academicYearId
      }
    });

    const marksMap = new Map(entered.map(m => [m.studentId, m]));

    // 4. Merge records
    const grid = students.map(st => {
      const record = marksMap.get(st.id);
      return {
        studentId: st.id,
        rollNumber: st.rollNumber,
        name: `${st.firstName} ${st.lastName}`,
        theoryMarks: record ? parseFloat(record.marksTheory.toString()) : 0,
        practicalMarks: record ? parseFloat(record.marksPractical.toString()) : 0,
        totalMarks: record ? parseFloat(record.totalMarks.toString()) : 0,
        grade: record ? record.grade : 'E',
        isAbsent: record ? record.isAbsent : false,
        isExempted: record ? record.isExempted : false,
        remarks: record ? record.remarks : '',
        isLocked: record ? record.isLocked : false,
        marksId: record ? record.id : null
      };
    });

    res.json({
      maxTheory,
      maxPractical,
      grid
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to retrieve marks grid', error: error.message });
  }
});

// BULK SAVE MARKS
router.post('/marks/bulk', authenticateToken as any, authorizeRoles('SUPER_ADMIN', 'PRINCIPAL', 'CLASS_TEACHER', 'SUBJECT_TEACHER') as any, logAuditEvent('SAVE_MARKS_BULK', 'marks') as any, async (req: AuthenticatedRequest, res) => {
  const { examTypeId, classId, sectionId, subjectId, records } = req.body;
  const academicYearId = req.academicYearId || '11111111-1111-1111-1111-111111111111';

  try {
    const classSubject = await prisma.classSubject.findFirst({
      where: { classId, subjectId }
    });
    const maxTheory = classSubject?.maxMarksTheory || 100;
    const maxPractical = classSubject?.maxMarksPractical || 0;
    const maxTotal = maxTheory + maxPractical;

    const upsertQueries = [];

    for (const rec of records) {
      const theory = rec.isAbsent ? 0 : parseFloat(rec.theoryMarks || 0);
      const practical = rec.isAbsent ? 0 : parseFloat(rec.practicalMarks || 0);
      const total = theory + practical;
      
      const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
      const { grade, gradePoint } = calculateGrade(pct);

      upsertQueries.push(
        prisma.marks.upsert({
          where: {
            studentId_examTypeId_subjectId: {
              studentId: rec.studentId,
              examTypeId,
              subjectId
            }
          },
          update: {
            marksTheory: theory,
            marksPractical: practical,
            totalMarks: total,
            grade,
            gradePoint,
            isAbsent: !!rec.isAbsent,
            isExempted: !!rec.isExempted,
            remarks: rec.remarks,
            enteredBy: req.user?.id
          },
          create: {
            studentId: rec.studentId,
            examTypeId,
            subjectId,
            academicYearId,
            marksTheory: theory,
            marksPractical: practical,
            totalMarks: total,
            grade,
            gradePoint,
            isAbsent: !!rec.isAbsent,
            isExempted: !!rec.isExempted,
            remarks: rec.remarks,
            enteredBy: req.user?.id
          }
        })
      );
    }

    await prisma.$transaction(upsertQueries);
    res.json({ success: true, message: 'Marks updated successfully' });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to save marks', error: error.message });
  }
});

// VERIFY MARKS (CLASS TEACHER)
router.post('/marks/verify/:examTypeId', authenticateToken as any, authorizeRoles('SUPER_ADMIN', 'PRINCIPAL', 'CLASS_TEACHER') as any, logAuditEvent('VERIFY_MARKS', 'marks') as any, async (req: AuthenticatedRequest, res) => {
  const { classId, sectionId, subjectId } = req.body;
  const { examTypeId } = req.params;

  try {
    // Check if staff profile exists for user
    const staff = await prisma.staff.findFirst({ where: { userId: req.user?.id } });
    if (!staff) return res.status(403).json({ message: 'Only registered staff can verify marks' });

    // Fetch students in scope
    const studentIds = (await prisma.student.findMany({
      where: { classId, sectionId, status: 'ACTIVE' },
      select: { id: true }
    })).map(s => s.id);

    await prisma.marks.updateMany({
      where: {
        examTypeId,
        subjectId,
        studentId: { in: studentIds }
      },
      data: {
        verifiedBy: staff.id
      }
    });

    res.json({ success: true, message: 'Marks verified successfully' });
  } catch (error: any) {
    res.status(500).json({ message: 'Verification failed', error: error.message });
  }
});

// LOCK MARKS (PRINCIPAL)
router.post('/marks/lock/:examTypeId', authenticateToken as any, authorizeRoles('SUPER_ADMIN', 'PRINCIPAL') as any, logAuditEvent('LOCK_MARKS', 'marks') as any, async (req: AuthenticatedRequest, res) => {
  const { classId, sectionId, subjectId } = req.body;
  const { examTypeId } = req.params;

  try {
    const studentIds = (await prisma.student.findMany({
      where: { classId, sectionId, status: 'ACTIVE' },
      select: { id: true }
    })).map(s => s.id);

    await prisma.marks.updateMany({
      where: {
        examTypeId,
        subjectId,
        studentId: { in: studentIds }
      },
      data: {
        isLocked: true
      }
    });

    res.json({ success: true, message: 'Marks locked successfully. No further edits are allowed.' });
  } catch (error: any) {
    res.status(500).json({ message: 'Locking failed', error: error.message });
  }
});

// REPORT CARD METRICS
router.get('/report-card/:studentId/:examTypeId', authenticateToken as any, async (req, res) => {
  const { studentId, examTypeId } = req.params;
  const academicYearId = req.headers['x-academic-year-id'] as string || '11111111-1111-1111-1111-111111111111';

  try {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        class: true,
        section: true,
        school: true
      }
    });

    if (!student) return res.status(404).json({ message: 'Student not found' });

    const marks = await prisma.marks.findMany({
      where: { studentId, examTypeId, academicYearId },
      include: { subject: true }
    });

    const attendance = await prisma.attendance.findMany({
      where: { studentId, academicYearId }
    });

    const workingDays = attendance.length;
    const presentDays = attendance.filter(a => a.status === 'PRESENT' || a.status === 'LATE' || a.status === 'ON_DUTY').length;

    res.json({
      student,
      marks,
      attendance: {
        workingDays,
        presentDays,
        percentage: workingDays > 0 ? ((presentDays / workingDays) * 100).toFixed(2) : '100.00'
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to load report card', error: error.message });
  }
});

export default router;
