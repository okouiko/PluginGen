import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import type { ApiResponse } from '@/types/api';

interface Conversation {
  userId: string;
  nickname: string;
  avatar: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

interface Message {
  id: string;
  fromUserId: string;
  content: string;
  createdAt: string;
}

export default function MessagesPage() {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations, isLoading: convLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<Conversation[]>>(
        '/messages/conversations',
      );
      return res.data.data;
    },
  });

  const { data: chatData, isLoading: chatLoading } = useQuery({
    queryKey: ['messages', selectedUserId],
    queryFn: async () => {
      const res = await apiClient.get<
        ApiResponse<{
          messages: Message[];
          user: { id: string; nickname: string; avatar: string };
          page: number;
          hasMore: boolean;
        }>
      >(`/messages/${selectedUserId}`);
      return res.data.data;
    },
    enabled: !!selectedUserId,
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiClient.post('/messages', {
        toUserId: selectedUserId,
        content,
      });
      return res.data;
    },
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['messages', selectedUserId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiClient.patch(`/messages/read/${userId}`);
    },
  });

  useEffect(() => {
    if (selectedUserId) {
      markReadMutation.mutate(selectedUserId);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    }
  }, [selectedUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatData?.messages]);

  const handleSend = () => {
    if (!newMessage.trim() || !selectedUserId) return;
    sendMutation.mutate(newMessage.trim());
  };

  if (convLoading) return <LoadingSpinner />;

  const convList = conversations || [];

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-[1000px]">
      {/* Conversation list */}
      <aside className="w-72 overflow-y-auto border-r border-hairline bg-canvas">
        <div className="border-b border-hairline p-md">
          <h2 className="font-sans text-title-sm text-ink">私信</h2>
        </div>
        {convList.length === 0 ? (
          <div className="p-md font-sans text-body-sm text-muted">
            暂无私信
          </div>
        ) : (
          convList.map((conv) => (
            <button
              key={conv.userId}
              onClick={() => setSelectedUserId(conv.userId)}
              className={`w-full border-b border-hairline p-md text-left transition-colors hover:bg-surface-soft ${
                selectedUserId === conv.userId ? 'bg-surface-soft' : ''
              }`}
            >
              <div className="flex items-center gap-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-caption text-on-primary">
                  {conv.nickname.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="font-sans text-body-sm text-ink">
                      {conv.nickname}
                    </span>
                    {conv.unreadCount > 0 && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-error text-caption text-on-primary">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="truncate font-sans text-body-sm text-muted">
                    {conv.lastMessage}
                  </p>
                </div>
              </div>
            </button>
          ))
        )}
      </aside>

      {/* Chat panel */}
      <main className="flex flex-1 flex-col">
        {selectedUserId && chatData ? (
          <>
            <div className="border-b border-hairline bg-canvas p-md">
              <div className="flex items-center gap-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-caption text-on-primary">
                  {chatData.user.nickname.charAt(0).toUpperCase()}
                </div>
                <span className="font-sans text-title-sm text-ink">
                  {chatData.user.nickname}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-md">
              {chatLoading ? (
                <LoadingSpinner />
              ) : (
                <div className="space-y-sm">
                  {chatData.messages.map((msg) => {
                    const isMine = msg.fromUserId === currentUserId;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg px-md py-sm font-sans text-body-sm ${
                            isMine
                              ? 'bg-primary text-on-primary'
                              : 'bg-surface-card text-ink'
                          }`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <div className="border-t border-hairline bg-canvas p-md">
              <div className="flex gap-sm">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="输入消息…"
                  className="flex-1 rounded-md border border-hairline bg-canvas px-3.5 py-2 font-sans text-body-sm text-ink outline-none focus:border-primary focus:ring-3 focus:ring-primary/15"
                />
                <button
                  onClick={handleSend}
                  disabled={sendMutation.isPending || !newMessage.trim()}
                  className="rounded-md bg-primary px-4 py-2 font-sans text-button text-on-primary transition-colors hover:bg-primary-active disabled:bg-primary-disabled"
                >
                  发送
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="font-sans text-body-md text-muted">
              选择一个会话开始聊天
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
