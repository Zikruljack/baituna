import { createAssignment } from '../../../../services/friday-assignment.service';
import { requireMosqueOwner } from '../../../../utils/auth';
import { createAssignmentSchema, parseBody, uuidSchema } from '../../../../utils/validation';

export default defineEventHandler(async (event) => {
  const mosqueId = uuidSchema.parse(getRouterParam(event, 'id'));
  const auth = await requireMosqueOwner(event, mosqueId);
  const input = await parseBody(event, createAssignmentSchema);
  return await createAssignment(useDatabase(), mosqueId, input, auth.sub);
});
