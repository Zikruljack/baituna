import { vi } from 'vitest';

vi.stubGlobal('createError', (input: { statusCode: number; statusMessage: string }) => {
  const error = new Error(input.statusMessage) as Error & { statusCode: number };
  error.statusCode = input.statusCode;
  return error;
});
