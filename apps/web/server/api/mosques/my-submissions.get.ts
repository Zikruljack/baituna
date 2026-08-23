import { listMySubmissions } from '../../services/mosque.service';
import { requireAuth } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);
  return await listMySubmissions(useDatabase(), auth.sub);
});
