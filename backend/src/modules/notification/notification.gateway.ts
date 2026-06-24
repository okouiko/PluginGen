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
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: WebSocket.Server;

  private userSockets = new Map<string, Set<WebSocket.WebSocket>>();

  handleConnection(client: WebSocket.WebSocket) {
    const url = (client as any).url || '';
    const params = new URLSearchParams(url.split('?')[1] || '');
    const userId = params.get('userId') || '';

    if (userId) {
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client);
    }
  }

  handleDisconnect(client: WebSocket.WebSocket) {
    for (const [userId, sockets] of this.userSockets.entries()) {
      if (sockets.has(client)) {
        sockets.delete(client);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
        }
        break;
      }
    }
  }

  pushToUser(userId: string, event: string, data: unknown) {
    const sockets = this.userSockets.get(userId);
    if (!sockets) return;

    const message = JSON.stringify({ type: event, data });
    for (const client of sockets) {
      if (client.readyState === 1) {
        client.send(message);
      }
    }
  }
}
