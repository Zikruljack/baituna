import { findActiveProvince, listActiveCities } from '../../../services/region.service';
import { uuidSchema } from '../../../utils/validation';

export default defineEventHandler(async (event) => {
  const parsedId = uuidSchema.safeParse(getRouterParam(event, 'id'));
  if (!parsedId.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid Province ID' });
  }

  const db = useDatabase();
  const province = await findActiveProvince(db, parsedId.data);
  if (!province) {
    throw createError({ statusCode: 404, statusMessage: 'Province not found' });
  }

  return { data: await listActiveCities(db, province.id) };
});
