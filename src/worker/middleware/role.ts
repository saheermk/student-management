import { MiddlewareHandler } from 'hono';
import { Env, Variables } from '../types';
import { UserRole } from '../../shared/schemas';

export function requireRole(...allowedRoles: UserRole[]): MiddlewareHandler<{ Bindings: Env; Variables: Variables }> {
  return async (c, next) => {
    const user = c.get('user');

    if (!user) {
      return c.json({ error: 'Unauthorized: user not authenticated' }, 401);
    }

    if (!allowedRoles.includes(user.role)) {
      return c.json({ error: 'Forbidden: insufficient permissions' }, 403);
    }

    await next();
  };
}
