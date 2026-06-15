import { PrismaClient, Board, Role, Gender, Category, MediumOfInstruction, StudentStatus, GuardianType, EmployeeType, StaffStatus, SubjectType, LanguageType, FeeType, FeeFrequency } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Shantiniketan Public School database...');

  // Clean up database tables to allow repeated seed runs
  await prisma.auditLog.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.circularAcknowledgement.deleteMany({});
  await prisma.circular.deleteMany({});
  await prisma.idCard.deleteMany({});
  await prisma.certificate.deleteMany({});
  await prisma.transferCertificate.deleteMany({});
  await prisma.feePayment.deleteMany({});
  await prisma.feeInvoice.deleteMany({});
  await prisma.feeConcession.deleteMany({});
  await prisma.feeStructure.deleteMany({});
  await prisma.feeHead.deleteMany({});
  await prisma.homeworkSubmission.deleteMany({});
  await prisma.homework.deleteMany({});
  await prisma.marks.deleteMany({});
  await prisma.examSchedule.deleteMany({});
  await prisma.examType.deleteMany({});
  await prisma.leaveApplication.deleteMany({});
  await prisma.staffAttendance.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.timetable.deleteMany({});
  await prisma.staffSubjectAssignment.deleteMany({});
  await prisma.classSubject.deleteMany({});
  await prisma.subject.deleteMany({});
  await prisma.guardian.deleteMany({});
  await prisma.student.deleteMany({});
  await prisma.staff.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.section.deleteMany({});
  await prisma.class.deleteMany({});
  await prisma.academicYear.deleteMany({});

  // 1. Create Default School
  const school = await prisma.school.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Shantiniketan Public School, Chapetla',
      address: 'Near Main Market, Chapetla, Madhya Pradesh',
      city: 'Chapetla',
      state: 'Madhya Pradesh',
      pincode: '462001',
      phone: '0755-123456',
      email: 'info@shantiniketan.edu.in',
      website: 'www.shantiniketan.edu.in',
      principalName: 'Dr. Ramesh Chandra',
      affiliationNumber: 'MPBSE-AFF-330129',
      diseCode: '23260100101',
      board: Board.STATE,
      logoUrl: null,
      establishedYear: 2005
    }
  });

  // 2. Create Academic Years
  const currentYear = await prisma.academicYear.upsert({
    where: { id: '11111111-1111-1111-1111-111111111111' },
    update: {},
    create: {
      id: '11111111-1111-1111-1111-111111111111',
      schoolId: school.id,
      name: '2025-26',
      startDate: new Date('2025-04-01'),
      endDate: new Date('2026-03-31'),
      isCurrent: true
    }
  });

  const nextYear = await prisma.academicYear.upsert({
    where: { id: '11111111-1111-1111-1111-111111111112' },
    update: {},
    create: {
      id: '11111111-1111-1111-1111-111111111112',
      schoolId: school.id,
      name: '2026-27',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2027-03-31'),
      isCurrent: false
    }
  });

  // 3. Create Classes & Sections
  const classesConfig = [
    { name: 'LKG', numeric: 0, order: 1, sections: ['A', 'B'] },
    { name: 'UKG', numeric: 1, order: 2, sections: ['A', 'B'] },
    { name: 'Class 1', numeric: 2, order: 3, sections: ['A', 'B', 'C'] },
    { name: 'Class 2', numeric: 3, order: 4, sections: ['A', 'B', 'C'] },
    { name: 'Class 3', numeric: 4, order: 5, sections: ['A', 'B', 'C'] },
    { name: 'Class 4', numeric: 5, order: 6, sections: ['A', 'B', 'C'] },
    { name: 'Class 5', numeric: 6, order: 7, sections: ['A', 'B', 'C'] },
    { name: 'Class 6', numeric: 7, order: 8, sections: ['A', 'B', 'C', 'D'] },
    { name: 'Class 7', numeric: 8, order: 9, sections: ['A', 'B', 'C', 'D'] },
    { name: 'Class 8', numeric: 9, order: 10, sections: ['A', 'B', 'C', 'D'] },
    { name: 'Class 9', numeric: 10, order: 11, sections: ['A', 'B', 'C', 'D'] },
    { name: 'Class 10', numeric: 11, order: 12, sections: ['A', 'B', 'C', 'D'] },
  ];

  console.log('Seeding classes and sections...');
  const savedSectionsMap: { [key: string]: string } = {};
  const savedClassesMap: { [key: string]: string } = {};

  for (const cc of classesConfig) {
    const classRecord = await prisma.class.create({
      data: {
        schoolId: school.id,
        name: cc.name,
        numericValue: cc.numeric,
        orderIndex: cc.order
      }
    });

    savedClassesMap[cc.name] = classRecord.id;

    for (const secName of cc.sections) {
      const secRecord = await prisma.section.create({
        data: {
          classId: classRecord.id,
          name: secName,
          roomNumber: `Room-${cc.numeric}-${secName}`,
          maxStudents: 40
        }
      });
      savedSectionsMap[`${cc.name}-${secName}`] = secRecord.id;
    }
  }

  // 4. Create Subjects
  console.log('Seeding subjects...');
  const subjectsData = [
    { name: 'Mathematics', code: 'MATH', type: SubjectType.THEORY },
    { name: 'Science', code: 'SCI', type: SubjectType.BOTH },
    { name: 'English', code: 'ENG', type: SubjectType.THEORY, language: LanguageType.FIRST },
    { name: 'Hindi', code: 'HIN', type: SubjectType.THEORY, language: LanguageType.SECOND },
    { name: 'Social Science', code: 'SST', type: SubjectType.THEORY },
    { name: 'Physical Education', code: 'PE', type: SubjectType.CO_SCHOLASTIC },
  ];

  const subjectsMap: { [key: string]: string } = {};
  for (const sub of subjectsData) {
    const subRecord = await prisma.subject.create({
      data: {
        schoolId: school.id,
        name: sub.name,
        code: sub.code,
        subjectType: sub.type,
        languageType: sub.language || LanguageType.NA
      }
    });
    subjectsMap[sub.code] = subRecord.id;

    // Map these subjects to all classes except LKG/UKG which only have main themes
    for (const cc of classesConfig) {
      if (cc.numeric >= 2) {
        await prisma.classSubject.create({
          data: {
            classId: savedClassesMap[cc.name],
            subjectId: subRecord.id,
            maxMarksTheory: sub.type === SubjectType.BOTH ? 80 : 100,
            maxMarksPractical: sub.type === SubjectType.BOTH ? 20 : 0,
            passingMarksTheory: sub.type === SubjectType.BOTH ? 26 : 33,
            passingMarksPractical: sub.type === SubjectType.BOTH ? 7 : 0
          }
        });
      }
    }
  }

  // 5. Create Fee Heads
  console.log('Seeding Fee Heads...');
  const tuitionHead = await prisma.feeHead.create({
    data: { schoolId: school.id, name: 'Tuition Fee', feeType: FeeType.TUITION, isMandatory: true }
  });
  const devHead = await prisma.feeHead.create({
    data: { schoolId: school.id, name: 'Development Fee', feeType: FeeType.DEVELOPMENT, isMandatory: true }
  });
  const examHead = await prisma.feeHead.create({
    data: { schoolId: school.id, name: 'Exam Fee', feeType: FeeType.EXAM, isMandatory: true }
  });

  // Assign a basic tuition fee structure for LKG & Class 1
  await prisma.feeStructure.create({
    data: {
      schoolId: school.id,
      academicYearId: currentYear.id,
      classId: savedClassesMap['LKG'],
      feeHeadId: tuitionHead.id,
      amount: 2500.00,
      frequency: FeeFrequency.MONTHLY,
      dueDay: 10,
      lateFinePerDay: 10.00
    }
  });

  await prisma.feeStructure.create({
    data: {
      schoolId: school.id,
      academicYearId: currentYear.id,
      classId: savedClassesMap['Class 1'],
      feeHeadId: tuitionHead.id,
      amount: 3500.00,
      frequency: FeeFrequency.MONTHLY,
      dueDay: 10,
      lateFinePerDay: 15.00
    }
  });

  // 6. Create Users for all roles
  console.log('Seeding default role users...');
  const passwordHash = await bcrypt.hash('password123', 10);

  const rolesConfig = [
    { role: Role.SUPER_ADMIN, username: 'superadmin', email: 'superadmin@shantiniketan.edu', mobile: '9999999999', name: 'Super Admin User' },
    { role: Role.PRINCIPAL, username: 'principal', email: 'principal@shantiniketan.edu', mobile: '8888888888', name: 'Dr. Ramesh Chandra' },
    { role: Role.ADMIN, username: 'clerk', email: 'clerk@shantiniketan.edu', mobile: '7777777777', name: 'Alok Clerk' },
    { role: Role.ACCOUNTANT, username: 'accountant', email: 'accountant@shantiniketan.edu', mobile: '6666666666', name: 'Suresh Accountant' },
    { role: Role.CLASS_TEACHER, username: 'classteacher', email: 'classteacher@shantiniketan.edu', mobile: '5555555555', name: 'Kiran Class Teacher' },
    { role: Role.SUBJECT_TEACHER, username: 'subjectteacher', email: 'subjectteacher@shantiniketan.edu', mobile: '4444444444', name: 'Amit Subject Teacher' },
  ];

  const userIds: { [key: string]: string } = {};

  for (const uc of rolesConfig) {
    const user = await prisma.user.create({
      data: {
        schoolId: school.id,
        name: uc.name,
        username: uc.username,
        email: uc.email,
        mobile: uc.mobile,
        passwordHash,
        role: uc.role,
        isActive: true
      }
    });
    userIds[uc.role] = user.id;
  }

  // 7. Seed Staff for Teacher accounts
  console.log('Seeding staff profiles...');
  const staffClassTeacher = await prisma.staff.create({
    data: {
      schoolId: school.id,
      userId: userIds[Role.CLASS_TEACHER],
      employeeId: 'SCH-EMP-001',
      slNo: 1,
      firstName: 'Kiran',
      lastName: 'Sharma',
      dateOfBirth: new Date('1988-06-15'),
      gender: Gender.FEMALE,
      category: Category.GENERAL,
      aadhaarNumber: 'mock-aadhaar-encrypted-1',
      mobile: '5555555555',
      email: 'classteacher@shantiniketan.edu',
      address: '123 Teacher Colony, Chapetla',
      designation: 'TGT Science',
      department: 'Science',
      employeeType: EmployeeType.PERMANENT,
      joiningDate: new Date('2018-04-01'),
      basicSalary: 45000.00,
      daPercent: 12.00,
      hraPercent: 18.00,
      taAmount: 2000.00
    }
  });

  const staffSubjectTeacher = await prisma.staff.create({
    data: {
      schoolId: school.id,
      userId: userIds[Role.SUBJECT_TEACHER],
      employeeId: 'SCH-EMP-002',
      slNo: 2,
      firstName: 'Amit',
      lastName: 'Verma',
      dateOfBirth: new Date('1990-09-20'),
      gender: Gender.MALE,
      category: Category.OBC,
      aadhaarNumber: 'mock-aadhaar-encrypted-2',
      mobile: '4444444444',
      email: 'subjectteacher@shantiniketan.edu',
      address: '456 Narmada Niwas, Chapetla',
      designation: 'TGT Maths',
      department: 'Mathematics',
      employeeType: EmployeeType.PERMANENT,
      joiningDate: new Date('2020-07-15'),
      basicSalary: 42000.00,
      daPercent: 12.00,
      hraPercent: 18.00,
      taAmount: 2000.00
    }
  });

  // Assign Class Teacher to Class 1 Section A
  await prisma.section.update({
    where: { id: savedSectionsMap['Class 1-A'] },
    data: { classTeacherId: staffClassTeacher.id }
  });

  // Assign Class Teacher to teach Science in Class 1 Section A
  await prisma.staffSubjectAssignment.create({
    data: {
      staffId: staffClassTeacher.id,
      subjectId: subjectsMap['SCI'],
      sectionId: savedSectionsMap['Class 1-A'],
      academicYearId: currentYear.id
    }
  });

  // Assign Subject Teacher to teach Mathematics in Class 1 Section A
  await prisma.staffSubjectAssignment.create({
    data: {
      staffId: staffSubjectTeacher.id,
      subjectId: subjectsMap['MATH'],
      sectionId: savedSectionsMap['Class 1-A'],
      academicYearId: currentYear.id
    }
  });

  console.log('Seed completed successfully.');
  console.log('Test Accounts created:');
  console.table(rolesConfig.map(r => ({ Role: r.role, Email: r.email, Mobile: r.mobile, Password: 'password123' })));
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
