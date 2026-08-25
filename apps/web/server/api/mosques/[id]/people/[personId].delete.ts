import { deletePerson } from '../../../../services/person.service';
import { requireMosqueOwner } from '../../../../utils/auth';
import { uuidSchema } from '../../../../utils/validation';

export default defineEventHandler(async (event) => {
  const mosqueId = uuidSchema.parse(getRouterParam(event, 'id'));
  const personId = uuidSchema.parse(getRouterParam(event, 'personId'));
  const auth = await requireMosqueOwner(event, mosqueId);
  return await deletePerson(useDatabase(), mosqueId, personId, auth.sub);
});
