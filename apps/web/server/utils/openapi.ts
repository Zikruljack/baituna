export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Baituna API',
    version: '0.1.0',
    description: 'Scaffold contract for the Baituna MVP API.',
  },
  paths: {
    '/mosques/nearby': {
      get: {
        summary: 'Find nearby approved mosques',
        parameters: [
          {
            name: 'lat',
            in: 'query',
            required: true,
            schema: { type: 'number' },
          },
          {
            name: 'lng',
            in: 'query',
            required: true,
            schema: { type: 'number' },
          },
          {
            name: 'radius',
            in: 'query',
            required: false,
            schema: { type: 'number', default: 5 },
          },
        ],
        responses: {
          200: { description: 'Mosques sorted by distance ascending' },
        },
      },
    },
    '/mosques/search': {
      get: {
        summary: 'Search approved mosques by name or address',
        parameters: [
          {
            name: 'q',
            in: 'query',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Mosques matching the keyword' },
        },
      },
    },
    '/mosques/{id}': {
      get: {
        summary: 'Get mosque detail',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: { description: 'Mosque detail' },
          404: { description: 'Mosque not found, not approved, or deleted' },
        },
      },
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
      get: {
        summary: 'Get this or next Friday assignment',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: { description: 'Either an assignment or { has_assignment: false, assignment_date }' },
        },
      },
    },
    '/mosques/{id}/friday-schedule/history': {
      get: {
        summary: 'Get paginated Friday assignment history',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
          { name: 'page', in: 'query', required: false, schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', required: false, schema: { type: 'integer', default: 20 } },
        ],
        responses: { 200: { description: 'Paginated assignments, newest first' } },
      },
    },
    '/mosques/{id}/friday-schedule': {
      post: {
        summary: 'Create a Friday assignment',
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
          201: { description: 'Assignment created' },
          409: { description: 'An assignment already exists for this date' },
          422: { description: 'Not a Friday, in the past, or an unknown person id' },
        },
      },
    },
    '/mosques/{id}/friday-schedule/{assignmentId}': {
      patch: {
        summary: 'Update a Friday assignment (future dates only)',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
          {
            name: 'assignmentId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: { description: 'Assignment updated' },
          403: { description: 'This assignment date has already passed' },
          404: { description: 'Assignment not found for this mosque' },
        },
      },
    },
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
    '/mosques/{id}/people': {
      get: {
        summary: 'List active Person entries for a mosque',
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
          200: { description: 'Active Person rows, alphabetical' },
        },
      },
      post: {
        summary: 'Add a Person to a mosque',
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
          201: { description: 'Person created' },
          403: { description: 'Caller does not own this mosque' },
        },
      },
    },
    '/mosques/{id}/people/{personId}': {
      patch: {
        summary: 'Update a Person',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
          {
            name: 'personId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: { description: 'Person updated' },
          404: { description: 'Person not found for this mosque' },
        },
      },
      delete: {
        summary: 'Soft-delete a Person',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
          {
            name: 'personId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: { description: 'Person soft-deleted' },
          404: { description: 'Person not found for this mosque' },
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
