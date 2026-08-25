// apps/web/composables/usePeople.ts
import type { CreatePersonInput, Person, UpdatePersonInput } from '~/types/api';

/** CRUD for the Person (Khatib/Imam/Muazzin) roster, scoped per mosque. */
export function usePeople() {
  const token = useAuthToken();

  function authHeaders(): Record<string, string> {
    return token.value ? { Authorization: `Bearer ${token.value}` } : {};
  }

  async function listActive(mosqueId: string): Promise<Person[]> {
    return await $fetch<Person[]>(`/api/mosques/${mosqueId}/people`);
  }

  async function create(mosqueId: string, input: CreatePersonInput): Promise<Person> {
    return await $fetch<Person>(`/api/mosques/${mosqueId}/people`, {
      method: 'POST',
      headers: authHeaders(),
      body: input,
    });
  }

  async function update(mosqueId: string, personId: string, input: UpdatePersonInput): Promise<Person> {
    return await $fetch<Person>(`/api/mosques/${mosqueId}/people/${personId}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: input,
    });
  }

  async function remove(mosqueId: string, personId: string): Promise<{ id: string }> {
    return await $fetch<{ id: string }>(`/api/mosques/${mosqueId}/people/${personId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
  }

  return { listActive, create, update, remove };
}
