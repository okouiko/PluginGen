import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import type WebSocket from 'ws';

@WebSocketGateway({
  cors: { origin: ['http://localhost:5173'], credentials: true },
})
export class ProgressGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: WebSocket.Server;

  private clients = new Map<string, Set<WebSocket.WebSocket>>();

  handleConnection(client: WebSocket.WebSocket, ..._args: unknown[]) {
    const url = (client as any).url || '';
    const params = new URLSearchParams(url.split('?')[1] || '');
    const userId = params.get('userId') || '';

    if (userId) {
      if (!this.clients.has(userId)) {
        this.clients.set(userId, new Set());
      }
      this.clients.get(userId)!.add(client);
    }
  }

  handleDisconnect(client: WebSocket.WebSocket) {
    for (const [userId, sockets] of this.clients.entries()) {
      if (sockets.has(client)) {
        sockets.delete(client);
        if (sockets.size === 0) {
          this.clients.delete(userId);
        }
        break;
      }
    }
  }

  pushProgress(userId: string, type: string, percent: number, stage: string) {
    const sockets = this.clients.get(userId);
    if (!sockets) return;

    const message = JSON.stringify({
      type: `${type}.progress`,
      data: { percent, stage },
    });

    for (const client of sockets) {
      if (client.readyState === 1) {
        client.send(message);
      }
    }
  }

  pushEvent(userId: string, type: string, event: string, data: unknown) {
    const sockets = this.clients.get(userId);
    if (!sockets) return;

    const message = JSON.stringify({
      type: `${type}.${event}`,
      data,
    });

    for (const client of sockets) {
      if (client.readyState === 1) {
        client.send(message);
      }
    }
  }
}
