import { create } from 'zustand';

export interface User {
  id: string;
  email: string;
  nickname: string;
  avatar: string;
  level: number;
  exp: number;
  dailyQuota: number;
}

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: (() => {
    try {
      return localStorage.getItem('token');
    } catch {
      return null;
    }
  })(),
  user: (() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  })(),
  setAuth: (token: string, user: User) => {
    try {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    } catch {
      // localStorage not available
    }
    set({ token, user });
  },
  setUser: (user: User) => {
    try {
      localStorage.setItem('user', JSON.stringify(user));
    } catch {
      // localStorage not available
    }
    set({ user });
  },
  logout: () => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } catch {
      // localStorage not available
    }
    set({ token: null, user: null });
  },
}));
