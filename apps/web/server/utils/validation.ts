import { type ZodType, z } from 'zod';

export const uuidSchema = z.string().uuid();

export const createMosqueSchema = z.object({
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().min(1).max(500),
  latitude: z.string().regex(/^-?\d{1,3}\.\d{1,7}$/),
  longitude: z.string().regex(/^-?\d{1,3}\.\d{1,7}$/),
  cityId: uuidSchema,
  provinceId: uuidSchema,
});

export const updateMosqueSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    address: z.string().trim().min(1).max(500).optional(),
    latitude: z.string().regex(/^-?\d{1,3}\.\d{1,7}$/).optional(),
    longitude: z.string().regex(/^-?\d{1,3}\.\d{1,7}$/).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

export async function parseBody<T>(event: Parameters<typeof readBody>[0], schema: ZodType<T>) {
  return await readValidatedBody(event, (body) => schema.parse(body));
}
