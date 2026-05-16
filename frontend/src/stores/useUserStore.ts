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
  setUser: (user: UserMe | null) => void;
  setAccessToken: (token: string | null) => void;
  setLocale: (locale: string) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      locale: 'vi', // Default locale
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setAccessToken: (token) => set({ accessToken: token }),
      setLocale: (locale) => set({ locale }),
      logout: () => set({ user: null, accessToken: null, isAuthenticated: false }),
    }),
    {
      name: 'deutschflow-user-store',
      // We can pick what to persist, e.g., we probably shouldn't persist tokens in localStorage if we can avoid it, 
      // but if we are migrating from localStorage.getItem('auth_access'), we can keep it here for now.
    }
  )
);
