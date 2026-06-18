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

// CREATE FEE HEAD
router.post('/heads', authenticateToken as any, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'PRINCIPAL') as any, async (req: AuthenticatedRequest, res) => {
  const { name, description, feeType, isMandatory } = req.body;
  try {
    const head = await prisma.feeHead.create({
      data: {
        schoolId: req.user!.schoolId,
        name,
        description,
        feeType: feeType as FeeType,
        isMandatory: !!isMandatory
      }
    });
    res.json(head);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to create fee head', error: error.message });
  }
});

// UPDATE FEE HEAD
router.put('/heads/:id', authenticateToken as any, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'PRINCIPAL') as any, async (req: AuthenticatedRequest, res) => {
  const { name, description, feeType, isMandatory } = req.body;
  try {
    const head = await prisma.feeHead.update({
      where: { id: req.params.id },
      data: {
        name,
        description,
        feeType: feeType as FeeType,
        isMandatory: !!isMandatory
      }
    });
    res.json(head);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to update fee head', error: error.message });
  }
});

// DELETE FEE HEAD
router.delete('/heads/:id', authenticateToken as any, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'PRINCIPAL') as any, async (req: AuthenticatedRequest, res) => {
  try {
    await prisma.feeHead.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true, message: 'Fee head deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to delete fee head', error: error.message });
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
  const academicYearId = req.headers['x-academic-year-id'] as string || req.academicYearId || '11111111-1111-1111-1111-111111111111';

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

// UPDATE FEE STRUCTURE
router.put('/structure/:id', authenticateToken as any, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'PRINCIPAL') as any, async (req: AuthenticatedRequest, res) => {
  const { classId, feeHeadId, amount, frequency, dueDay, lateFinePerDay, medium } = req.body;
  try {
    const structure = await prisma.feeStructure.update({
      where: { id: req.params.id },
      data: {
        classId,
        feeHeadId,
        medium: medium as any,
        amount: parseFloat(amount),
        frequency: frequency as FeeFrequency,
        dueDay: parseInt(dueDay),
        lateFinePerDay: parseFloat(lateFinePerDay || 0)
      }
    });
    res.json(structure);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to update fee structure', error: error.message });
  }
});

// DELETE FEE STRUCTURE
router.delete('/structure/:id', authenticateToken as any, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'PRINCIPAL') as any, async (req: AuthenticatedRequest, res) => {
  try {
    await prisma.feeStructure.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true, message: 'Fee structure configuration deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to delete fee structure', error: error.message });
  }
});

// GET STUDENT OUTSTANDING DUES
router.get('/student-dues/:studentId', authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  const { studentId } = req.params;
  const academicYearId = req.headers['x-academic-year-id'] as string || '11111111-1111-1111-1111-111111111111';

  try {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { class: true, section: true }
    });

    if (!student) return res.status(404).json({ message: 'Student not found' });

    // Fetch existing invoices
    const invoices = await prisma.feeInvoice.findMany({
      where: { studentId, academicYearId },
      include: { feeHead: true },
      orderBy: { dueDate: 'asc' }
    });

    // Fetch all structures for student's class and medium
    const structures = await prisma.feeStructure.findMany({
      where: {
        schoolId: student.schoolId,
        academicYearId,
        classId: student.classId,
        medium: student.mediumOfInstruction
      },
      include: { feeHead: true }
    });

    // Fetch optional structure assignments for the student
    const assignments = await prisma.studentFeeAssignment.findMany({
      where: { studentId, academicYearId }
    });
    const assignedStructureIds = new Set(assignments.map(a => a.feeStructureId));

    const concessions = await prisma.feeConcession.findMany({
      where: { studentId, academicYearId }
    });
    const concessionMap = new Map(concessions.map(c => [c.feeHeadId, c]));

    const today = new Date();
    const resultInvoices: any[] = [];

    // Map existing invoices
    invoices.forEach(inv => {
      let lateFine = 0;
      if (inv.status !== 'PAID' && inv.status !== 'WAIVED' && today > new Date(inv.dueDate)) {
        const diffTime = Math.abs(today.getTime() - new Date(inv.dueDate).getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        lateFine = diffDays * 10;
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

      resultInvoices.push({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        feeHead: inv.feeHead.name,
        feeType: inv.feeHead.feeType,
        dueDate: inv.dueDate,
        amountDue: parseFloat(inv.amountDue.toString()),
        amountAfterConcession: parseFloat(inv.amountAfterConcession.toString()),
        concession: concessionAmount,
        amountPaid: parseFloat(inv.amountPaid.toString()),
        netDue: Math.round(netDue * 100) / 100,
        lateFine,
        status: inv.status,
        month: inv.month
      });
    });

    // Add simulated dues for structure items that have not had an invoice generated yet
    structures.forEach(structure => {
      if (structure.feeHead.isMandatory || assignedStructureIds.has(structure.id)) {
        const hasInvoice = invoices.some(inv => inv.feeHeadId === structure.feeHeadId);
        if (!hasInvoice) {
          const concession = concessionMap.get(structure.feeHeadId);
          let concessionAmount = 0;
          let amountAfterConcession = parseFloat(structure.amount.toString());
          if (concession) {
            if (concession.concessionType === 'FULL' || concession.concessionType === 'RTE') {
              concessionAmount = amountAfterConcession;
              amountAfterConcession = 0;
            } else if (concession.concessionType === 'PERCENTAGE') {
              concessionAmount = (amountAfterConcession * parseFloat(concession.concessionPercent!.toString())) / 100;
              amountAfterConcession = Math.max(0, amountAfterConcession - concessionAmount);
            } else if (concession.concessionType === 'FIXED_AMOUNT') {
              concessionAmount = parseFloat(concession.concessionAmount!.toString());
              amountAfterConcession = Math.max(0, amountAfterConcession - concessionAmount);
            }
          }

          resultInvoices.push({
            id: `struct-${structure.id}`,
            invoiceNumber: `SIM-${student.admissionNumber.replace(/\//g, '-')}-${structure.feeHead.name.substring(0, 3).toUpperCase()}`,
            feeHead: structure.feeHead.name,
            feeType: structure.feeHead.feeType,
            dueDate: new Date(),
            amountDue: parseFloat(structure.amount.toString()),
            amountAfterConcession: Math.round(amountAfterConcession * 100) / 100,
            concession: concessionAmount,
            amountPaid: 0,
            netDue: Math.round(amountAfterConcession * 100) / 100,
            lateFine: 0,
            status: 'PENDING',
            month: new Date().getMonth() + 1
          });
        }
      }
    });

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
    const mutableInvoiceIds = [...invoiceIds];
    const mutableInvoicePayments = { ...invoicePayments };

    // Resolve simulated structures into real invoice records
    for (let index = 0; index < mutableInvoiceIds.length; index++) {
      const invId = mutableInvoiceIds[index];
      if (invId.startsWith('struct-')) {
        const structId = invId.replace('struct-', '');
        const structure = await prisma.feeStructure.findUnique({
          where: { id: structId },
          include: { feeHead: true }
        });
        if (structure) {
          const student = await prisma.student.findUnique({ where: { id: studentId } });
          if (!student) return res.status(404).json({ message: 'Student not found.' });

          // Check for active concessions
          const concession = await prisma.feeConcession.findFirst({
            where: { studentId, academicYearId, feeHeadId: structure.feeHeadId }
          });

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

          const rand = Math.floor(1000 + Math.random() * 9000);
          const month = new Date().getMonth() + 1;
          const invoiceNumber = `INV-${student.admissionNumber.replace(/\//g, '-')}-${month}-${rand}`;

          const realInvoice = await prisma.feeInvoice.create({
            data: {
              studentId,
              academicYearId,
              invoiceNumber,
              feeHeadId: structure.feeHeadId,
              amountDue: structure.amount,
              amountAfterConcession: Math.round(amountAfterConcession * 100) / 100,
              amountPaid: 0,
              dueDate: new Date(),
              month,
              status: InvoiceStatus.PENDING
            }
          });

          mutableInvoiceIds[index] = realInvoice.id;
          if (mutableInvoicePayments[invId] !== undefined) {
            mutableInvoicePayments[realInvoice.id] = mutableInvoicePayments[invId];
            delete mutableInvoicePayments[invId];
          }
        }
      }
    }

    const invoices = await prisma.feeInvoice.findMany({
      where: { id: { in: mutableInvoiceIds } },
      include: { feeHead: true }
    });

    const totalAmount = invoices.reduce((acc, inv) => {
      const remaining = parseFloat(inv.amountAfterConcession.toString()) - parseFloat(inv.amountPaid.toString());
      const paidNow = mutableInvoicePayments && mutableInvoicePayments[inv.id] !== undefined ? parseFloat(mutableInvoicePayments[inv.id]) : remaining;
      return acc + paidNow;
    }, 0);

    const fineVal = parseFloat(lateFine || 0);
    const discVal = parseFloat(discount || 0);
    const netPayable = Math.max(0, totalAmount + fineVal - discVal);

    const countPayments = await prisma.feePayment.count({
      where: { academicYearId }
    });
    const receiptNumber = `SCH/${new Date().getFullYear()}/REC/${String(countPayments + 1).padStart(5, '0')}`;

    const updatePromises = invoices.map(inv => {
      const remaining = parseFloat(inv.amountAfterConcession.toString()) - parseFloat(inv.amountPaid.toString());
      const paidNow = mutableInvoicePayments && mutableInvoicePayments[inv.id] !== undefined ? mutableInvoicePayments[inv.id] : remaining;
      const newPaidTotal = Math.round((parseFloat(inv.amountPaid.toString()) + paidNow) * 100) / 100;
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
          invoiceIds: mutableInvoiceIds,
          invoicePayments: mutableInvoicePayments,
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
  const { classId, sectionId, status, search, page = '1', limit = '50' } = req.query;
  const schoolId = req.user?.schoolId;
  const academicYearId = req.headers['x-academic-year-id'] as string || '11111111-1111-1111-1111-111111111111';

  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const skip = (pageNum - 1) * limitNum;

  try {
    const filters: any = {
      academicYearId,
      student: { schoolId }
    };

    if (classId) filters.student = { ...filters.student, classId: classId as string };
    if (sectionId) filters.student = { ...filters.student, sectionId: sectionId as string };
    if (status) filters.status = status as InvoiceStatus;

    if (search) {
      filters.OR = [
        { invoiceNumber: { contains: search as string, mode: 'insensitive' } },
        { student: { firstName: { contains: search as string, mode: 'insensitive' } } },
        { student: { lastName: { contains: search as string, mode: 'insensitive' } } },
        { student: { admissionNumber: { contains: search as string, mode: 'insensitive' } } }
      ];
    }

    const [invoices, total] = await Promise.all([
      prisma.feeInvoice.findMany({
        where: filters,
        include: {
          student: { include: { class: true, section: true, guardians: true } },
          feeHead: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.feeInvoice.count({ where: filters })
    ]);

    res.json({
      invoices,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
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

// GET FEES DASHBOARD METRICS
router.get('/dashboard-metrics', authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  const schoolId = req.user?.schoolId;
  const academicYearId = req.headers['x-academic-year-id'] as string || req.academicYearId || '11111111-1111-1111-1111-111111111111';

  try {
    const totalStudents = await prisma.student.count({
      where: { schoolId, status: 'ACTIVE', academicYearId }
    });

    const totalCollectedAggregation = await prisma.feePayment.aggregate({
      where: {
        academicYearId,
        student: { schoolId }
      },
      _sum: {
        netAmount: true
      }
    });
    const totalCollected = parseFloat(totalCollectedAggregation._sum.netAmount?.toString() || '0');

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayCollectedAggregation = await prisma.feePayment.aggregate({
      where: {
        academicYearId,
        student: { schoolId },
        paymentDate: {
          gte: todayStart,
          lte: todayEnd
        }
      },
      _sum: {
        netAmount: true
      }
    });
    const totalCollectedToday = parseFloat(todayCollectedAggregation._sum.netAmount?.toString() || '0');

    res.json({
      totalStudents,
      totalCollected,
      totalCollectedToday
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to retrieve dashboard metrics', error: error.message });
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
      const totalCollected = invoices.reduce((sum, inv) => sum + parseFloat(inv.amountPaid.toString()), 0);
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
    const studentFilter: any = { schoolId, status: 'ACTIVE', academicYearId };
    if (classId) studentFilter.classId = classId;

    const students = await prisma.student.findMany({
      where: studentFilter
    });

    let createdCount = 0;
    const invDate = dueDate ? new Date(dueDate) : new Date(new Date().getFullYear(), parseInt(month) - 1, 10);

    for (const student of students) {
      const structures = await prisma.feeStructure.findMany({
        where: {
          schoolId,
          academicYearId,
          classId: student.classId,
          medium: student.mediumOfInstruction
        },
        include: { feeHead: true }
      });

      const studentAssignments = await prisma.studentFeeAssignment.findMany({
        where: { studentId: student.id, academicYearId }
      });
      const assignedStructureIds = new Set(studentAssignments.map(a => a.feeStructureId));

      const concessions = await prisma.feeConcession.findMany({
        where: { studentId: student.id, academicYearId, approvedBy: { not: null } }
      });
      const concessionMap = new Map(concessions.map(c => [c.feeHeadId, c]));

      for (const structure of structures) {
        if (!structure.feeHead.isMandatory && !assignedStructureIds.has(structure.id)) {
          continue; // skip optional fees not assigned
        }

        const exists = await prisma.feeInvoice.findFirst({
          where: {
            studentId: student.id,
            feeHeadId: structure.feeHeadId,
            month: parseInt(month),
            academicYearId
          }
        });

        if (!exists) {
          const rand = Math.floor(1000 + Math.random() * 9000);
          const invoiceNumber = `INV-${student.admissionNumber.replace(/\//g, '-')}-${month}-${rand}`;

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
              amountAfterConcession: Math.round(amountAfterConcession * 100) / 100,
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

// GET STUDENT ASSIGNMENTS
router.get('/assignments/:studentId', authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  try {
    const assignments = await prisma.studentFeeAssignment.findMany({
      where: { studentId: req.params.studentId },
      include: { feeStructure: { include: { feeHead: true } } }
    });
    res.json(assignments);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to retrieve fee assignments', error: error.message });
  }
});

// BULK SAVE OPTIONAL FEE ASSIGNMENTS
router.post('/assignments', authenticateToken as any, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'PRINCIPAL') as any, async (req: AuthenticatedRequest, res) => {
  const { studentIds, feeStructureId } = req.body;
  const academicYearId = req.headers['x-academic-year-id'] as string || '11111111-1111-1111-1111-111111111111';

  if (!studentIds || !Array.isArray(studentIds) || !feeStructureId) {
    return res.status(400).json({ message: 'studentIds and feeStructureId are required.' });
  }

  try {
    const created = [];
    for (const studentId of studentIds) {
      const exists = await prisma.studentFeeAssignment.findFirst({
        where: { studentId, feeStructureId, academicYearId }
      });
      if (!exists) {
        const assignment = await prisma.studentFeeAssignment.create({
          data: { studentId, feeStructureId, academicYearId }
        });
        created.push(assignment);
      }
    }
    res.json({ success: true, count: created.length, assignments: created });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to save fee assignments', error: error.message });
  }
});

// DELETE BULK OPTIONAL FEE ASSIGNMENTS
router.post('/assignments/delete', authenticateToken as any, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'PRINCIPAL') as any, async (req: AuthenticatedRequest, res) => {
  const { studentIds, feeStructureId } = req.body;
  const academicYearId = req.headers['x-academic-year-id'] as string || '11111111-1111-1111-1111-111111111111';

  if (!studentIds || !Array.isArray(studentIds) || !feeStructureId) {
    return res.status(400).json({ message: 'studentIds and feeStructureId are required.' });
  }

  try {
    const result = await prisma.studentFeeAssignment.deleteMany({
      where: {
        studentId: { in: studentIds },
        feeStructureId,
        academicYearId
      }
    });
    res.json({ success: true, count: result.count });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to delete fee assignments', error: error.message });
  }
});

// POST AD-HOC CUSTOM INVOICE FOR A SINGLE STUDENT
router.post('/invoice/ad-hoc', authenticateToken as any, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'PRINCIPAL', 'ACCOUNTANT') as any, async (req: AuthenticatedRequest, res) => {
  const { studentId, amount, feeName, dueDate, month } = req.body;
  const academicYearId = req.headers['x-academic-year-id'] as string || '11111111-1111-1111-1111-111111111111';
  const schoolId = req.user?.schoolId;

  if (!studentId || !amount || !feeName || !month) {
    return res.status(400).json({ message: 'studentId, amount, feeName, and month are required.' });
  }

  try {
    let feeHead = await prisma.feeHead.findFirst({
      where: { name: feeName, schoolId }
    });

    if (!feeHead) {
      feeHead = await prisma.feeHead.create({
        data: {
          schoolId: schoolId!,
          name: feeName,
          feeType: 'MISCELLANEOUS',
          isMandatory: false,
          description: 'Ad-hoc custom student fee'
        }
      });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId }
    });
    if (!student) return res.status(404).json({ message: 'Student not found.' });

    const rand = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-${student.admissionNumber.replace(/\//g, '-')}-${month}-${rand}`;
    const parsedAmount = parseFloat(amount);

    const invoice = await prisma.feeInvoice.create({
      data: {
        studentId,
        academicYearId,
        invoiceNumber,
        feeHeadId: feeHead.id,
        amountDue: parsedAmount,
        amountAfterConcession: parsedAmount,
        amountPaid: 0,
        dueDate: dueDate ? new Date(dueDate) : new Date(),
        month: parseInt(month),
        status: InvoiceStatus.PENDING
      }
    });

    res.json({ success: true, invoice });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to create ad-hoc invoice', error: error.message });
  }
});

// GET PAGINATED LIST OF RECENT PAYMENTS
router.get('/payments', authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  const page = parseInt(req.query.page as string || '1');
  const limit = parseInt(req.query.limit as string || '20');
  const search = req.query.search as string;
  const paymentMode = req.query.paymentMode as string;
  const classId = req.query.classId as string;
  const sectionId = req.query.sectionId as string;
  const startDate = req.query.startDate as string;
  const endDate = req.query.endDate as string;
  const academicYearId = req.headers['x-academic-year-id'] as string || '11111111-1111-1111-1111-111111111111';
  const schoolId = req.user?.schoolId;

  const skip = (page - 1) * limit;

  try {
    const whereClause: any = {
      academicYearId,
      student: { schoolId }
    };

    if (classId) {
      whereClause.student = { ...whereClause.student, classId };
    }
    if (sectionId) {
      whereClause.student = { ...whereClause.student, sectionId };
    }

    if (paymentMode) {
      whereClause.paymentMode = paymentMode;
    }

    if (startDate || endDate) {
      whereClause.paymentDate = {};
      if (startDate) whereClause.paymentDate.gte = new Date(startDate);
      if (endDate) whereClause.paymentDate.lte = new Date(endDate);
    }

    if (search) {
      whereClause.OR = [
        { receiptNumber: { contains: search, mode: 'insensitive' } },
        { transactionId: { contains: search, mode: 'insensitive' } },
        { student: { firstName: { contains: search, mode: 'insensitive' } } },
        { student: { lastName: { contains: search, mode: 'insensitive' } } },
        { student: { admissionNumber: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const [payments, total] = await Promise.all([
      prisma.feePayment.findMany({
        where: whereClause,
        include: {
          student: { include: { class: true, section: true, guardians: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.feePayment.count({ where: whereClause })
    ]);

    // Compute totalNeeded, totalPaid, and totalPending based on filtered invoices
    const invoicesWhereClause: any = {
      academicYearId,
      student: { schoolId, status: 'ACTIVE' }
    };
    if (classId) {
      invoicesWhereClause.student.classId = classId;
    }
    if (sectionId) {
      invoicesWhereClause.student.sectionId = sectionId;
    }

    const invoicesAggregation = await prisma.feeInvoice.aggregate({
      where: invoicesWhereClause,
      _sum: {
        amountAfterConcession: true,
        amountPaid: true
      }
    });

    const totalNeeded = parseFloat(invoicesAggregation._sum.amountAfterConcession?.toString() || '0');
    const totalPaid = parseFloat(invoicesAggregation._sum.amountPaid?.toString() || '0');
    const totalPending = Math.max(0, totalNeeded - totalPaid);

    res.json({
      payments,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      summary: {
        totalNeeded,
        totalPaid,
        totalPending
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to retrieve payments history', error: error.message });
  }
});

// VOID / DELETE FEE PAYMENT RECORD
router.delete('/payment/:id', authenticateToken as any, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'PRINCIPAL', 'ACCOUNTANT') as any, logAuditEvent('VOID_FEE_PAYMENT', 'fee_payments') as any, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;

  try {
    const payment = await prisma.feePayment.findUnique({
      where: { id }
    });

    if (!payment) return res.status(404).json({ message: 'Payment record not found' });

    const invoiceIds = payment.invoiceIds as string[];
    const invoicePayments = payment.invoicePayments as { [key: string]: number } || {};

    const updatePromises = invoiceIds.map(async (invId) => {
      const invoice = await prisma.feeInvoice.findUnique({ where: { id: invId } });
      if (!invoice) return;

      const paidAmountOnReceipt = invoicePayments[invId] !== undefined ? parseFloat(invoicePayments[invId].toString()) : 0;
      const currentPaid = parseFloat(invoice.amountPaid.toString());
      const newPaidTotal = Math.max(0, Math.round((currentPaid - paidAmountOnReceipt) * 100) / 100);

      let newStatus: InvoiceStatus = InvoiceStatus.PENDING;
      if (newPaidTotal >= parseFloat(invoice.amountAfterConcession.toString())) {
        newStatus = InvoiceStatus.PAID;
      } else if (newPaidTotal > 0) {
        newStatus = InvoiceStatus.PARTIALLY_PAID;
      }

      return prisma.feeInvoice.update({
        where: { id: invId },
        data: {
          amountPaid: newPaidTotal,
          status: newStatus
        }
      });
    });

    const resolvedUpdates = await Promise.all(updatePromises);
    const validUpdates = resolvedUpdates.filter(u => u !== undefined) as any[];

    await prisma.$transaction([
      prisma.feePayment.delete({ where: { id } }),
      ...validUpdates
    ]);

    res.json({ success: true, message: 'Fee payment successfully voided and invoice balances reverted.' });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to void payment', error: error.message });
  }
});

// GET CLASS-WISE STUDENT DEFAULTERS & PENDING DUES LEDGER
router.get('/defaulters', authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  const page = parseInt(req.query.page as string || '1');
  const limit = parseInt(req.query.limit as string || '50');
  const classId = req.query.classId as string;
  const sectionId = req.query.sectionId as string;
  const search = req.query.search as string;
  const status = req.query.status as string; // 'ALL' or 'PENDING'
  const academicYearId = req.headers['x-academic-year-id'] as string || req.academicYearId || '11111111-1111-1111-1111-111111111111';
  const feeHeadId = req.query.feeHeadId as string;
  const schoolId = req.user?.schoolId;

  const skip = (page - 1) * limit;

  try {
    const studentFilters: any = {
      schoolId,
      status: 'ACTIVE',
      academicYearId
    };

    if (classId) studentFilters.classId = classId;
    if (sectionId) studentFilters.sectionId = sectionId;
    if (search) {
      studentFilters.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { admissionNumber: { contains: search, mode: 'insensitive' } }
      ];
    }

    const students = await prisma.student.findMany({
      where: studentFilters,
      include: { class: true, section: true, guardians: true },
      orderBy: [{ class: { orderIndex: 'asc' } }, { firstName: 'asc' }]
    });

    const result = [];
    for (const student of students) {
      const invoiceFilters: any = { studentId: student.id, academicYearId };
      if (feeHeadId) {
        invoiceFilters.feeHeadId = feeHeadId;
      }
      const invoices = await prisma.feeInvoice.findMany({
        where: invoiceFilters
      });

      const totalExpected = invoices.reduce((sum, inv) => sum + parseFloat(inv.amountAfterConcession.toString()), 0);
      const totalPaid = invoices.reduce((sum, inv) => sum + parseFloat(inv.amountPaid.toString()), 0);
      const balance = totalExpected - totalPaid;

      if (status === 'PENDING' && balance <= 0) continue;

      const father = student.guardians.find(g => g.type === 'FATHER');

      result.push({
        student: {
          id: student.id,
          name: `${student.firstName} ${student.lastName}`,
          admissionNumber: student.admissionNumber,
          class: student.class.name,
          section: student.section?.name || 'N/A',
          fatherName: father ? father.name : 'N/A'
        },
        totalExpected,
        totalPaid,
        balance: Math.round(balance * 100) / 100,
        status: balance <= 0 ? 'PAID' : (totalPaid > 0 ? 'PARTIALLY_PAID' : 'PENDING')
      });
    }

    const total = result.length;
    const paginatedResult = result.slice(skip, skip + limit);

    res.json({
      defaulters: paginatedResult,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to retrieve defaulters list', error: error.message });
  }
});

export default router;
