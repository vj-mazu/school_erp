import { Router } from 'express';
import prisma from '../utils/db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { authorizeRoles } from '../middleware/rbac';
import { logAuditEvent } from '../middleware/audit';

const router = Router();

// GENERATE MONTHLY PAYROLL SLIPS
router.post('/generate/:month', authenticateToken as any, authorizeRoles('SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT') as any, logAuditEvent('GENERATE_PAYROLL', 'staff') as any, async (req: AuthenticatedRequest, res) => {
  const { month } = req.params; // e.g. "April-2026"
  const schoolId = req.user?.schoolId;

  try {
    const staff = await prisma.staff.findMany({
      where: { schoolId, status: 'ACTIVE' }
    });

    const slips = staff.map(st => {
      const basic = parseFloat(st.basicSalary.toString());
      const da = (basic * parseFloat(st.daPercent.toString())) / 100;
      const hra = (basic * parseFloat(st.hraPercent.toString())) / 100;
      const ta = parseFloat(st.taAmount.toString());
      
      const gross = basic + da + hra + ta;
      const pf = basic * 0.12; // default 12% PF contribution
      const net = gross - pf;

      return {
        staffId: st.id,
        name: `${st.firstName} ${st.lastName}`,
        employeeId: st.employeeId,
        designation: st.designation,
        month,
        basicSalary: basic,
        daAmount: da,
        hraAmount: hra,
        taAmount: ta,
        grossSalary: gross,
        pfDeduction: pf,
        netSalary: net
      };
    });

    res.json(slips);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to generate payroll sheets', error: error.message });
  }
});

export default router;
