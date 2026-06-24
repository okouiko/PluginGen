export interface User {
  id: string;
  email: string;
  nickname: string;
  avatar: string;
  bio: string | null;
  level: number;
  exp: number;
  dailyQuota: number;
  createdAt: string;
}
