import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth-store';

type MessageHandler = (data: unknown) => void;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<MessageHandler>>>(new Map());
  const reconnectAttemptRef = useRef(0);

  const connect = useCallback(() => {
    const state = useAuthStore.getState();
    const token = state.token;
    const userId = state.user?.id;
    if (!token || !userId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.hostname}:3000?userId=${userId}&token=${token}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const { type, data } = message;
        const typeHandlers = handlersRef.current.get(type);
        if (typeHandlers) {
          typeHandlers.forEach((handler) => handler(data));
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      const delay = Math.min(
        1000 * Math.pow(2, reconnectAttemptRef.current),
        30000,
      );
      reconnectAttemptRef.current++;
      setTimeout(() => connect(), delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  const on = useCallback((event: string, handler: MessageHandler) => {
    if (!handlersRef.current.has(event)) {
      handlersRef.current.set(event, new Set());
    }
    handlersRef.current.get(event)!.add(handler);
  }, []);

  const off = useCallback((event: string, handler: MessageHandler) => {
    handlersRef.current.get(event)?.delete(handler);
  }, []);

  return { on, off };
}
