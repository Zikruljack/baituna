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
    '/mosques/{id}': { get: { summary: 'Get mosque detail' } },
    '/mosques/{id}/friday-schedule/current': {
      get: { summary: 'Get this or next Friday assignment' },
    },
    '/mosques/{id}/friday-schedule/history': {
      get: { summary: 'Get Friday assignment history' },
    },
    '/mosques/{id}/friday-schedule': { post: { summary: 'Create Friday assignment' } },
    '/mosques': { post: { summary: 'Submit mosque registration' } },
    '/mosques/{id}/approve': { patch: { summary: 'Approve mosque registration' } },
    '/mosques/{id}/reject': { patch: { summary: 'Reject mosque registration' } },
    '/mosques/pending': { get: { summary: 'List pending mosque registrations' } },
    '/auth/login': { post: { summary: 'Authenticate user' } },
  },
} as const;
