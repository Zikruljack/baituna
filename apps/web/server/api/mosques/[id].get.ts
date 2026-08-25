import { findApprovedMosqueById } from '../../services/mosque-search.service';
import { uuidSchema } from '../../utils/validation';

export default defineEventHandler(async (event) => {
  const id = uuidSchema.parse(getRouterParam(event, 'id'));
  const mosque = await findApprovedMosqueById(useDatabase(), id);

  if (!mosque) {
    throw createError({ statusCode: 404, statusMessage: 'Mosque not found' });
  }

  return mosque;
});
