import { Router } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../utils/db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { authorizeRoles } from '../middleware/rbac';
import { logAuditEvent } from '../middleware/audit';
import { encrypt, maskAadhaar } from '../utils/encryption';
import { sendSms } from '../utils/sms';
import { Board, StudentStatus, MediumOfInstruction, Category, Gender, BloodGroup, GuardianType } from '@prisma/client';

const router = Router();

function toTitleCase(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// GENERATE NEXT ADMISSION NUMBER
router.get('/admission-number', authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) return res.status(400).json({ message: 'School Context Missing' });

    // Fetch school code from school
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    const code = school ? school.diseCode.slice(-4) : 'SCH';
    
    // Fetch current active year
    const activeYear = await prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true }
    });
    const yearStr = activeYear ? activeYear.name : '2025-26';

    // Count students to find next sl_no
    const lastStudent = await prisma.student.findFirst({
      where: { schoolId },
      orderBy: { slNo: 'desc' }
    });

    const nextSl = (lastStudent?.slNo || 0) + 1;
    const padNumber = String(nextSl).padStart(4, '0');
    const admissionNo = `${code}/${yearStr}/${padNumber}`;

    res.json({ admissionNumber: admissionNo, slNo: nextSl });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to generate admission number', error: error.message });
  }
});

// LIST STUDENTS
router.get('/', authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  const { classId, sectionId, status, search, rteStudent, admissionNumber, limit, cursor } = req.query;
  const schoolId = req.user?.schoolId;
  const academicYearId = req.headers['x-academic-year-id'] as string || '11111111-1111-1111-1111-111111111111';

  try {
    // Find all academic years of the school, sorted chronologically
    const academicYears = await prisma.academicYear.findMany({
      where: { schoolId },
      orderBy: { startDate: 'asc' }
    });

    const currentYearIndex = academicYears.findIndex(y => y.id === academicYearId);

    // Only carry forward/promote if there is a chronologically preceding academic year in the database
    // and if the current academic year is completely empty of students (run promotion only once)
    const targetStudentsCount = await prisma.student.count({
      where: { schoolId, academicYearId }
    });

    if (currentYearIndex > 0 && targetStudentsCount === 0) {
      const sourceYear = academicYears[currentYearIndex - 1];

      // Fetch all active students from the preceding year along with their guardians and current class details
      const activeStudentsToCopy = await prisma.student.findMany({
        where: {
          schoolId,
          academicYearId: sourceYear.id,
          status: 'ACTIVE'
        },
        include: {
          guardians: true,
          class: true,
          section: true
        }
      });

      // Fetch all classes of this school to perform sequential promotion lookup
      const classesList = await prisma.class.findMany({
        where: { schoolId },
        include: { sections: true },
        orderBy: { orderIndex: 'asc' }
      });

      for (const st of activeStudentsToCopy) {
        // Check if this student already has a record in the target year context
        const existsInTarget = await prisma.student.findFirst({
          where: {
            userId: st.userId,
            academicYearId: academicYearId
          }
        });

        if (!existsInTarget) {
          // Find the student's next chronological class (sequential promotion)
          const currentClassIndex = classesList.findIndex(c => c.id === st.classId);
          let targetClassId = st.classId;
          let targetSectionId = st.sectionId;
          let newStatus = st.status; // defaults to ACTIVE

          if (currentClassIndex !== -1 && currentClassIndex < classesList.length - 1) {
            // Promote to next higher class in the list
            const nextClass = classesList[currentClassIndex + 1];
            targetClassId = nextClass.id;

            // Attempt to auto-map section to the same section name in the new class (e.g. Section "A" -> "A")
            if (st.section) {
              const matchingSection = nextClass.sections.find(s => s.name.toUpperCase() === st.section!.name.toUpperCase());
              if (matchingSection) {
                targetSectionId = matchingSection.id;
              } else if (nextClass.sections.length > 0) {
                // Default to the first section if exact name match isn't found
                const sortedSections = [...nextClass.sections].sort((a, b) => a.name.localeCompare(b.name));
                targetSectionId = sortedSections[0].id;
              } else {
                targetSectionId = null;
              }
            } else {
              targetSectionId = null;
            }
          } else if (currentClassIndex === classesList.length - 1) {
            // Highest class reached: Mark as ALUMNI in the new year context
            newStatus = 'ALUMNI';
            targetSectionId = null;
          }

          await prisma.student.create({
            data: {
              schoolId: st.schoolId,
              userId: st.userId,
              admissionNumber: st.admissionNumber,
              satsNumber: st.satsNumber,
              slNo: st.slNo,
              academicYearId: academicYearId,
              firstName: st.firstName,
              lastName: st.lastName,
              fullNameAsPerAadhaar: st.fullNameAsPerAadhaar,
              dateOfBirth: st.dateOfBirth,
              gender: st.gender,
              bloodGroup: st.bloodGroup,
              religion: st.religion,
              caste: st.caste,
              category: st.category,
              nationality: st.nationality,
              motherTongue: st.motherTongue,
              aadhaarNumber: st.aadhaarNumber,
              aadhaarMasked: st.aadhaarMasked,
              photoUrl: st.photoUrl,
              classId: targetClassId,
              sectionId: targetSectionId,
              rollNumber: null, // Reset roll numbers to allow re-assignment in the new class cohort
              mediumOfInstruction: st.mediumOfInstruction,
              board: st.board,
              house: st.house,
              rteStudent: st.rteStudent,
              address: st.address,
              city: st.city,
              taluka: st.taluka,
              village: st.village,
              pincode: st.pincode,
              status: newStatus,
              statusReason: st.statusReason,
              admissionDate: st.admissionDate,
              knownAllergies: st.knownAllergies,
              medicalConditions: st.medicalConditions,
              disabilityType: st.disabilityType,
              cwsn: st.cwsn,
              guardians: {
                create: st.guardians.map(g => ({
                  type: g.type,
                  name: g.name,
                  relation: g.relation,
                  occupation: g.occupation,
                  annualIncome: g.annualIncome,
                  qualification: g.qualification,
                  aadhaarNumber: g.aadhaarNumber,
                  mobile: g.mobile,
                  whatsappNumber: g.whatsappNumber,
                  email: g.email,
                  isPrimaryContact: g.isPrimaryContact,
                  address: g.address,
                  officeAddress: g.officeAddress
                }))
              }
            }
          });
        }
      }
    }

    const filters: any = { schoolId, academicYearId };

    if (classId) filters.classId = classId as string;
    if (sectionId) filters.sectionId = sectionId as string;
    if (status) filters.status = status as StudentStatus;
    if (rteStudent) filters.rteStudent = rteStudent === 'true';
    if (admissionNumber) {
      filters.admissionNumber = { contains: admissionNumber as string, mode: 'insensitive' };
    }
    
    if (search) {
      filters.OR = [
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { admissionNumber: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    if (limit || cursor) {
      const takeCount = limit ? parseInt(limit as string, 10) : 50;
      const queryArgs: any = {
        where: filters,
        take: takeCount + 1,
        include: {
          class: true,
          section: true,
          guardians: true
        },
        orderBy: { id: 'asc' }
      };

      if (cursor) {
        queryArgs.cursor = { id: cursor as string };
        queryArgs.skip = 1;
      }

      const students = await prisma.student.findMany(queryArgs);
      let nextCursor: string | null = null;
      if (students.length > takeCount) {
        const nextItem = students.pop();
        nextCursor = nextItem?.id || null;
      }

      return res.json({ items: students, nextCursor });
    }

    const students = await prisma.student.findMany({
      where: filters,
      include: {
        class: true,
        section: true,
        guardians: true
      },
      orderBy: [
        { class: { orderIndex: 'asc' } },
        { section: { name: 'asc' } },
        { rollNumber: 'asc' }
      ]
    });

    res.json(students);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to retrieve students', error: error.message });
  }
});

// GET SINGLE STUDENT PROFILE
router.get('/:id', authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.params.id },
      include: {
        class: true,
        section: true,
        guardians: true,
        user: true
      }
    });

    if (!student) return res.status(404).json({ message: 'Student not found' });
    res.json(student);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to load student profile', error: error.message });
  }
});

// CREATE STUDENT
router.post('/', authenticateToken as any, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'PRINCIPAL') as any, logAuditEvent('CREATE_STUDENT', 'students') as any, async (req: AuthenticatedRequest, res) => {
  const schoolId = req.user?.schoolId;
  if (!schoolId) return res.status(400).json({ message: 'School context missing' });

  const {
    firstName,
    lastName,
    fullNameAsPerAadhaar,
    dateOfBirth,
    gender,
    bloodGroup,
    religion,
    caste,
    category,
    nationality,
    motherTongue,
    aadhaarNumber,
    classId,
    sectionId,
    rollNumber,
    mediumOfInstruction,
    board,
    house,
    rteStudent,
    satsNumber,
    address,
    city,
    taluka,
    village,
    pincode,
    previousSchoolName,
    previousSchoolTcNumber,
    previousClassPassed,
    admissionDate,
    knownAllergies,
    medicalConditions,
    cwsn,
    disabilityType,
    photoUrl,
    guardians // Array of guardians: [{type, name, relation, mobile, email, ...}]
  } = req.body;

  const academicYearId = req.headers['x-academic-year-id'] as string || '11111111-1111-1111-1111-111111111111';

  try {
    // Enforce manual admission number as requested
    let admissionNumber = req.body.admissionNumber;
    if (!admissionNumber) {
      return res.status(400).json({ message: 'Admission Number is required and must be manually entered.' });
    }
    admissionNumber = admissionNumber.trim().toUpperCase();

    // Check if admission number already exists in students or users table
    const existingStudent = await prisma.student.findFirst({
      where: { admissionNumber, academicYearId }
    });
    const existingUser = await prisma.user.findUnique({
      where: { username: admissionNumber }
    });
    if (existingStudent || existingUser) {
      return res.status(400).json({ message: `Admission Number "${admissionNumber}" already exists in the system. Please use a unique Admission Number.` });
    }

    const formattedSats = req.body.satsNumber ? req.body.satsNumber.trim().toUpperCase() : null;

    // Check if SATS number already exists (if provided)
    if (formattedSats) {
      const existingSats = await prisma.student.findFirst({
        where: { satsNumber: formattedSats, academicYearId }
      });
      if (existingSats) {
        return res.status(400).json({ message: `SATS Number "${formattedSats}" already exists in the system.` });
      }
    }

    // Check if Roll Number is unique in the class and section
    if (rollNumber) {
      const parsedRoll = parseInt(rollNumber, 10);
      const existingRoll = await prisma.student.findFirst({
        where: {
          academicYearId,
          classId,
          sectionId: sectionId || null,
          rollNumber: parsedRoll,
          status: 'ACTIVE'
        }
      });
      if (existingRoll) {
        return res.status(400).json({ message: `Roll number "${rollNumber}" is already assigned to another active student in this class and section.` });
      }
    }

    // Check if Aadhaar number is unique in the system
    if (aadhaarNumber && aadhaarNumber !== '000000000000' && aadhaarNumber.trim() !== '') {
      const checkEncrypted = encrypt(aadhaarNumber);
      const existingAadhaar = await prisma.student.findFirst({
        where: { aadhaarNumber: checkEncrypted }
      });
      if (existingAadhaar) {
        return res.status(400).json({ message: 'Aadhaar Card number is already registered to another student profile.' });
      }
    }

    const lastStudent = await prisma.student.findFirst({
      where: { schoolId },
      orderBy: { slNo: 'desc' }
    });
    const nextSl = (lastStudent?.slNo || 0) + 1;

    // 2. Encrypt Aadhaar & Mask
    const encryptedAadhaar = encrypt(aadhaarNumber || '000000000000');
    const maskedAadhaar = maskAadhaar(aadhaarNumber || '000000000000');

    // 3. Find Primary Guardian info to create user profile
    const primaryG = guardians.find((g: any) => g.isPrimaryContact) || guardians[0];
    if (!primaryG || !primaryG.mobile) {
      return res.status(400).json({ message: 'Primary contact guardian with mobile is required' });
    }

    // 4. Create Student Login User Profile
    const studentUsername = primaryG.mobile;
    const dobString = new Date(dateOfBirth).toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD
    const passwordHash = await bcrypt.hash(dobString, 10); // mobile as user, DOB YYYYMMDD as default password

    // Check if user credentials already exist for this mobile (e.g. sharing with other sibling)
    let parentUser = await prisma.user.findUnique({ where: { mobile: primaryG.mobile } });
    if (!parentUser) {
      parentUser = await prisma.user.create({
        data: {
          schoolId,
          name: toTitleCase(primaryG.name),
          username: primaryG.mobile,
          email: primaryG.email || `${primaryG.mobile}@shantiniketan.edu`,
          mobile: primaryG.mobile,
          passwordHash,
          role: 'PARENT',
          isActive: true
        }
      });
    }

    // Create a student user profile too
    const studentEmail = `${admissionNumber.replace(/\//g, '_')}@shantiniketan.edu`;
    const studentUser = await prisma.user.create({
      data: {
        schoolId,
        name: toTitleCase(`${firstName} ${lastName}`),
        username: admissionNumber,
        email: studentEmail,
        mobile: null,
        passwordHash,
        role: 'STUDENT',
        isActive: true
      }
    });

    // 5. Create Student record
    const newStudent = await prisma.student.create({
      data: {
        schoolId,
        userId: studentUser.id,
        admissionNumber,
        satsNumber: formattedSats,
        slNo: nextSl,
        academicYearId,
        firstName: toTitleCase(firstName),
        lastName: toTitleCase(lastName),
        fullNameAsPerAadhaar: toTitleCase(fullNameAsPerAadhaar),
        dateOfBirth: new Date(dateOfBirth),
        gender: gender as Gender,
        bloodGroup: (bloodGroup || 'UNKNOWN') as BloodGroup,
        religion,
        caste,
        category: category as Category,
        nationality: nationality || 'Indian',
        motherTongue,
        aadhaarNumber: encryptedAadhaar,
        aadhaarMasked: maskedAadhaar,
        classId,
        sectionId: sectionId || null,
        rollNumber: rollNumber ? parseInt(rollNumber) : undefined,
        mediumOfInstruction: mediumOfInstruction as MediumOfInstruction,
        board: board as Board,
        house,
        rteStudent: !!rteStudent,
        photoUrl: photoUrl || null,
        address,
        city: city ? toTitleCase(city) : null,
        taluka: taluka ? toTitleCase(taluka) : null,
        village: village ? toTitleCase(village) : null,
        pincode,
        previousSchoolName,
        previousSchoolTcNumber,
        previousClassPassed,
        status: StudentStatus.ACTIVE,
        admissionDate: admissionDate ? new Date(admissionDate) : new Date(),
        knownAllergies,
        medicalConditions,
        cwsn: !!cwsn,
        disabilityType: !!cwsn ? disabilityType : null,
        guardians: {
          create: guardians.map((g: any) => ({
            type: g.type as GuardianType,
            name: toTitleCase(g.name),
            relation: g.relation,
            occupation: g.occupation,
            annualIncome: g.annualIncome ? parseFloat(g.annualIncome) : null,
            qualification: g.qualification,
            aadhaarNumber: g.aadhaar ? encrypt(g.aadhaar) : null,
            mobile: g.mobile,
            whatsappNumber: g.whatsappNumber,
            email: g.email,
            isPrimaryContact: !!g.isPrimaryContact,
            address: g.address
          }))
        }
      }
    });

    // Send SMS message
    const msg = `Welcome to Shantiniketan Public School. Your child ${firstName} has been admitted to ${newStudent.admissionNumber}. Parent Login credentials: User: ${primaryG.mobile}, Password: ${dobString}.`;
    await sendSms(primaryG.mobile, msg);

    res.status(210).json(newStudent);
  } catch (error: any) {
    console.error('ADMISSION ERROR:', error);
    res.status(500).json({ message: 'Admission failed', error: error.message });
  }
});

// UPDATE STUDENT PROFILE
router.put('/:id', authenticateToken as any, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'PRINCIPAL', 'ACCOUNTANT') as any, logAuditEvent('UPDATE_STUDENT', 'students') as any, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  try {
    const currentStudent = await prisma.student.findUnique({
      where: { id },
      select: { userId: true, classId: true, sectionId: true, academicYearId: true, admissionNumber: true }
    });

    if (!currentStudent) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // 1. Admission Number uniqueness check
    if (req.body.admissionNumber) {
      const admissionNumber = req.body.admissionNumber.trim().toUpperCase();
      if (admissionNumber !== currentStudent.admissionNumber) {
        const existingStudent = await prisma.student.findFirst({
          where: { admissionNumber, academicYearId: currentStudent.academicYearId, id: { not: id } }
        });
        const existingUser = await prisma.user.findFirst({
          where: { username: admissionNumber, id: { not: currentStudent.userId } }
        });
        if (existingStudent || existingUser) {
          return res.status(400).json({ message: `Admission Number "${admissionNumber}" already exists in the system. Please use a unique Admission Number.` });
        }
      }
    }

    // 2. SATS number uniqueness check
    if (req.body.satsNumber) {
      const satsNumber = req.body.satsNumber.trim().toUpperCase();
      const existingSats = await prisma.student.findFirst({
        where: { satsNumber, academicYearId: currentStudent.academicYearId, id: { not: id } }
      });
      if (existingSats) {
        return res.status(400).json({ message: `SATS Number "${satsNumber}" already exists in the system.` });
      }
    }

    // 3. Roll number uniqueness check within same class, section, and academic year
    const targetClassId = req.body.classId !== undefined ? req.body.classId : currentStudent.classId;
    const targetSectionId = req.body.sectionId !== undefined ? req.body.sectionId : currentStudent.sectionId;
    const rollNumberVal = req.body.rollNumber !== undefined ? req.body.rollNumber : undefined;

    if (rollNumberVal) {
      const parsedRoll = parseInt(rollNumberVal, 10);
      const existingRoll = await prisma.student.findFirst({
        where: {
          academicYearId: currentStudent.academicYearId,
          classId: targetClassId,
          sectionId: targetSectionId || null,
          rollNumber: parsedRoll,
          status: 'ACTIVE',
          id: { not: id }
        }
      });
      if (existingRoll) {
        return res.status(400).json({ message: `Roll number "${parsedRoll}" is already assigned to another active student in this class and section.` });
      }
    }

    // 4. Aadhaar uniqueness check
    if (req.body.aadhaarNumber && req.body.aadhaarNumber !== '000000000000' && req.body.aadhaarNumber.trim() !== '') {
      const checkEncrypted = encrypt(req.body.aadhaarNumber);
      const existingAadhaar = await prisma.student.findFirst({
        where: {
          aadhaarNumber: checkEncrypted,
          id: { not: id }
        }
      });
      if (existingAadhaar) {
        return res.status(400).json({ message: 'Aadhaar Card number is already registered to another student profile.' });
      }
    }

    // Sync student user username if admissionNumber changes
    if (req.body.admissionNumber) {
      const newAdmissionNumber = req.body.admissionNumber.trim().toUpperCase();
      if (newAdmissionNumber !== currentStudent.admissionNumber) {
        await prisma.user.update({
          where: { id: currentStudent.userId },
          data: {
            username: newAdmissionNumber,
            email: `${newAdmissionNumber.replace(/\//g, '_')}@shantiniketan.edu`
          }
        });
      }
    }

    if (req.body.guardians && Array.isArray(req.body.guardians)) {
      await prisma.guardian.deleteMany({ where: { studentId: id } });
    }

    const encryptedAadhaar = req.body.aadhaarNumber ? encrypt(req.body.aadhaarNumber) : undefined;
    const maskedAadhaar = req.body.aadhaarNumber ? maskAadhaar(req.body.aadhaarNumber) : undefined;

    const updated = await prisma.student.update({
      where: { id },
      data: {
        firstName: req.body.firstName ? toTitleCase(req.body.firstName) : undefined,
        lastName: req.body.lastName ? toTitleCase(req.body.lastName) : undefined,
        fullNameAsPerAadhaar: req.body.fullNameAsPerAadhaar ? toTitleCase(req.body.fullNameAsPerAadhaar) : undefined,
        dateOfBirth: req.body.dateOfBirth ? new Date(req.body.dateOfBirth) : undefined,
        gender: req.body.gender,
        category: req.body.category,
        admissionNumber: req.body.admissionNumber?.trim().toUpperCase(),
        satsNumber: req.body.satsNumber ? req.body.satsNumber.trim().toUpperCase() : null,
        rollNumber: req.body.rollNumber ? parseInt(req.body.rollNumber) : undefined,
        classId: req.body.classId,
        sectionId: req.body.sectionId || null,
        mediumOfInstruction: req.body.mediumOfInstruction,
        aadhaarNumber: encryptedAadhaar,
        aadhaarMasked: maskedAadhaar,
        address: req.body.address,
        city: req.body.city ? toTitleCase(req.body.city) : undefined,
        taluka: req.body.taluka ? toTitleCase(req.body.taluka) : undefined,
        village: req.body.village ? toTitleCase(req.body.village) : undefined,
        pincode: req.body.pincode,
        knownAllergies: req.body.knownAllergies,
        medicalConditions: req.body.medicalConditions,
        status: req.body.status as StudentStatus,
        statusReason: req.body.statusReason,
        guardians: req.body.guardians && Array.isArray(req.body.guardians) ? {
          create: req.body.guardians.map((g: any) => ({
            type: g.type as GuardianType,
            name: toTitleCase(g.name),
            relation: g.relation,
            occupation: g.occupation,
            annualIncome: g.annualIncome ? parseFloat(g.annualIncome) : null,
            qualification: g.qualification,
            aadhaarNumber: g.aadhaar ? encrypt(g.aadhaar) : null,
            mobile: g.mobile,
            whatsappNumber: g.whatsappNumber,
            email: g.email,
            isPrimaryContact: !!g.isPrimaryContact,
            address: g.address
          }))
        } : undefined
      }
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: 'Update failed', error: error.message });
  }
});

// TOGGLE STUDENT STATUS (ACTIVE / INACTIVE)
router.put('/:id/status', authenticateToken as any, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'PRINCIPAL') as any, logAuditEvent('UPDATE_STUDENT_STATUS', 'students') as any, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { status, statusReason } = req.body;

  if (!status) {
    return res.status(400).json({ message: 'Status is required' });
  }

  try {
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const updated = await prisma.student.update({
      where: { id },
      data: {
        status: status as StudentStatus,
        statusReason: status === 'ACTIVE' ? null : (statusReason || null)
      }
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: 'Status toggle failed', error: error.message });
  }
});

// SOFT DELETE STUDENT
router.delete('/:id', authenticateToken as any, authorizeRoles('SUPER_ADMIN', 'ADMIN') as any, logAuditEvent('DELETE_STUDENT', 'students') as any, async (req, res) => {
  try {
    await prisma.student.update({
      where: { id: req.params.id },
      data: { status: StudentStatus.TRANSFERRED }
    });
    res.json({ success: true, message: 'Student status updated to TRANSFERRED (soft delete)' });
  } catch (error: any) {
    res.status(500).json({ message: 'Soft delete failed', error: error.message });
  }
});

// BULK PROMOTE STUDENTS
router.post('/promote', authenticateToken as any, authorizeRoles('SUPER_ADMIN', 'PRINCIPAL') as any, logAuditEvent('PROMOTE_STUDENTS', 'students') as any, async (req: AuthenticatedRequest, res) => {
  const { studentIds, targetClassId, targetSectionId, nextAcademicYearId } = req.body;

  if (!studentIds || studentIds.length === 0 || !targetClassId || !targetSectionId || !nextAcademicYearId) {
    return res.status(400).json({ message: 'Missing bulk promotion parameters' });
  }

  try {
    const results = await prisma.student.updateMany({
      where: {
        id: { in: studentIds }
      },
      data: {
        classId: targetClassId,
        sectionId: targetSectionId,
        academicYearId: nextAcademicYearId,
        rollNumber: null // Reset roll numbers so they can be re-assigned
      }
    });

    res.json({ success: true, message: `Successfully promoted ${results.count} students.` });
  } catch (error: any) {
    res.status(500).json({ message: 'Promotion failed', error: error.message });
  }
});

export default router;
