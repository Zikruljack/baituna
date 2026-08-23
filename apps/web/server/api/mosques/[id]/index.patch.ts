import { updateApprovedMosque } from '../../../services/mosque.service';
import { requireMosqueOwner } from '../../../utils/auth';
import { parseBody, updateMosqueSchema, uuidSchema } from '../../../utils/validation';

export default defineEventHandler(async (event) => {
  const id = uuidSchema.parse(getRouterParam(event, 'id'));
  const auth = await requireMosqueOwner(event, id);
  const updates = await parseBody(event, updateMosqueSchema);
  return await updateApprovedMosque(useDatabase(), id, updates, auth.sub);
});
