export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Baituna API',
    version: '0.1.0',
    description: 'Scaffold contract for the Baituna MVP API.',
  },
  paths: {
    '/mosques/nearby': { get: { summary: 'Find nearby approved mosques' } },
    '/mosques/search': { get: { summary: 'Search approved mosques' } },
    '/mosques/{id}': {
      get: { summary: 'Get mosque detail' },
      patch: {
        summary: 'Edit an approved mosque (owner only)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: { description: 'Mosque updated' },
          403: { description: 'Caller does not own this mosque' },
          409: { description: 'Mosque is not approved yet' },
        },
      },
    },
    '/mosques/{id}/friday-schedule/current': {
      get: { summary: 'Get this or next Friday assignment' },
    },
    '/mosques/{id}/friday-schedule/history': {
      get: { summary: 'Get Friday assignment history' },
    },
    '/mosques/{id}/friday-schedule': { post: { summary: 'Create Friday assignment' } },
    '/mosques': {
      post: {
        summary: 'Submit mosque registration',
        security: [{ bearerAuth: [] }],
        responses: {
          201: { description: 'Created with status=pending and a duplicateWarning list' },
        },
      },
    },
    '/mosques/{id}/approve': {
      patch: {
        summary: 'Approve mosque registration',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: { description: 'Mosque approved; submitter upgraded to mosque_admin' },
          404: { description: 'Mosque not found' },
          409: { description: 'Mosque is not pending' },
        },
      },
    },
    '/mosques/{id}/reject': {
      patch: {
        summary: 'Reject mosque registration',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: { description: 'Mosque rejected; submitter role unchanged' },
          404: { description: 'Mosque not found' },
          409: { description: 'Mosque is not pending' },
        },
      },
    },
    '/mosques/pending': {
      get: {
        summary: 'List pending mosque registrations',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Pending mosques, oldest first' },
        },
      },
    },
    '/mosques/my-submissions': {
      get: {
        summary: "List the caller's own mosque submissions and their status",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Submissions in any status, newest first' },
        },
      },
    },
    '/auth/login': { post: { summary: 'Authenticate user' } },
    '/provinces': {
      get: {
        summary: 'List active Provinces',
        security: [],
        responses: {
          200: { description: 'Active Provinces sorted by name' },
        },
      },
    },
    '/provinces/{id}/cities': {
      get: {
        summary: 'List active Cities in a Province',
        security: [],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: { description: 'Active Cities sorted by name' },
          400: { description: 'Malformed Province UUID' },
          404: { description: 'Province not found or has been soft-deleted' },
        },
      },
    },
  },
} as const;
