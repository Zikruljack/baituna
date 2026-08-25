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

export const createPersonSchema = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(30).nullable().default(null),
});

export const updatePersonSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    phone: z.string().trim().max(30).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });

export const createAssignmentSchema = z
  .object({
    assignmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    khatibPersonId: uuidSchema.nullable().default(null),
    imamPersonId: uuidSchema.nullable().default(null),
    muazzinPersonId: uuidSchema.nullable().default(null),
  })
  .refine((data) => data.khatibPersonId || data.imamPersonId || data.muazzinPersonId, {
    message: 'At least one of khatibPersonId, imamPersonId, muazzinPersonId is required',
  });

export const updateAssignmentSchema = z
  .object({
    khatibPersonId: uuidSchema.nullable().optional(),
    imamPersonId: uuidSchema.nullable().optional(),
    muazzinPersonId: uuidSchema.nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });

export const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().positive().max(50).default(5),
});

export async function parseBody<T>(event: Parameters<typeof readBody>[0], schema: ZodType<T>) {
  return await readValidatedBody(event, (body) => schema.parse(body));
}

export async function parseQuery<T>(event: Parameters<typeof getValidatedQuery>[0], schema: ZodType<T>) {
  return await getValidatedQuery(event, (query) => schema.parse(query));
}
