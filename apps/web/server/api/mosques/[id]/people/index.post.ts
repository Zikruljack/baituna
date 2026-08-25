import { createPerson } from '../../../../services/person.service';
import { requireMosqueOwner } from '../../../../utils/auth';
import { createPersonSchema, parseBody, uuidSchema } from '../../../../utils/validation';

export default defineEventHandler(async (event) => {
  const mosqueId = uuidSchema.parse(getRouterParam(event, 'id'));
  const auth = await requireMosqueOwner(event, mosqueId);
  const input = await parseBody(event, createPersonSchema);
  return await createPerson(useDatabase(), mosqueId, input, auth.sub);
});
