import { updateAssignment } from '../../../../services/friday-assignment.service';
import { requireMosqueOwner } from '../../../../utils/auth';
import { parseBody, updateAssignmentSchema, uuidSchema } from '../../../../utils/validation';

export default defineEventHandler(async (event) => {
  const mosqueId = uuidSchema.parse(getRouterParam(event, 'id'));
  const assignmentId = uuidSchema.parse(getRouterParam(event, 'assignmentId'));
  const auth = await requireMosqueOwner(event, mosqueId);
  const updates = await parseBody(event, updateAssignmentSchema);
  return await updateAssignment(useDatabase(), mosqueId, assignmentId, updates, auth.sub);
});
