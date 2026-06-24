export interface Comment {
  id: string;
  userId: string;
  pluginId: string;
  content: string;
  createdAt: string;
}

export interface Rating {
  id: string;
  userId: string;
  pluginId: string;
  score: number;
  createdAt: string;
}

export interface Message {
  id: string;
  fromUserId: string;
  toUserId: string;
  content: string;
  read: boolean;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  data: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}
