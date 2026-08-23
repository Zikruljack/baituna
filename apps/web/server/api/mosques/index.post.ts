import { requireAuth } from '../../utils/auth';
import { createMosqueSchema } from '../../utils/validation';
import { checkForDuplicate, createMosque } from '../../services/mosque.service';

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event);
  const input = await parseBody(event, createMosqueSchema);

  const db = useDatabase();
  const duplicateWarning = await checkForDuplicate(db, {
    name: input.name,
    latitude: input.latitude,
    longitude: input.longitude,
  });

  const mosque = await createMosque(db, input, auth.sub);

  event.node.res.statusCode = 201;
  return { ...mosque, duplicateWarning };
});
