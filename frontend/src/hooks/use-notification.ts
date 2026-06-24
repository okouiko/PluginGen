import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { useWebSocket } from '@/hooks/use-websocket';
import { useNotificationStore } from '@/stores/notification-store';

export function useNotification() {
  const ws = useWebSocket();
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);

  useEffect(() => {
    ws.on('notification.new', (data: unknown) => {
      const d = data as {
        notification: {
          id: string;
          type: string;
          data: {
            actorNickname: string;
            pluginId?: string;
            pluginName?: string;
            commentContent?: string;
            actorId: string;
          };
        };
        unreadCount: number;
      };

      setUnreadCount(d.unreadCount);

      const typeLabels: Record<string, string> = {
        like: '赞了你的插件',
        comment: '评论了你的插件',
        favorite: '收藏了你的插件',
        follow: '关注了你',
      };

      const label =
        typeLabels[d.notification.type] || '与你互动';
      toast(
        `${d.notification.data.actorNickname} ${label}` +
          (d.notification.data.commentContent
            ? `: ${d.notification.data.commentContent}`
            : ''),
        { duration: 4000 },
      );
    });

    ws.on('message.new', (data: unknown) => {
      const d = data as {
        message: { fromNickname: string; content: string };
      };
      toast(
        `${d.message.fromNickname}: ${d.message.content}`,
        { duration: 4000 },
      );
    });

    ws.on('notification.unread', (data: unknown) => {
      const d = data as { unreadCount: number };
      setUnreadCount(d.unreadCount);
    });
  }, [ws, setUnreadCount]);
}
