import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import type { ApiResponse } from '@/types/api';

interface AuthResult {
  access_token: string;
  user: {
    id: string;
    email: string;
    nickname: string;
    avatar: string;
    level: number;
    exp: number;
    dailyQuota: number;
  };
}

export function useAuth() {
  const navigate = useNavigate();
  const { token, user, setAuth, logout: storeLogout, setUser } =
    useAuthStore();
  const isAuthenticated = !!token;

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiClient.post<ApiResponse<AuthResult>>('/auth/login', {
        email,
        password,
      });
      const { access_token, user: userData } = res.data.data;
      setAuth(access_token, userData);
      return userData;
    },
    [setAuth],
  );

  const register = useCallback(
    async (email: string, password: string, nickname: string) => {
      const res = await apiClient.post<ApiResponse<AuthResult>>('/auth/register', {
        email,
        password,
        nickname,
      });
      const { access_token, user: userData } = res.data.data;
      setAuth(access_token, userData);
      return userData;
    },
    [setAuth],
  );

  const logout = useCallback(() => {
    storeLogout();
    navigate('/');
  }, [storeLogout, navigate]);

  const updateProfile = useCallback(
    async (data: { nickname?: string; bio?: string }) => {
      const res = await apiClient.patch<ApiResponse<{ id: string; nickname: string; bio: string | null }>>(
        '/user/profile',
        data,
      );
      const updated = res.data.data;
      if (user) {
        setUser({ ...user, nickname: updated.nickname });
      }
      return updated;
    },
    [user, setUser],
  );

  const getProfile = useCallback(async () => {
    const res = await apiClient.get<ApiResponse<AuthResult['user']>>('/user/profile');
    return res.data.data;
  }, []);

  return {
    user,
    token,
    isAuthenticated,
    login,
    register,
    logout,
    updateProfile,
    getProfile,
  };
}
