import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class FollowService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  async toggle(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new BadRequestException('Cannot follow yourself');
    }

    const existing = await this.prisma.follow.findUnique({
      where: {
        followerId_followingId: { followerId, followingId },
      },
    });

    if (existing) {
      await this.prisma.follow.delete({ where: { id: existing.id } });
      return { following: false };
    } else {
      await this.prisma.follow.create({
        data: { followerId, followingId },
      });

      const user = await this.prisma.user.findUnique({
        where: { id: followerId },
        select: { nickname: true },
      });
      this.notificationService.create({
        userId: followingId,
        actorId: followerId,
        actorNickname: user?.nickname || '',
        type: 'follow',
      });

      return { following: true };
    }
  }
}
