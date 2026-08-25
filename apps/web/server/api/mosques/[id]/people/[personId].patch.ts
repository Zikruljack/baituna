import { updatePerson } from '../../../../services/person.service';
import { requireMosqueOwner } from '../../../../utils/auth';
import { parseBody, updatePersonSchema, uuidSchema } from '../../../../utils/validation';

export default defineEventHandler(async (event) => {
  const mosqueId = uuidSchema.parse(getRouterParam(event, 'id'));
  const personId = uuidSchema.parse(getRouterParam(event, 'personId'));
  const auth = await requireMosqueOwner(event, mosqueId);
  const updates = await parseBody(event, updatePersonSchema);
  return await updatePerson(useDatabase(), mosqueId, personId, updates, auth.sub);
});
