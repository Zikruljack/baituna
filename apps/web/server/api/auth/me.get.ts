import { findUserById } from '../../services/user.service';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const payload = await requireAuth(event);
  const user = await findUserById(useDatabase(), payload.sub);

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'User no longer exists' });
  }

  return user;
});
