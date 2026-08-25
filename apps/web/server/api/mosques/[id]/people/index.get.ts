import { listActivePeople } from '../../../../services/person.service';
import { uuidSchema } from '../../../../utils/validation';

export default defineEventHandler(async (event) => {
  const mosqueId = uuidSchema.parse(getRouterParam(event, 'id'));
  return await listActivePeople(useDatabase(), mosqueId);
});
