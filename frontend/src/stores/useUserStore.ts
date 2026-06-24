import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UserMe {
  id: string;
  email: string;
  roles: string[];
  displayName?: string;
  avatarUrl?: string;
}

interface UserState {
  user: UserMe | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  locale: string;
  // Org (tenant) context. null/undefined for B2C / non-org users. orgRole is the role WITHIN the
  // org (OWNER|ADMIN|TEACHER|STUDENT), separate from the global user role.
  orgId?: number | null;
  orgRole?: string | null;
  setUser: (user: UserMe | null) => void;
  setAccessToken: (token: string | null) => void;
  setLocale: (locale: string) => void;
  setOrg: (org: { orgId?: number | null; orgRole?: string | null }) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      locale: 'vi', // Default locale
      orgId: null,
      orgRole: null,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setAccessToken: (token) => set({ accessToken: token }),
      setLocale: (locale) => set({ locale }),
      setOrg: ({ orgId, orgRole }) => set({ orgId: orgId ?? null, orgRole: orgRole ?? null }),
      logout: () => set({ user: null, accessToken: null, isAuthenticated: false, orgId: null, orgRole: null }),
    }),
    {
      name: 'deutschflow-user-store',
      // NEVER persist the access token (audit FE-6): a raw JWT in localStorage survives browser close
      // and is fully readable by any XSS. The token's source of truth is authSession (sessionStorage +
      // httpOnly refresh cookie), so accessToken stays in-memory only and is excluded here.
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        locale: state.locale,
        orgId: state.orgId,
        orgRole: state.orgRole,
      }),
    }
  )
);
