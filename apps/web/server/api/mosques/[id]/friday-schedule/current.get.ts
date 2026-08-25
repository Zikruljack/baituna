import { getCurrentAssignment } from '../../../../services/friday-assignment.service';
import { uuidSchema } from '../../../../utils/validation';

export default defineEventHandler(async (event) => {
  const mosqueId = uuidSchema.parse(getRouterParam(event, 'id'));
  return await getCurrentAssignment(useDatabase(), mosqueId, new Date());
});
