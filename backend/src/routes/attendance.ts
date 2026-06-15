import { Router } from 'express';
import prisma from '../utils/db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { authorizeRoles } from '../middleware/rbac';
import { logAuditEvent } from '../middleware/audit';
import { sendSms } from '../utils/sms';
import { AttendanceStatus, StaffAttendanceStatus, LeaveStatus, ApplicantType, LeaveType } from '@prisma/client';

const router = Router();

// GET STUDENT ATTENDANCE LIST
router.get('/', authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  const { date, classId, sectionId, periodNumber } = req.query;
  const schoolId = req.user?.schoolId;

  if (!date || !classId || !sectionId) {
    return res.status(400).json({ message: 'date, classId, and sectionId are required' });
  }

  try {
    const searchDate = new Date((date as string) + 'T00:00:00.000Z');
    const parsedPeriod = periodNumber ? parseInt(periodNumber as string) : 0;

    // 1. Get all active students in section
    const students = await prisma.student.findMany({
      where: {
        schoolId,
        classId: classId as string,
        sectionId: sectionId as string,
        status: 'ACTIVE'
      },
      orderBy: { rollNumber: 'asc' }
    });

    // 2. Get marked attendance for the date
    const marked = await prisma.attendance.findMany({
      where: {
        sectionId: sectionId as string,
        date: searchDate,
        periodNumber: parsedPeriod
      }
    });

    const markedMap = new Map(marked.map(m => [m.studentId, m]));

    // 3. Merge status
    const result = students.map(st => {
      const record = markedMap.get(st.id);
      return {
        studentId: st.id,
        rollNumber: st.rollNumber,
        firstName: st.firstName,
        lastName: st.lastName,
        photoUrl: st.photoUrl,
        status: record ? record.status : 'PRESENT', // default to PRESENT for grid view speed
        remarks: record ? record.remarks : '',
        attendanceId: record ? record.id : null
      };
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch student list', error: error.message });
  }
});

// BULK MARK STUDENT ATTENDANCE
router.post('/mark', authenticateToken as any, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'PRINCIPAL', 'CLASS_TEACHER', 'SUBJECT_TEACHER') as any, logAuditEvent('MARK_ATTENDANCE', 'attendance') as any, async (req: AuthenticatedRequest, res) => {
  const { date, classId, sectionId, periodNumber, records } = req.body; // records: [{studentId, status, remarks}]
  const schoolId = req.user?.schoolId;
  const academicYearId = req.academicYearId || '11111111-1111-1111-1111-111111111111';

  if (!date || !records || !Array.isArray(records)) {
    return res.status(400).json({ message: 'date and records array are required' });
  }

  try {
    const markDate = new Date(date + 'T00:00:00.000Z');
    const parsedPeriod = periodNumber ? parseInt(periodNumber) : 0;

    const countUpserts = [];
    const absentees: string[] = [];

    for (const rec of records) {
      countUpserts.push(
        prisma.attendance.upsert({
          where: {
            studentId_date_periodNumber: {
              studentId: rec.studentId,
              date: markDate,
              periodNumber: parsedPeriod
            }
          },
          update: {
            status: rec.status as AttendanceStatus,
            remarks: rec.remarks,
            markedBy: req.user?.id
          },
          create: {
            studentId: rec.studentId,
            sectionId: sectionId,
            academicYearId,
            date: markDate,
            status: rec.status as AttendanceStatus,
            remarks: rec.remarks,
            periodNumber: parsedPeriod,
            markedBy: req.user?.id
          }
        })
      );

      if (rec.status === 'ABSENT') {
        absentees.push(rec.studentId);
      }
    }

    await prisma.$transaction(countUpserts);

    // Send SMS to parents of absent students asynchronously
    if (absentees.length > 0) {
      prisma.student.findMany({
        where: { id: { in: absentees } },
        include: { guardians: { where: { isPrimaryContact: true } } }
      }).then(async (students) => {
        const dateStr = markDate.toLocaleDateString('en-GB'); // DD/MM/YYYY
        for (const st of students) {
          const parentG = st.guardians[0];
          if (parentG && parentG.mobile) {
            const msg = `Shantiniketan Public School - Alert: Your child ${st.firstName} ${st.lastName} was marked ABSENT on ${dateStr}. Please submit a leave application if planned.`;
            await sendSms(parentG.mobile, msg);
          }
        }
      }).catch(err => console.error('[ABSENT SMS FAILURE]:', err));
    }

    res.json({ success: true, count: records.length });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to record attendance', error: error.message });
  }
});

// GET ATTENDANCE DEFAULTERS (< 75%)
router.get('/defaulters', authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  const { classId, sectionId } = req.query;
  const schoolId = req.user?.schoolId;
  const academicYearId = req.academicYearId || '11111111-1111-1111-1111-111111111111';

  try {
    // 1. Get all students in scope
    const queryScope: any = { schoolId, status: 'ACTIVE' };
    if (classId) queryScope.classId = classId as string;
    if (sectionId) queryScope.sectionId = sectionId as string;

    const students = await prisma.student.findMany({
      where: queryScope,
      include: {
        class: true,
        section: true,
        attendance: {
          where: { academicYearId }
        }
      }
    });

    // 2. Filter students who have low attendance
    const defaulters = students.map(st => {
      const totalDays = st.attendance.length;
      const presentDays = st.attendance.filter(a => a.status === 'PRESENT' || a.status === 'LATE' || a.status === 'ON_DUTY').length;
      const percentage = totalDays > 0 ? parseFloat(((presentDays / totalDays) * 100).toFixed(2)) : 100.00;

      return {
        id: st.id,
        name: `${st.firstName} ${st.lastName}`,
        admissionNumber: st.admissionNumber,
        class: st.class.name,
        section: st.section?.name || 'N/A',
        totalDays,
        presentDays,
        percentage
      };
    }).filter(d => d.totalDays > 5 && d.percentage < 75.00); // Only trigger warning if we have recorded > 5 sessions

    res.json(defaulters);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to query defaulters', error: error.message });
  }
});

// SUBMIT LEAVE APPLICATION
router.post('/leave', authenticateToken as any, logAuditEvent('APPLY_LEAVE', 'leave_applications') as any, async (req: AuthenticatedRequest, res) => {
  const { fromDate, toDate, leaveType, reason, studentId, staffId, applicantType } = req.body;

  try {
    const application = await prisma.leaveApplication.create({
      data: {
        applicantType: applicantType as ApplicantType,
        studentId: applicantType === 'STUDENT' ? studentId : null,
        staffId: applicantType === 'STAFF' ? staffId : null,
        fromDate: new Date(fromDate),
        toDate: new Date(toDate),
        leaveType: leaveType as LeaveType,
        reason,
        status: LeaveStatus.PENDING
      }
    });

    res.json(application);
  } catch (error: any) {
    res.status(500).json({ message: 'Leave submission failed', error: error.message });
  }
});

// REVIEW LEAVE APPLICATION (APPROVE / REJECT)
router.put('/leave/:id', authenticateToken as any, authorizeRoles('SUPER_ADMIN', 'PRINCIPAL', 'CLASS_TEACHER') as any, logAuditEvent('REVIEW_LEAVE', 'leave_applications') as any, async (req: AuthenticatedRequest, res) => {
  const { status, remarks } = req.body; // APPROVED or REJECTED
  const { id } = req.params;

  try {
    const leave = await prisma.leaveApplication.update({
      where: { id },
      data: {
        status: status as LeaveStatus,
        reviewerRemarks: remarks,
        reviewedBy: req.user?.id,
        reviewedAt: new Date()
      }
    });

    // If approved and it is student leave, mark student attendance on these dates as HOLIDAY/SUNDAY or ON_LEAVE
    // To simplify, we can add leave applications check inside the marking workflow
    res.json(leave);
  } catch (error: any) {
    res.status(500).json({ message: 'Review failed', error: error.message });
  }
});

// GET LEAVES LIST
router.get('/leave', authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  const { status, applicantType } = req.query;
  const schoolId = req.user?.schoolId;

  try {
    const filters: any = {};
    if (status) filters.status = status as LeaveStatus;
    if (applicantType) filters.applicantType = applicantType as ApplicantType;

    const leaves = await prisma.leaveApplication.findMany({
      where: filters,
      include: {
        student: { include: { class: true, section: true } },
        staff: true
      },
      orderBy: { appliedAt: 'desc' }
    });

    res.json(leaves);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to retrieve leaves', error: error.message });
  }
});

export default router;
