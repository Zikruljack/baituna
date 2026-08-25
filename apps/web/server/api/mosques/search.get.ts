import { searchMosquesByKeyword } from '../../services/mosque-search.service';
import { parseQuery, searchQuerySchema } from '../../utils/validation';

export default defineEventHandler(async (event) => {
  const query = await parseQuery(event, searchQuerySchema);

  return await searchMosquesByKeyword(useDatabase(), query.q);
});
