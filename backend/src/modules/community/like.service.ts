import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import type { TargetType } from '@prisma/client';

@Injectable()
export class LikeService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  async toggle(userId: string, targetId: string, targetType: TargetType) {
    const existing = await this.prisma.like.findUnique({
      where: {
        userId_targetId_targetType: { userId, targetId, targetType },
      },
    });

    if (existing) {
      await this.prisma.like.delete({ where: { id: existing.id } });
      if (targetType === 'PLUGIN') {
        await this.prisma.pluginProject.update({
          where: { id: targetId },
          data: { starCount: { decrement: 1 } },
        });
      }
      return { liked: false };
    } else {
      await this.prisma.like.create({ data: { userId, targetId, targetType } });
      if (targetType === 'PLUGIN') {
        const plugin = await this.prisma.pluginProject.findUnique({
          where: { id: targetId },
        });
        await this.prisma.pluginProject.update({
          where: { id: targetId },
          data: { starCount: { increment: 1 } },
        });

        if (plugin && plugin.userId !== userId) {
          const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { nickname: true },
          });
          this.notificationService.create({
            userId: plugin.userId,
            actorId: userId,
            actorNickname: user?.nickname || '',
            type: 'like',
            pluginId: targetId,
            pluginName: plugin.name,
          });
        }
      }
      return { liked: true };
    }
  }
}
