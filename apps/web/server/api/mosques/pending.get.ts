import { listPendingMosques } from '../../services/mosque.service';
import { requireRole } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  await requireRole(event, 'super_admin');
  return await listPendingMosques(useDatabase());
});
