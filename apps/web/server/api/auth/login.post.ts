import { z } from 'zod';

import { verifyPassword } from '../../services/password';
import { signAuthToken } from '../../services/token';
import { findUserByEmail } from '../../services/user.service';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export default defineEventHandler(async (event) => {
  const { email, password } = await parseBody(event, loginSchema);
  const { jwtSecret } = useRuntimeConfig();

  if (!jwtSecret) {
    throw createError({ statusCode: 500, statusMessage: 'JWT_SECRET is not configured' });
  }

  const user = await findUserByEmail(useDatabase(), email);
  const invalid = () =>
    createError({ statusCode: 401, statusMessage: 'Invalid email or password' });

  if (!user?.passwordHash) throw invalid();
  if (!(await verifyPassword(password, user.passwordHash))) throw invalid();

  return {
    token: await signAuthToken({ sub: user.id, role: user.role }, jwtSecret),
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  };
});
