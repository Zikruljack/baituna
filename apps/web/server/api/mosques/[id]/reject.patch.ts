import { rejectMosque } from '../../../services/mosque.service';
import { requireRole } from '../../../utils/auth';
import { uuidSchema } from '../../../utils/validation';

export default defineEventHandler(async (event) => {
  const auth = await requireRole(event, 'super_admin');
  const id = uuidSchema.parse(getRouterParam(event, 'id'));
  return await rejectMosque(useDatabase(), id, auth.sub);
});
