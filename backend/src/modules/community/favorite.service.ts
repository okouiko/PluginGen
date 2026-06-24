import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class FavoriteService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  async toggle(userId: string, pluginId: string) {
    const plugin = await this.prisma.pluginProject.findUnique({
      where: { id: pluginId },
    });
    if (!plugin) throw new NotFoundException('Plugin not found');

    const existing = await this.prisma.favorite.findUnique({
      where: { userId_pluginId: { userId, pluginId } },
    });

    if (existing) {
      await this.prisma.favorite.delete({ where: { id: existing.id } });
      await this.prisma.pluginProject.update({
        where: { id: pluginId },
        data: { favoriteCount: { decrement: 1 } },
      });
      const p = await this.prisma.pluginProject.findUnique({
        where: { id: pluginId },
        select: { favoriteCount: true },
      });
      return { favorited: false, favoriteCount: p?.favoriteCount || 0 };
    } else {
      await this.prisma.favorite.create({ data: { userId, pluginId } });
      await this.prisma.pluginProject.update({
        where: { id: pluginId },
        data: { favoriteCount: { increment: 1 } },
      });
      const p = await this.prisma.pluginProject.findUnique({
        where: { id: pluginId },
        select: { favoriteCount: true },
      });

      if (plugin.userId !== userId) {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { nickname: true },
        });
        this.notificationService.create({
          userId: plugin.userId,
          actorId: userId,
          actorNickname: user?.nickname || '',
          type: 'favorite',
          pluginId,
          pluginName: plugin.name,
        });
      }

      return { favorited: true, favoriteCount: p?.favoriteCount || 0 };
    }
  }
}
