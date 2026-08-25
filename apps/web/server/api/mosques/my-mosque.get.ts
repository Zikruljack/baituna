import { findMosqueByAdminUserId } from '../../services/mosque.service';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);
  return await findMosqueByAdminUserId(useDatabase(), auth.sub);
});
