import { listAssignmentHistory } from '../../../../services/friday-assignment.service';
import { historyQuerySchema, parseQuery, uuidSchema } from '../../../../utils/validation';

export default defineEventHandler(async (event) => {
  const mosqueId = uuidSchema.parse(getRouterParam(event, 'id'));
  const query = await parseQuery(event, historyQuerySchema);
  return await listAssignmentHistory(useDatabase(), mosqueId, query);
});
