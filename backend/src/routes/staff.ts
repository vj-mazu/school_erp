import { Router } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../utils/db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { authorizeRoles } from '../middleware/rbac';
import { logAuditEvent } from '../middleware/audit';
import { EmployeeType, StaffStatus, Category, Gender } from '@prisma/client';

const router = Router();

// LIST ALL STAFF
router.get('/', authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  const { department, search, limit, cursor } = req.query;
  const schoolId = req.user?.schoolId;

  try {
    const filters: any = { schoolId };
    if (department) filters.department = department as string;
    if (search) {
      filters.OR = [
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { employeeId: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    if (limit || cursor) {
      const takeCount = limit ? parseInt(limit as string, 10) : 50;
      const queryArgs: any = {
        where: filters,
        take: takeCount + 1,
        include: {
          user: true,
          sectionsTaught: { include: { class: true } }
        },
        orderBy: { id: 'asc' }
      };

      if (cursor) {
        queryArgs.cursor = { id: cursor as string };
        queryArgs.skip = 1;
      }

      const staff = await prisma.staff.findMany(queryArgs);
      let nextCursor: string | null = null;
      if (staff.length > takeCount) {
        const nextItem = staff.pop();
        nextCursor = nextItem?.id || null;
      }

      return res.json({ items: staff, nextCursor });
    }

    const staff = await prisma.staff.findMany({
      where: filters,
      include: {
        user: true,
        sectionsTaught: { include: { class: true } }
      },
      orderBy: { slNo: 'asc' }
    });

    res.json(staff);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to retrieve staff', error: error.message });
  }
});

// GET SINGLE STAFF PROFILE
router.get('/:id', authenticateToken as any, async (req, res) => {
  try {
    const profile = await prisma.staff.findUnique({
      where: { id: req.params.id },
      include: {
        user: true,
        subjectAssignments: {
          include: {
            subject: true,
            section: { include: { class: true } }
          }
        }
      }
    });

    if (!profile) return res.status(404).json({ message: 'Staff profile not found' });
    res.json(profile);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to load profile', error: error.message });
  }
});

// ADD NEW STAFF
router.post('/', authenticateToken as any, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'PRINCIPAL') as any, logAuditEvent('CREATE_STAFF', 'staff') as any, async (req: AuthenticatedRequest, res) => {
  const schoolId = req.user?.schoolId;
  if (!schoolId) return res.status(400).json({ message: 'School context missing' });

  const {
    firstName,
    lastName,
    dateOfBirth,
    gender,
    bloodGroup,
    religion,
    caste,
    category,
    aadhaarNumber,
    panNumber,
    mobile,
    email,
    address,
    designation,
    department,
    employeeType,
    joiningDate,
    probationEndDate,
    experienceYears,
    basicSalary,
    daPercent,
    hraPercent,
    taAmount,
    pfNumber,
    esicNumber,
    bankAccountNumber,
    bankName,
    bankIfsc,
    qualifications,
    previousExperience,
    photoUrl,
    role // e.g. CLASS_TEACHER, SUBJECT_TEACHER, ACCOUNTANT, PRINCIPAL
  } = req.body;

  try {
    // 1. Next employee ID & SL No
    const lastStaff = await prisma.staff.findFirst({
      where: { schoolId },
      orderBy: { slNo: 'desc' }
    });
    const nextSl = (lastStaff?.slNo || 0) + 1;
    const employeeId = `SCH-EMP-${String(nextSl).padStart(3, '0')}`;

    // 2. Create User Credentials (mobile as default username, DOB as pass)
    const dobString = new Date(dateOfBirth).toISOString().split('T')[0].replace(/-/g, '');
    const passwordHash = await bcrypt.hash(dobString, 10);

    const newUserProfile = await prisma.user.create({
      data: {
        schoolId,
        name: `${firstName} ${lastName}`.toUpperCase(),
        username: employeeId,
        email,
        mobile,
        passwordHash,
        role: role || 'SUBJECT_TEACHER',
        isActive: true
      }
    });

    // 3. Create Staff Record
    const staffRecord = await prisma.staff.create({
      data: {
        schoolId,
        userId: newUserProfile.id,
        employeeId,
        slNo: nextSl,
        firstName: firstName.toUpperCase(),
        lastName: lastName.toUpperCase(),
        dateOfBirth: new Date(dateOfBirth),
        gender: gender as Gender,
        bloodGroup,
        religion,
        caste,
        category: category as Category,
        aadhaarNumber, // Ideally encrypt similarly to student
        panNumber: panNumber?.toUpperCase(),
        photoUrl: photoUrl || null,
        mobile,
        email,
        address,
        designation,
        department,
        employeeType: employeeType as EmployeeType,
        joiningDate: new Date(joiningDate),
        probationEndDate: probationEndDate ? new Date(probationEndDate) : null,
        experienceYears: experienceYears ? parseInt(experienceYears) : 0,
        basicSalary: parseFloat(basicSalary || 0),
        daPercent: parseFloat(daPercent || 0),
        hraPercent: parseFloat(hraPercent || 0),
        taAmount: parseFloat(taAmount || 0),
        pfNumber,
        esicNumber,
        bankAccountNumber,
        bankName,
        bankIfsc,
        qualifications: qualifications || [],
        previousExperience: previousExperience || [],
        status: StaffStatus.ACTIVE
      }
    });

    res.status(210).json(staffRecord);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to register staff', error: error.message });
  }
});

// GET TIMETABLE FOR STAFF
router.get('/:id/timetable', authenticateToken as any, async (req, res) => {
  try {
    const timetable = await prisma.timetable.findMany({
      where: { staffId: req.params.id },
      include: {
        section: { include: { class: true } },
        subject: true
      },
      orderBy: [
        { dayOfWeek: 'asc' },
        { periodNumber: 'asc' }
      ]
    });
    res.json(timetable);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch timetable', error: error.message });
  }
});

// ASSIGN SUBJECTS TO STAFF
router.post('/assign-subjects', authenticateToken as any, authorizeRoles('SUPER_ADMIN', 'PRINCIPAL') as any, logAuditEvent('ASSIGN_STAFF_SUBJECT', 'staff_subject_assignments') as any, async (req: AuthenticatedRequest, res) => {
  const { staffId, subjectId, sectionId, academicYearId } = req.body;
  if (!staffId || !subjectId || !sectionId || !academicYearId) {
    return res.status(400).json({ message: 'Missing assignment parameters' });
  }

  try {
    const assignment = await prisma.staffSubjectAssignment.create({
      data: {
        staffId,
        subjectId,
        sectionId,
        academicYearId
      }
    });
    res.json(assignment);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to assign subject', error: error.message });
  }
});

export default router;
