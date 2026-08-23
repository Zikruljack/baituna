import { listActiveProvinces } from '../../services/region.service';

export default defineEventHandler(async () => {
  const data = await listActiveProvinces(useDatabase());
  return { data };
});
