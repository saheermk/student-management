import { Hono } from 'hono';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import adminRouter from './routes/admin';
import seedRouter from './routes/seed';
import academicRouter from './routes/academic';
import teachersRouter from './routes/teachers';
import studentsRouter from './routes/students';
import attendanceRouter from './routes/attendance';
import examsRouter from './routes/exams';
import feesRouter from './routes/fees';
import leavesRouter from './routes/leaves';
import settingsRouter from './routes/settings';
import analyticsRouter from './routes/analytics';
import { Env, Variables } from './types';

export type { Env, Variables };

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// API routes
app.route('/api/health', healthRouter);
app.route('/api/auth', authRouter);
app.route('/api/admin', adminRouter);
app.route('/api/seed', seedRouter);

// Phase 2 Routes
app.route('/api', academicRouter); // Handles /api/academic-years, /api/classes, /api/subjects
app.route('/api/teachers', teachersRouter);
app.route('/api/students', studentsRouter);

// Phase 3 Routes
app.route('/api/attendance', attendanceRouter);

// Phase 4 Routes
app.route('/api/exams', examsRouter);

// Phase 5 Routes
app.route('/api/fees', feesRouter);

// Phase 6 Routes
app.route('/api/leaves', leavesRouter);

// Institution Settings Routes
app.route('/api/settings', settingsRouter);

// Analytics & Visualizations Routes
app.route('/api/analytics', analyticsRouter);



// Fallback to static assets for non-API routes (when served by Cloudflare Worker)
app.all('*', async (c) => {
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.text('Student Management System API', 200);
});

export default app;
