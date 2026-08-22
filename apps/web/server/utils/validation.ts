import { type ZodType, z } from 'zod';

export const uuidSchema = z.string().uuid();

export async function parseBody<T>(event: Parameters<typeof readBody>[0], schema: ZodType<T>) {
  return await readValidatedBody(event, (body) => schema.parse(body));
}
