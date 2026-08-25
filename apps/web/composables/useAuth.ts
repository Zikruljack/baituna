// apps/web/composables/useAuth.ts
import type { AuthResponse, AuthUser } from '~/lib/auth-types';

const TOKEN_COOKIE = 'auth_token';
const TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7 days, matches server/services/token.ts TOKEN_LIFETIME

/** The bearer token cookie. Exported separately so useApi can read it without pulling in user state. */
export function useAuthToken() {
  return useCookie<string | null>(TOKEN_COOKIE, {
    sameSite: 'lax',
    path: '/',
    maxAge: TOKEN_MAX_AGE,
    default: () => null,
  });
}

export function useAuth() {
  const token = useAuthToken();
  const user = useState<AuthUser | null>('auth-user', () => null);
  const isAuthenticated = computed(() => Boolean(token.value && user.value));

  function setSession(auth: AuthResponse) {
    token.value = auth.token;
    user.value = auth.user;
  }

  async function login(email: string, password: string) {
    const auth = await $fetch<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setSession(auth);
  }

  function loginWithGoogle() {
    window.location.href = '/api/auth/google';
  }

  function logout() {
    token.value = null;
    user.value = null;
  }

  async function init() {
    if (user.value || !token.value) return;

    try {
      user.value = await $fetch<AuthUser>('/api/auth/me', {
        headers: { Authorization: `Bearer ${token.value}` },
      });
    } catch {
      token.value = null;
      user.value = null;
    }
  }

  return { user, isAuthenticated, setSession, login, loginWithGoogle, logout, init };
}
