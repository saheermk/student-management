import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { Env, Variables } from '../types';
import { settings, auditLog } from '../db/schema';
import { updateSettingsSchema } from '../../shared/schemas';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/role';

const settingsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

const DEFAULT_INSTITUTION_NAME = 'Student Management System';

/**
 * Helper to fetch key-value map of settings
 */
export async function getSettingsMap(db: ReturnType<typeof drizzle>): Promise<Record<string, string>> {
  const allSettings = await db.select().from(settings);
  const map: Record<string, string> = {};
  allSettings.forEach((row) => {
    map[row.key] = row.value;
  });
  return map;
}

// GET /api/settings (Public / Authenticated read of institution settings)
settingsRouter.get('/', async (c) => {
  const db = drizzle(c.env.DB);
  const map = await getSettingsMap(db);

  const institutionName = map['institution_name'] || DEFAULT_INSTITUTION_NAME;
  const logoKey = map['institution_logo_key'] || null;
  const logoUrl = logoKey ? '/api/settings/logo/file' : null;

  return c.json({
    institutionName,
    logoUrl,
    logoKey,
    updatedAt: map['institution_name_updated_at'] || new Date().toISOString(),
  });
});

// GET /api/settings/logo/file (Serves the logo image directly from R2)
settingsRouter.get('/logo/file', async (c) => {
  const db = drizzle(c.env.DB);
  const map = await getSettingsMap(db);
  const logoKey = map['institution_logo_key'];

  if (!logoKey || !c.env.BUCKET) {
    return c.text('Logo not found', 404);
  }

  const object = await c.env.BUCKET.get(logoKey);
  if (!object) {
    return c.text('Logo image object missing in storage', 404);
  }

  const contentType = object.httpMetadata?.contentType || 'image/png';
  const headers = new Headers();
  headers.set('Content-Type', contentType);
  headers.set('Cache-Control', 'public, max-age=3600');

  return new Response(object.body, {
    status: 200,
    headers,
  });
});

// PUT /api/settings (Admin updates institution name)
settingsRouter.put('/', authMiddleware, requireRole('admin'), async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));
  const parseResult = updateSettingsSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json({ error: 'Validation failed', details: parseResult.error.flatten() }, 400);
  }

  const { institutionName } = parseResult.data;
  const db = drizzle(c.env.DB);
  const now = new Date().toISOString();

  // Upsert institution_name
  const existing = await db.select().from(settings).where(eq(settings.key, 'institution_name'));
  if (existing.length > 0) {
    await db
      .update(settings)
      .set({ value: institutionName, updatedAt: now })
      .where(eq(settings.key, 'institution_name'));
  } else {
    await db.insert(settings).values({
      key: 'institution_name',
      value: institutionName,
      updatedAt: now,
    });
  }

  // Record audit log
  await db.insert(auditLog).values({
    userId: user.id,
    action: 'UPDATE_INSTITUTION_SETTINGS',
    entity: 'settings',
    details: JSON.stringify({ institutionName }),
    createdAt: now,
  });

  const map = await getSettingsMap(db);
  const logoKey = map['institution_logo_key'] || null;
  const logoUrl = logoKey ? '/api/settings/logo/file' : null;

  return c.json({
    message: 'Institution settings updated successfully',
    settings: {
      institutionName,
      logoUrl,
      logoKey,
      updatedAt: now,
    },
  });
});

// POST /api/settings/logo (Admin uploads logo to R2)
settingsRouter.post('/logo', authMiddleware, requireRole('admin'), async (c) => {
  const user = c.get('user');
  const contentType = c.req.header('content-type') || '';

  let fileBuffer: ArrayBuffer;
  let mimeType = 'image/png';

  if (contentType.includes('multipart/form-data')) {
    const formData = await c.req.parseBody();
    const file = formData['logo'];
    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No logo file provided in request' }, 400);
    }
    fileBuffer = await file.arrayBuffer();
    mimeType = file.type || 'image/png';
  } else {
    // Raw binary buffer upload
    fileBuffer = await c.req.arrayBuffer();
    mimeType = contentType || 'image/png';
  }

  if (fileBuffer.byteLength === 0) {
    return c.json({ error: 'Empty file provided' }, 400);
  }

  // Max size: 5MB
  if (fileBuffer.byteLength > 5 * 1024 * 1024) {
    return c.json({ error: 'Logo file size exceeds 5 MB limit' }, 400);
  }

  const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
  if (!allowedTypes.includes(mimeType)) {
    return c.json({ error: 'Invalid file format. Allowed: PNG, JPEG, SVG, WebP.' }, 400);
  }

  const extMap: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/svg+xml': 'svg',
    'image/webp': 'webp',
  };
  const ext = extMap[mimeType] || 'png';
  const r2Key = `institution/logo-${Date.now()}.${ext}`;

  if (c.env.BUCKET) {
    await c.env.BUCKET.put(r2Key, fileBuffer, {
      httpMetadata: { contentType: mimeType },
    });
  }

  const db = drizzle(c.env.DB);
  const now = new Date().toISOString();

  // Upsert institution_logo_key
  const existingKey = await db.select().from(settings).where(eq(settings.key, 'institution_logo_key'));
  if (existingKey.length > 0) {
    await db
      .update(settings)
      .set({ value: r2Key, updatedAt: now })
      .where(eq(settings.key, 'institution_logo_key'));
  } else {
    await db.insert(settings).values({
      key: 'institution_logo_key',
      value: r2Key,
      updatedAt: now,
    });
  }

  // Audit log entry
  await db.insert(auditLog).values({
    userId: user.id,
    action: 'UPLOAD_INSTITUTION_LOGO',
    entity: 'settings',
    details: JSON.stringify({ r2Key, mimeType }),
    createdAt: now,
  });

  return c.json({
    message: 'Institution logo uploaded successfully',
    logoUrl: '/api/settings/logo/file',
    logoKey: r2Key,
  });
});

export default settingsRouter;
