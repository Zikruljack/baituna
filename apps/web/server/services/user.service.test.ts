import { describe, expect, it, vi } from 'vitest';

import { findOrCreateGoogleUser } from './user.service';
import type { Database } from './user.service';

/** Minimal fake matching the Drizzle call chains the service uses. */
function fakeDb(options: { existing?: unknown[]; inserted?: unknown[] }) {
  const insertValues = vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue(options.inserted ?? []),
  });

  return {
    db: {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(options.existing ?? []),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({ values: insertValues }),
    } as unknown as Database,
    insertValues,
  };
}

const profile = { providerId: 'google-sub-123', email: 'aisyah@example.com', name: 'Aisyah' };

describe('findOrCreateGoogleUser', () => {
  it('returns the existing user without inserting', async () => {
    const { db } = fakeDb({
      existing: [
        { id: 'user-1', name: 'Aisyah', email: 'aisyah@example.com', role: 'mosque_admin' },
      ],
    });

    const user = await findOrCreateGoogleUser(db, profile);

    expect(user).toEqual({
      id: 'user-1',
      name: 'Aisyah',
      email: 'aisyah@example.com',
      role: 'mosque_admin',
    });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('creates a public_user when the provider id is unknown', async () => {
    const { db, insertValues } = fakeDb({
      existing: [],
      inserted: [
        { id: 'user-2', name: 'Aisyah', email: 'aisyah@example.com', role: 'public_user' },
      ],
    });

    const user = await findOrCreateGoogleUser(db, profile);

    expect(user.role).toBe('public_user');
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'google',
        providerId: 'google-sub-123',
        passwordHash: null,
        role: 'public_user',
      }),
    );
  });

  it('throws when the insert returns nothing', async () => {
    const { db } = fakeDb({ existing: [], inserted: [] });
    await expect(findOrCreateGoogleUser(db, profile)).rejects.toThrow('Failed to create user');
  });
});
