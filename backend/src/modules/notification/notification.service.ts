import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationGateway } from './notification.gateway';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationService {
  constructor(
    private prisma: PrismaService,
    private wsGateway: NotificationGateway,
  ) {}

  async create(dto: CreateNotificationDto) {
    if (dto.userId === dto.actorId) return null;

    const notification = await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        data: {
          actorId: dto.actorId,
          actorNickname: dto.actorNickname || '',
          pluginId: dto.pluginId || '',
          pluginName: dto.pluginName || '',
          commentContent: dto.commentContent || '',
        },
      },
    });

    const totalCount = await this.prisma.notification.count({
      where: { userId: dto.userId },
    });
    if (totalCount > 100) {
      const oldest = await this.prisma.notification.findFirst({
        where: { userId: dto.userId },
        orderBy: { createdAt: 'asc' },
      });
      if (oldest) await this.prisma.notification.delete({ where: { id: oldest.id } });
    }

    const unreadCount = await this.prisma.notification.count({
      where: { userId: dto.userId, read: false },
    });

    this.wsGateway.pushToUser(dto.userId, 'notification.new', {
      notification,
      unreadCount,
    });

    return notification;
  }

  async findAll(userId: string, page = 1, limit = 20) {
    const where = { userId };

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { ...where, read: false } }),
    ]);

    return { items, total, unreadCount, page, limit };
  }

  async markRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!notification || notification.userId !== userId) return null;

    return this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    this.wsGateway.pushToUser(userId, 'notification.unread', { unreadCount: 0 });

    return { updatedCount: result.count };
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, read: false },
    });
    return { unreadCount: count };
  }
}
