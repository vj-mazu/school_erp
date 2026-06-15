import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';

// Route Imports
import authRouter from './routes/auth';
import studentRouter from './routes/students';
import staffRouter from './routes/staff';
import attendanceRouter from './routes/attendance';
import academicRouter from './routes/academics';
import feeRouter from './routes/fees';
import documentRouter from './routes/documents';
import homeworkRouter from './routes/homework';
import communicationRouter from './routes/communication';
import payrollRouter from './routes/payroll';
import settingsRouter from './routes/settings';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: false // Allow loading static uploads on same/other origins in dev
}));

// CORS — restrict to FRONTEND_URL in production, allow all in dev
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(s => s.trim())
  : ['*'];

app.use(cors({
  origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-academic-year-id'],
  credentials: true
}));
app.use(express.json());

// Static uploads folder for profile pictures, PDFs, homework attachments
app.use('/uploads', express.static(path.join(__dirname, '..', 'public', 'uploads')));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'School ERP Server is running fine.' });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/students', studentRouter);
app.use('/api/staff', staffRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/academics', academicRouter);
app.use('/api/fees', feeRouter);
app.use('/api/tc', documentRouter); // TC endpoints nested under /api/tc or /api/documents
app.use('/api/certificates', documentRouter); // Certificate endpoints
app.use('/api/id-cards', documentRouter); // ID Card endpoints
app.use('/api/homework', homeworkRouter);
app.use('/api/circulars', communicationRouter);
app.use('/api/payroll', payrollRouter);
app.use('/api/settings', settingsRouter);

// Start Server (only if not imported by test suites)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`School ERP Server started on port ${PORT}`);
  });
}

export default app;
