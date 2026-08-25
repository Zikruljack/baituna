import { findNearbyMosques } from '../../services/mosque-search.service';
import { nearbyQuerySchema, parseQuery } from '../../utils/validation';

export default defineEventHandler(async (event) => {
  const query = await parseQuery(event, nearbyQuerySchema);

  return await findNearbyMosques(useDatabase(), {
    lat: query.lat,
    lng: query.lng,
    radiusKm: query.radius,
  });
});
