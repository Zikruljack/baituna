import { createMosqueSchema } from '../../utils/validation';
import { checkForDuplicate, createMosque } from '../../services/mosque.service';
import { signAuthToken, verifyAuthToken } from '../../services/token';

export default defineEventHandler(async (event) => {
  const input = await parseBody(event, createMosqueSchema);
  const { jwtSecret } = useRuntimeConfig();

  const authorization = getHeader(event, 'authorization');
  const bearerToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
  const authPayload = bearerToken && jwtSecret ? await verifyAuthToken(bearerToken, jwtSecret) : null;

  if (authPayload?.role === 'mosque_admin') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Akun Anda sudah menjadi admin masjid lain. Satu akun hanya bisa mengelola satu masjid.',
    });
  }

  const db = useDatabase();
  const duplicateWarning = await checkForDuplicate(db, {
    name: input.name,
    latitude: input.latitude,
    longitude: input.longitude,
  });

  const mosque = await createMosque(db, input, authPayload?.sub ?? null);

  event.node.res.statusCode = 201;

  if (mosque.newAccount && jwtSecret) {
    const token = await signAuthToken({ sub: mosque.newAccount.id, role: 'public_user' }, jwtSecret);
    return {
      id: mosque.id,
      name: mosque.name,
      status: mosque.status,
      duplicateWarning,
      token,
      user: mosque.newAccount,
    };
  }

  return { id: mosque.id, name: mosque.name, status: mosque.status, duplicateWarning };
});
