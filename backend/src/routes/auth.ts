import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../utils/db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'shantiniketan-super-secret-key-123';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'shantiniketan-refresh-secret-key-456';

// Store OTPs in memory for mock verification
const otpStore = new Map<string, string>();

// LOGIN
router.post('/login', async (req, res) => {
  const { username, password } = req.body; // username can be email or mobile

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username },
          { email: username },
          { mobile: username }
        ]
      },
      include: {
        school: true
      }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid credentials or inactive account' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // Generate tokens
    const token = jwt.sign(
      { id: user.id, schoolId: user.schoolId, role: user.role, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      JWT_REFRESH_SECRET,
      { expiresIn: '30d' }
    );

    // Get current active academic year for the school
    const activeYear = await prisma.academicYear.findFirst({
      where: { schoolId: user.schoolId, isCurrent: true }
    });

    res.json({
      token,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        profilePhotoUrl: user.profilePhotoUrl
      },
      school: user.school,
      activeAcademicYear: activeYear
    });

  } catch (error: any) {
    res.status(500).json({ message: 'Server error during login', error: error.message });
  }
});

// LOGOUT
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// REFRESH TOKEN
router.post('/refresh-token', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ message: 'Refresh token is required' });

  try {
    const decoded: any = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { school: true }
    });

    if (!user || !user.isActive) return res.status(401).json({ message: 'Invalid refresh token' });

    const newToken = jwt.sign(
      { id: user.id, schoolId: user.schoolId, role: user.role, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ token: newToken });
  } catch (error) {
    res.status(403).json({ message: 'Invalid or expired refresh token' });
  }
});

// SEND OTP (Mocked for parent/staff access)
router.post('/send-otp', async (req, res) => {
  const { mobile } = req.body;
  if (!mobile) return res.status(400).json({ message: 'Mobile number is required' });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(mobile, otp);
  console.log(`[OTP SENT] to ${mobile}: ${otp}`);

  res.json({ message: 'OTP sent successfully (Mocked)', success: true });
});

// VERIFY OTP (Mocked)
router.post('/verify-otp', async (req, res) => {
  const { mobile, otp } = req.body;
  if (!mobile || !otp) return res.status(400).json({ message: 'Mobile and OTP are required' });

  const savedOtp = otpStore.get(mobile);
  if (savedOtp && savedOtp === otp) {
    otpStore.delete(mobile);
    
    // Find associated user
    const user = await prisma.user.findUnique({ where: { mobile } });
    if (!user) return res.status(404).json({ message: 'User not registered with this number' });

    const token = jwt.sign(
      { id: user.id, schoolId: user.schoolId, role: user.role, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({ token, user, message: 'OTP verified successfully' });
  }

  res.status(400).json({ message: 'Invalid OTP code' });
});

// CHANGE PASSWORD
router.put('/change-password', authenticateToken as any, async (req: AuthenticatedRequest, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isMatch) return res.status(400).json({ message: 'Incorrect old password' });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash }
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to change password', error: error.message });
  }
});

export default router;
