import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationGateway } from './notification.gateway';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class MessageService {
  constructor(
    private prisma: PrismaService,
    private wsGateway: NotificationGateway,
  ) {}

  async send(fromUserId: string, dto: SendMessageDto) {
    if (fromUserId === dto.toUserId) {
      throw new BadRequestException('Cannot send message to yourself');
    }

    const toUser = await this.prisma.user.findUnique({
      where: { id: dto.toUserId },
      select: { id: true, nickname: true },
    });
    if (!toUser) throw new NotFoundException('User not found');

    const fromUser = await this.prisma.user.findUnique({
      where: { id: fromUserId },
      select: { id: true, nickname: true },
    });

    const message = await this.prisma.message.create({
      data: {
        fromUserId,
        toUserId: dto.toUserId,
        content: dto.content,
      },
    });

    this.wsGateway.pushToUser(dto.toUserId, 'message.new', {
      message: {
        ...message,
        fromNickname: fromUser?.nickname || '',
      },
    });

    return message;
  }

  async getConversations(userId: string) {
    const messages = await this.prisma.message.findMany({
      where: {
        OR: [{ fromUserId: userId }, { toUserId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    const conversationMap = new Map<
      string,
      {
        userId: string;
        nickname: string;
        avatar: string;
        lastMessage: string;
        lastMessageAt: Date;
        unreadCount: number;
      }
    >();

    for (const msg of messages) {
      const otherUserId =
        msg.fromUserId === userId ? msg.toUserId : msg.fromUserId;

      if (!conversationMap.has(otherUserId)) {
        const otherUser = await this.prisma.user.findUnique({
          where: { id: otherUserId },
          select: { id: true, nickname: true, avatar: true },
        });
        if (!otherUser) continue;

        conversationMap.set(otherUserId, {
          userId: otherUserId,
          nickname: otherUser.nickname,
          avatar: otherUser.avatar,
          lastMessage: msg.content,
          lastMessageAt: msg.createdAt,
          unreadCount: 0,
        });
      }

      const conv = conversationMap.get(otherUserId)!;
      if (msg.toUserId === userId && !msg.read) {
        conv.unreadCount++;
      }
    }

    return Array.from(conversationMap.values()).sort(
      (a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime(),
    );
  }

  async getHistory(
    userId: string,
    otherUserId: string,
    page = 1,
    limit = 50,
  ) {
    const messages = await this.prisma.message.findMany({
      where: {
        OR: [
          { fromUserId: userId, toUserId: otherUserId },
          { fromUserId: otherUserId, toUserId: userId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit + 1,
    });

    const hasMore = messages.length > limit;
    if (hasMore) messages.pop();

    const otherUser = await this.prisma.user.findUnique({
      where: { id: otherUserId },
      select: { id: true, nickname: true, avatar: true },
    });

    return {
      messages: messages.reverse(),
      user: otherUser,
      page,
      hasMore,
    };
  }

  async markRead(userId: string, fromUserId: string) {
    await this.prisma.message.updateMany({
      where: {
        toUserId: userId,
        fromUserId,
        read: false,
      },
      data: { read: true },
    });
    return { success: true };
  }
}
