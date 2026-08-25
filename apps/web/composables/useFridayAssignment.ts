// apps/web/composables/useFridayAssignment.ts
import type {
  CreateAssignmentInput,
  CurrentFridayAssignment,
  FridayAssignment,
  PaginatedAssignments,
  UpdateAssignmentInput,
} from '~/types/api';

export function useFridayAssignment() {
  const token = useAuthToken();

  function authHeaders(): Record<string, string> {
    return token.value ? { Authorization: `Bearer ${token.value}` } : {};
  }

  async function getCurrent(mosqueId: string): Promise<CurrentFridayAssignment> {
    return await $fetch<CurrentFridayAssignment>(`/api/mosques/${mosqueId}/friday-schedule/current`);
  }

  async function getHistory(mosqueId: string, page: number = 1, pageSize: number = 20): Promise<PaginatedAssignments> {
    return await $fetch<PaginatedAssignments>(`/api/mosques/${mosqueId}/friday-schedule/history`, {
      query: { page, pageSize },
    });
  }

  async function create(mosqueId: string, input: CreateAssignmentInput): Promise<FridayAssignment> {
    return await $fetch<FridayAssignment>(`/api/mosques/${mosqueId}/friday-schedule`, {
      method: 'POST',
      body: input,
      headers: authHeaders(),
    });
  }

  async function update(mosqueId: string, assignmentId: string, input: UpdateAssignmentInput): Promise<FridayAssignment> {
    return await $fetch<FridayAssignment>(`/api/mosques/${mosqueId}/friday-schedule/${assignmentId}`, {
      method: 'PATCH',
      body: input,
      headers: authHeaders(),
    });
  }

  return { getCurrent, getHistory, create, update };
}
