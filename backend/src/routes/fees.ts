import { Router } from 'express';
import prisma from '../utils/db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { authorizeRoles } from '../middleware/rbac';
import { logAuditEvent } from '../middleware/audit';
import { sendSms } from '../utils/sms';
import { FeeFrequency, FeeType, PaymentMode, InvoiceStatus } from '@prisma/client';

const router = Router();

// GET ALL FEE HEADS
router.get('/heads', authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  try {
    const heads = await prisma.feeHead.findMany({
      where: { schoolId: req.user?.schoolId }
    });
    res.json(heads);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to retrieve fee heads', error: error.message });
  }
});

// GET ALL STRUCTURES
router.get('/structure', authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  const { classId, medium } = req.query;
  try {
    const filters: any = { schoolId: req.user?.schoolId };
    if (classId) filters.classId = classId as string;
    if (medium) filters.medium = medium as any;

    const structures = await prisma.feeStructure.findMany({
      where: filters,
      include: { class: true, feeHead: true }
    });
    res.json(structures);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to retrieve fee structures', error: error.message });
  }
});

// CREATE FEE STRUCTURE
router.post('/structure', authenticateToken as any, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'PRINCIPAL') as any, logAuditEvent('CREATE_FEE_STRUCTURE', 'fee_structures') as any, async (req: AuthenticatedRequest, res) => {
  const { classId, feeHeadId, amount, frequency, dueDay, lateFinePerDay, medium } = req.body;
  const academicYearId = req.academicYearId || '11111111-1111-1111-1111-111111111111';

  try {
    const structure = await prisma.feeStructure.create({
      data: {
        schoolId: req.user!.schoolId,
        academicYearId,
        classId,
        feeHeadId,
        medium: (medium || 'ENGLISH') as any,
        amount: parseFloat(amount),
        frequency: frequency as FeeFrequency,
        dueDay: parseInt(dueDay),
        lateFinePerDay: parseFloat(lateFinePerDay || 0)
      }
    });
    res.json(structure);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to create fee structure', error: error.message });
  }
});

// GET STUDENT OUTSTANDING DUES
router.get('/student-dues/:studentId', authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  const { studentId } = req.params;
  const academicYearId = req.headers['x-academic-year-id'] as string || '11111111-1111-1111-1111-111111111111';

  try {
    // 1. Fetch Student Details
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { class: true, section: true }
    });

    if (!student) return res.status(404).json({ message: 'Student not found' });

    // 2. Fetch all invoices for student in this academic year
    const invoices = await prisma.feeInvoice.findMany({
      where: { studentId, academicYearId },
      include: { feeHead: true },
      orderBy: { dueDate: 'asc' }
    });

    // 3. Fetch Student concessions
    const concessions = await prisma.feeConcession.findMany({
      where: { studentId, academicYearId }
    });
    const concessionMap = new Map(concessions.map(c => [c.feeHeadId, c]));

    // 4. Calculate dynamic late fines
    const today = new Date();
    const resultInvoices = invoices.map(inv => {
      let lateFine = 0;
      if (inv.status !== 'PAID' && inv.status !== 'WAIVED' && today > new Date(inv.dueDate)) {
        // Calculate days overdue
        const diffTime = Math.abs(today.getTime() - new Date(inv.dueDate).getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Find structure fine
        lateFine = diffDays * 10; // default to ₹10 per day if structure not matched
      }

      const concession = concessionMap.get(inv.feeHeadId);
      let concessionAmount = 0;
      if (concession) {
        if (concession.concessionType === 'FULL' || concession.concessionType === 'RTE') {
          concessionAmount = parseFloat(inv.amountDue.toString());
        } else if (concession.concessionType === 'PERCENTAGE') {
          concessionAmount = (parseFloat(inv.amountDue.toString()) * parseFloat(concession.concessionPercent!.toString())) / 100;
        } else if (concession.concessionType === 'FIXED_AMOUNT') {
          concessionAmount = parseFloat(concession.concessionAmount!.toString());
        }
      }

      const netDue = Math.max(0, parseFloat(inv.amountAfterConcession.toString()) - concessionAmount - parseFloat(inv.amountPaid.toString()));

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        feeHead: inv.feeHead.name,
        feeType: inv.feeHead.feeType,
        dueDate: inv.dueDate,
        amountDue: parseFloat(inv.amountDue.toString()),
        amountAfterConcession: parseFloat(inv.amountAfterConcession.toString()),
        concession: concessionAmount,
        amountPaid: parseFloat(inv.amountPaid.toString()),
        netDue,
        lateFine,
        status: inv.status,
        month: inv.month
      };
    });

    // Generate response
    res.json({
      student: {
        id: student.id,
        name: `${student.firstName} ${student.lastName}`,
        admissionNumber: student.admissionNumber,
        class: student.class.name,
        section: student.section?.name || 'N/A',
      },
      invoices: resultInvoices
    });

  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch student dues', error: error.message });
  }
});

// COLLECT FEE
router.post('/collect', authenticateToken as any, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT') as any, logAuditEvent('COLLECT_FEE', 'fee_payments') as any, async (req: AuthenticatedRequest, res) => {
  const { studentId, invoiceIds, invoicePayments, discount, lateFine, paymentMode, transactionId, bankName, chequeNumber, chequeDate, remarks } = req.body;
  const academicYearId = req.headers['x-academic-year-id'] as string || '11111111-1111-1111-1111-111111111111';

  if (!studentId || !invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
    return res.status(400).json({ message: 'studentId and invoiceIds are required' });
  }

  try {
    // 1. Fetch invoices
    const invoices = await prisma.feeInvoice.findMany({
      where: { id: { in: invoiceIds } },
      include: { feeHead: true }
    });

    // Calculate actual total amount based on optional partial payments mapping
    const totalAmount = invoices.reduce((acc, inv) => {
      const remaining = parseFloat(inv.amountAfterConcession.toString()) - parseFloat(inv.amountPaid.toString());
      const paidNow = invoicePayments && invoicePayments[inv.id] !== undefined ? parseFloat(invoicePayments[inv.id]) : remaining;
      return acc + paidNow;
    }, 0);

    const fineVal = parseFloat(lateFine || 0);
    const discVal = parseFloat(discount || 0);
    const netPayable = Math.max(0, totalAmount + fineVal - discVal);

    // 2. Generate Receipt Number
    const countPayments = await prisma.feePayment.count({
      where: { academicYearId }
    });
    const receiptNumber = `SCH/${new Date().getFullYear()}/REC/${String(countPayments + 1).padStart(5, '0')}`;

    // 3. Perform Payment write & updates inside transaction
    const updatePromises = invoices.map(inv => {
      const remaining = parseFloat(inv.amountAfterConcession.toString()) - parseFloat(inv.amountPaid.toString());
      const paidNow = invoicePayments && invoicePayments[inv.id] !== undefined ? parseFloat(invoicePayments[inv.id]) : remaining;
      const newPaidTotal = parseFloat(inv.amountPaid.toString()) + paidNow;
      const status = newPaidTotal >= parseFloat(inv.amountAfterConcession.toString()) ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;
      
      return prisma.feeInvoice.update({
        where: { id: inv.id },
        data: {
          amountPaid: newPaidTotal,
          status
        }
      });
    });

    const [payment] = await prisma.$transaction([
      prisma.feePayment.create({
        data: {
          studentId,
          invoiceIds,
          receiptNumber,
          academicYearId,
          totalAmount,
          lateFine: fineVal,
          discount: discVal,
          netAmount: netPayable,
          paymentMode: paymentMode as PaymentMode,
          transactionId,
          bankName,
          chequeNumber,
          chequeDate: chequeDate ? new Date(chequeDate) : null,
          paymentDate: new Date(),
          collectedBy: req.user?.id,
          remarks
        }
      }),
      ...updatePromises
    ]);

    // 4. Send payment receipt SMS to parents
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { guardians: { where: { isPrimaryContact: true } } }
    });
    
    if (student && student.guardians[0]?.mobile) {
      const msg = `Shantiniketan Public School: Fee payment of ₹${netPayable.toLocaleString('en-IN')} received for ${student.firstName} ${student.lastName}. Receipt No: ${receiptNumber}. Thank you.`;
      await sendSms(student.guardians[0].mobile, msg);
    }

    res.json(payment);
  } catch (error: any) {
    res.status(500).json({ message: 'Fee collection failed', error: error.message });
  }
});

// GET RECEIPTS DETAILS FOR HIGH FIDELITY PRINT
router.get('/receipt/:paymentId', authenticateToken as any, async (req, res) => {
  const { paymentId } = req.params;

  try {
    const payment = await prisma.feePayment.findUnique({
      where: { id: paymentId },
      include: {
        student: {
          include: { class: true, section: true, school: true }
        }
      }
    });

    if (!payment) return res.status(404).json({ message: 'Payment receipt not found' });

    // Fetch invoices details that were paid
    const invoicesPaid = await prisma.feeInvoice.findMany({
      where: {
        id: { in: payment.invoiceIds as string[] }
      },
      include: { feeHead: true }
    });

    res.json({
      payment,
      invoices: invoicesPaid
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Receipt fetch failed', error: error.message });
  }
});

// GET LIST OF ALL INVOICES (WITH FILTERS FOR CLASS/SECTION/STATUS)
router.get('/invoices', authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  const { classId, sectionId, status } = req.query;
  const schoolId = req.user?.schoolId;
  const academicYearId = req.headers['x-academic-year-id'] as string || '11111111-1111-1111-1111-111111111111';

  try {
    const filters: any = {
      academicYearId,
      student: { schoolId }
    };

    if (classId) filters.student = { ...filters.student, classId: classId as string };
    if (sectionId) filters.student = { ...filters.student, sectionId: sectionId as string };
    if (status) filters.status = status as InvoiceStatus;

    const invoices = await prisma.feeInvoice.findMany({
      where: filters,
      include: {
        student: { include: { class: true, section: true } },
        feeHead: true
      },
      orderBy: { dueDate: 'asc' }
    });

    res.json(invoices);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to retrieve invoices', error: error.message });
  }
});

// EDIT INVOICE (SUPER ADMIN / PRINCIPAL ONLY)
router.put('/invoice/:id', authenticateToken as any, authorizeRoles('SUPER_ADMIN', 'PRINCIPAL') as any, logAuditEvent('EDIT_FEE_INVOICE', 'fee_invoices') as any, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { amountDue, amountAfterConcession } = req.body;

  try {
    const updated = await prisma.feeInvoice.update({
      where: { id },
      data: {
        amountDue: parseFloat(amountDue),
        amountAfterConcession: parseFloat(amountAfterConcession)
      }
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to edit invoice amount', error: error.message });
  }
});

// CREATE CONCESSION REQUEST (IF SUPER_ADMIN/PRINCIPAL, APPROVE AUTOMATICALLY, ELSE LEAVE PENDING)
router.post('/concession', authenticateToken as any, logAuditEvent('REQUEST_FEE_CONCESSION', 'fee_concessions') as any, async (req: AuthenticatedRequest, res) => {
  const { studentId, feeHeadId, concessionType, concessionPercent, concessionAmount, reason } = req.body;
  const academicYearId = req.headers['x-academic-year-id'] as string || '11111111-1111-1111-1111-111111111111';
  const role = req.user?.role;
  const userId = req.user?.id;

  try {
    const isApprover = role === 'SUPER_ADMIN' || role === 'PRINCIPAL';
    const concession = await prisma.feeConcession.create({
      data: {
        studentId,
        feeHeadId,
        academicYearId,
        concessionType,
        concessionPercent: concessionPercent ? parseFloat(concessionPercent) : null,
        concessionAmount: concessionAmount ? parseFloat(concessionAmount) : null,
        reason,
        approvedBy: isApprover ? userId : null
      }
    });

    res.json({
      success: true,
      concession,
      message: isApprover ? 'Concession approved automatically' : 'Concession request submitted for Principal approval'
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to create concession', error: error.message });
  }
});

// GET PENDING CONCESSIONS (SUPER_ADMIN / PRINCIPAL ONLY)
router.get('/concessions/pending', authenticateToken as any, authorizeRoles('SUPER_ADMIN', 'PRINCIPAL') as any, async (req: AuthenticatedRequest, res) => {
  const schoolId = req.user?.schoolId;
  const academicYearId = req.headers['x-academic-year-id'] as string || '11111111-1111-1111-1111-111111111111';

  try {
    const pending = await prisma.feeConcession.findMany({
      where: {
        academicYearId,
        approvedBy: null,
        student: { schoolId }
      },
      include: {
        student: { include: { class: true, section: true } },
        feeHead: true
      }
    });
    res.json(pending);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to retrieve pending concessions', error: error.message });
  }
});

// APPROVE CONCESSION
router.post('/concession/:id/approve', authenticateToken as any, authorizeRoles('SUPER_ADMIN', 'PRINCIPAL') as any, logAuditEvent('APPROVE_FEE_CONCESSION', 'fee_concessions') as any, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const userId = req.user?.id;

  try {
    const approved = await prisma.feeConcession.update({
      where: { id },
      data: { approvedBy: userId }
    });
    res.json({ success: true, message: 'Concession approved successfully', approved });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to approve concession', error: error.message });
  }
});

// REJECT/DELETE CONCESSION REQUEST
router.delete('/concession/:id', authenticateToken as any, logAuditEvent('REJECT_FEE_CONCESSION', 'fee_concessions') as any, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;

  try {
    await prisma.feeConcession.delete({
      where: { id }
    });
    res.json({ success: true, message: 'Concession request rejected and removed' });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to reject concession request', error: error.message });
  }
});

// GET CLASS-WISE FEES SUMMARY
router.get('/class-summary', authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  const schoolId = req.user?.schoolId;
  const academicYearId = req.headers['x-academic-year-id'] as string || '11111111-1111-1111-1111-111111111111';

  try {
    const classes = await prisma.class.findMany({
      where: { schoolId },
      include: {
        feeStructures: {
          where: { academicYearId },
          include: { feeHead: true }
        },
        students: {
          where: { status: 'ACTIVE' }
        }
      },
      orderBy: { orderIndex: 'asc' }
    });

    const result = await Promise.all(classes.map(async (cls) => {
      const invoices = await prisma.feeInvoice.findMany({
        where: {
          student: { classId: cls.id, status: 'ACTIVE' },
          academicYearId
        }
      });

      const totalExpected = invoices.reduce((sum, inv) => sum + parseFloat(inv.amountAfterConcession.toString()), 0);
      const totalCollected = invoices.filter(inv => inv.status === 'PAID').reduce((sum, inv) => sum + parseFloat(inv.amountAfterConcession.toString()), 0);
      const totalPending = totalExpected - totalCollected;

      return {
        classId: cls.id,
        className: cls.name,
        studentCount: cls.students.length,
        feeStructures: cls.feeStructures.map(fs => ({
          headName: fs.feeHead.name,
          amount: parseFloat(fs.amount.toString()),
          frequency: fs.frequency
        })),
        totalExpected,
        totalCollected,
        totalPending
      };
    }));

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to retrieve class-wise fee summary', error: error.message });
  }
});

// GENERATE BULK MONTHLY INVOICES FOR STUDENTS
router.post('/generate-invoices', authenticateToken as any, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'PRINCIPAL', 'ACCOUNTANT') as any, logAuditEvent('GENERATE_FEE_INVOICES', 'fee_invoices') as any, async (req: AuthenticatedRequest, res) => {
  const schoolId = req.user?.schoolId;
  const academicYearId = req.headers['x-academic-year-id'] as string || '11111111-1111-1111-1111-111111111111';
  const { classId, month, dueDate } = req.body;

  if (!month) return res.status(400).json({ message: 'Month parameter (1-12) is required.' });

  try {
    // 1. Find target active students
    const studentFilter: any = { schoolId, status: 'ACTIVE' };
    if (classId) studentFilter.classId = classId;

    const students = await prisma.student.findMany({
      where: studentFilter
    });

    let createdCount = 0;
    const invDate = dueDate ? new Date(dueDate) : new Date(new Date().getFullYear(), parseInt(month) - 1, 10);

    for (const student of students) {
      // Find fee structures for this student's class and medium
      const structures = await prisma.feeStructure.findMany({
        where: {
          schoolId,
          academicYearId,
          classId: student.classId,
          medium: student.mediumOfInstruction
        },
        include: { feeHead: true }
      });

      // Check if student has concessions
      const concessions = await prisma.feeConcession.findMany({
        where: { studentId: student.id, academicYearId, approvedBy: { not: null } }
      });
      const concessionMap = new Map(concessions.map(c => [c.feeHeadId, c]));

      for (const structure of structures) {
        // Check if invoice already exists for this student, head, and month
        const exists = await prisma.feeInvoice.findFirst({
          where: {
            studentId: student.id,
            feeHeadId: structure.feeHeadId,
            month: parseInt(month),
            academicYearId
          }
        });

        if (!exists) {
          // Generate unique invoice number
          const rand = Math.floor(1000 + Math.random() * 9000);
          const invoiceNumber = `INV-${student.admissionNumber.replace(/\//g, '-')}-${month}-${rand}`;

          // Calculate concession
          const concession = concessionMap.get(structure.feeHeadId);
          let amountAfterConcession = parseFloat(structure.amount.toString());
          if (concession) {
            if (concession.concessionType === 'FULL' || concession.concessionType === 'RTE') {
              amountAfterConcession = 0;
            } else if (concession.concessionType === 'PERCENTAGE') {
              const disc = (amountAfterConcession * parseFloat(concession.concessionPercent!.toString())) / 100;
              amountAfterConcession = Math.max(0, amountAfterConcession - disc);
            } else if (concession.concessionType === 'FIXED_AMOUNT') {
              amountAfterConcession = Math.max(0, amountAfterConcession - parseFloat(concession.concessionAmount!.toString()));
            }
          }

          await prisma.feeInvoice.create({
            data: {
              studentId: student.id,
              academicYearId,
              invoiceNumber,
              feeHeadId: structure.feeHeadId,
              amountDue: structure.amount,
              amountAfterConcession,
              amountPaid: 0,
              dueDate: invDate,
              month: parseInt(month),
              status: InvoiceStatus.PENDING
            }
          });
          createdCount++;
        }
      }
    }

    res.json({ success: true, message: `Successfully generated ${createdCount} invoices for month ${month}`, count: createdCount });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to generate bulk invoices', error: error.message });
  }
});

export default router;
