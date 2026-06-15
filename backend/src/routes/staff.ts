import { Router } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../utils/db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { authorizeRoles } from '../middleware/rbac';
import { logAuditEvent } from '../middleware/audit';
import { EmployeeType, StaffStatus, Category, Gender } from '@prisma/client';

const router = Router();

const parseNum = (val: any): number => {
  if (val === undefined || val === null || String(val).trim() === '') return 0;
  const parsed = parseFloat(val);
  return isNaN(parsed) ? 0 : parsed;
};

const parseNumInt = (val: any): number => {
  if (val === undefined || val === null || String(val).trim() === '') return 0;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? 0 : parsed;
};

// LIST ALL STAFF
router.get('/', authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  const { department, search, limit, cursor, status } = req.query;
  const schoolId = req.user?.schoolId;

  try {
    const filters: any = { schoolId };
    if (department) filters.department = department as string;
    if (status) {
      if (status === 'INACTIVE' || status === 'DEACTIVE') {
        filters.status = { not: 'ACTIVE' };
      } else {
        filters.status = status as StaffStatus;
      }
    }
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
    if (email) {
      const existingEmail = await prisma.user.findFirst({
        where: { email }
      });
      if (existingEmail) {
        return res.status(400).json({ message: 'Email address is already registered to another user' });
      }
    }

    if (mobile) {
      const existingMobile = await prisma.user.findFirst({
        where: { mobile }
      });
      if (existingMobile) {
        return res.status(400).json({ message: 'Mobile number is already registered to another user' });
      }
    }

    // 1. Next employee ID & SL No
    const lastStaff = await prisma.staff.findFirst({
      where: { schoolId },
      orderBy: { slNo: 'desc' }
    });
    
    let nextSl = (lastStaff?.slNo || 0) + 1;
    let employeeId = `SCH-EMP-${String(nextSl).padStart(3, '0')}`;

    // Loop to ensure we don't hit a unique constraint on username with orphan accounts
    let userExists = await prisma.user.findUnique({
      where: { username: employeeId }
    });
    while (userExists) {
      nextSl++;
      employeeId = `SCH-EMP-${String(nextSl).padStart(3, '0')}`;
      userExists = await prisma.user.findUnique({
        where: { username: employeeId }
      });
    }

    // 2. Create User Credentials (mobile as default username, DOB as pass)
    let dobString = '19900101';
    if (dateOfBirth && !isNaN(Date.parse(dateOfBirth))) {
      dobString = new Date(dateOfBirth).toISOString().split('T')[0].replace(/-/g, '');
    }
    const passwordHash = await bcrypt.hash(dobString, 10);

    // Run both creations inside a transaction
    const staffRecord = await prisma.$transaction(async (tx) => {
      const newUserProfile = await tx.user.create({
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

      return await tx.staff.create({
        data: {
          schoolId,
          userId: newUserProfile.id,
          employeeId,
          slNo: nextSl,
          firstName: firstName.toUpperCase(),
          lastName: lastName.toUpperCase(),
          dateOfBirth: (dateOfBirth && !isNaN(Date.parse(dateOfBirth))) ? new Date(dateOfBirth) : new Date('1990-01-01'),
          gender: (gender || 'MALE') as Gender,
          bloodGroup,
          religion,
          caste,
          category: (category || 'GENERAL') as Category,
          aadhaarNumber: aadhaarNumber || '000000000000',
          panNumber: panNumber?.toUpperCase(),
          photoUrl: photoUrl || null,
          mobile,
          email,
          address: address || '',
          designation: (designation || 'TEACHER').toUpperCase(),
          department: department || 'Science',
          employeeType: (employeeType || 'PERMANENT') as EmployeeType,
          joiningDate: (joiningDate && !isNaN(Date.parse(joiningDate))) ? new Date(joiningDate) : new Date(),
          probationEndDate: probationEndDate && !isNaN(Date.parse(probationEndDate)) ? new Date(probationEndDate) : null,
          experienceYears: parseNumInt(experienceYears),
          basicSalary: parseNum(basicSalary),
          daPercent: parseNum(daPercent),
          hraPercent: parseNum(hraPercent),
          taAmount: parseNum(taAmount),
          pfNumber,
          esicNumber,
          bankAccountNumber,
          bankName: bankName?.toUpperCase(),
          bankIfsc: bankIfsc?.toUpperCase(),
          qualifications: qualifications || [],
          previousExperience: previousExperience || [],
          status: StaffStatus.ACTIVE
        }
      });
    });

    res.status(210).json(staffRecord);
  } catch (error: any) {
    console.error('STAFF REGISTRATION ERROR:', error);
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

// UPDATE STAFF PROFILE
router.put('/:id', authenticateToken as any, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'PRINCIPAL') as any, logAuditEvent('UPDATE_STAFF', 'staff') as any, async (req: AuthenticatedRequest, res) => {
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
    role
  } = req.body;

  try {
    const staffId = req.params.id;
    const existingStaff = await prisma.staff.findUnique({
      where: { id: staffId }
    });
    if (!existingStaff) {
      return res.status(404).json({ message: 'Staff profile not found' });
    }

    if (email) {
      const emailUser = await prisma.user.findFirst({
        where: { email, NOT: { id: existingStaff.userId } }
      });
      if (emailUser) {
        return res.status(400).json({ message: 'Email address is already in use by another user' });
      }
    }

    if (mobile) {
      const mobileUser = await prisma.user.findFirst({
        where: { mobile, NOT: { id: existingStaff.userId } }
      });
      if (mobileUser) {
        return res.status(400).json({ message: 'Mobile number is already in use by another user' });
      }
    }

    // Update corresponding user record
    await prisma.user.update({
      where: { id: existingStaff.userId },
      data: {
        name: `${firstName} ${lastName}`.toUpperCase(),
        email,
        mobile,
        role: role || undefined
      }
    });

    // Update staff record
    const updatedStaff = await prisma.staff.update({
      where: { id: staffId },
      data: {
        firstName: firstName.toUpperCase(),
        lastName: lastName.toUpperCase(),
        dateOfBirth: (dateOfBirth && !isNaN(Date.parse(dateOfBirth))) ? new Date(dateOfBirth) : undefined,
        gender: gender ? (gender as Gender) : undefined,
        bloodGroup,
        religion,
        caste,
        category: category ? (category as Category) : undefined,
        aadhaarNumber,
        panNumber: panNumber?.toUpperCase(),
        photoUrl: photoUrl || undefined,
        mobile,
        email,
        address: address !== undefined ? address : undefined,
        designation: designation ? designation.toUpperCase() : undefined,
        department,
        employeeType: employeeType ? (employeeType as EmployeeType) : undefined,
        joiningDate: (joiningDate && !isNaN(Date.parse(joiningDate))) ? new Date(joiningDate) : undefined,
        probationEndDate: probationEndDate && !isNaN(Date.parse(probationEndDate)) ? new Date(probationEndDate) : null,
        experienceYears: experienceYears !== undefined ? parseNumInt(experienceYears) : undefined,
        basicSalary: basicSalary !== undefined ? parseNum(basicSalary) : undefined,
        daPercent: daPercent !== undefined ? parseNum(daPercent) : undefined,
        hraPercent: hraPercent !== undefined ? parseNum(hraPercent) : undefined,
        taAmount: taAmount !== undefined ? parseNum(taAmount) : undefined,
        pfNumber,
        esicNumber,
        bankAccountNumber,
        bankName: bankName?.toUpperCase(),
        bankIfsc: bankIfsc?.toUpperCase(),
        qualifications: qualifications || undefined,
        previousExperience: previousExperience || undefined
      }
    });

    res.json(updatedStaff);
  } catch (error: any) {
    console.error('STAFF UPDATE ERROR:', error);
    res.status(500).json({ message: 'Failed to update staff profile', error: error.message });
  }
});

// TOGGLE STAFF STATUS
router.put('/:id/status', authenticateToken as any, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'PRINCIPAL') as any, logAuditEvent('UPDATE_STAFF_STATUS', 'staff') as any, async (req: AuthenticatedRequest, res) => {
  const { status, statusReason } = req.body; // e.g. ACTIVE, RESIGNED, etc. and statusReason
  if (!status) return res.status(400).json({ message: 'Status is required' });

  try {
    const staffId = req.params.id;
    const existingStaff = await prisma.staff.findUnique({
      where: { id: staffId }
    });
    if (!existingStaff) {
      return res.status(404).json({ message: 'Staff profile not found' });
    }

    const isNowActive = status === 'ACTIVE';

    // Update user active status
    await prisma.user.update({
      where: { id: existingStaff.userId },
      data: { isActive: isNowActive }
    });

    // Update staff status
    const updatedStaff = await prisma.staff.update({
      where: { id: staffId },
      data: { 
        status: status as StaffStatus,
        statusReason: isNowActive ? null : statusReason || null
      }
    });

    res.json(updatedStaff);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to update staff status', error: error.message });
  }
});

export default router;
