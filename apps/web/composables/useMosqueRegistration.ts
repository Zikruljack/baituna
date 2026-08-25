// apps/web/composables/useMosqueRegistration.ts
import type {
  CreatedMosqueRegistration,
  MosqueRegistrationInput,
  MySubmission,
  PendingMosque,
} from '~/types/api';

/** Write/read actions for the Module 3 mosque registration & approval lifecycle. */
export function useMosqueRegistration() {
  const token = useAuthToken();

  function authHeaders(): Record<string, string> {
    return token.value ? { Authorization: `Bearer ${token.value}` } : {};
  }

  async function submitMosqueRegistration(input: MosqueRegistrationInput) {
    return await $fetch<CreatedMosqueRegistration>('/api/mosques', {
      method: 'POST',
      headers: authHeaders(),
      body: input,
    });
  }

  async function listPendingMosques() {
    return await $fetch<PendingMosque[]>('/api/mosques/pending', {
      headers: authHeaders(),
    });
  }

  async function approveMosque(mosqueId: string) {
    return await $fetch<{ id: string; status: 'approved' }>(`/api/mosques/${mosqueId}/approve`, {
      method: 'PATCH',
      headers: authHeaders(),
    });
  }

  async function rejectMosque(mosqueId: string) {
    return await $fetch<{ id: string; status: 'rejected' }>(`/api/mosques/${mosqueId}/reject`, {
      method: 'PATCH',
      headers: authHeaders(),
    });
  }

  async function listMySubmissions() {
    return await $fetch<MySubmission[]>('/api/mosques/my-submissions', {
      headers: authHeaders(),
    });
  }

  return {
    submitMosqueRegistration,
    listPendingMosques,
    approveMosque,
    rejectMosque,
    listMySubmissions,
  };
}
