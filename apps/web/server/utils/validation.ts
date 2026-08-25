import { type ZodType, z } from 'zod';

export const uuidSchema = z.string().uuid();

const latitudeSchema = z
  .string()
  .regex(/^-?\d{1,3}\.\d{1,7}$/)
  .refine((value) => {
    const parsed = Number.parseFloat(value);
    return parsed >= -90 && parsed <= 90;
  }, 'latitude must be between -90 and 90');

const longitudeSchema = z
  .string()
  .regex(/^-?\d{1,3}\.\d{1,7}$/)
  .refine((value) => {
    const parsed = Number.parseFloat(value);
    return parsed >= -180 && parsed <= 180;
  }, 'longitude must be between -180 and 180');

export const createMosqueSchema = z.object({
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().min(1).max(500),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  cityId: uuidSchema,
  provinceId: uuidSchema,
});

export const updateMosqueSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    address: z.string().trim().min(1).max(500).optional(),
    latitude: latitudeSchema.optional(),
    longitude: longitudeSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

export async function parseBody<T>(event: Parameters<typeof readBody>[0], schema: ZodType<T>) {
  return await readValidatedBody(event, (body) => schema.parse(body));
}
