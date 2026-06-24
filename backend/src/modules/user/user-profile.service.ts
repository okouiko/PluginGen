import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class UserProfileService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string, currentUserId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const [pluginCount, downloadsAgg, starsAgg, followerCount, plugins, isFollowing] =
      await Promise.all([
        this.prisma.pluginProject.count({
          where: { userId, isPublished: true },
        }),
        this.prisma.pluginProject.aggregate({
          where: { userId, isPublished: true },
          _sum: { downloadCount: true },
        }),
        this.prisma.pluginProject.aggregate({
          where: { userId, isPublished: true },
          _sum: { starCount: true },
        }),
        this.prisma.follow.count({ where: { followingId: userId } }),
        this.prisma.pluginProject.findMany({
          where: { userId, isPublished: true },
          orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
          include: { ratings: { select: { score: true } } },
        }),
        currentUserId
          ? this.prisma.follow.findUnique({
              where: {
                followerId_followingId: {
                  followerId: currentUserId,
                  followingId: userId,
                },
              },
            })
          : Promise.resolve(null),
      ]);

    const pluginsWithRating = plugins.map((p: any) => {
      const pRatings = p.ratings || [];
      const avgRating =
        pRatings.length > 0
          ? pRatings.reduce((s: number, r: any) => s + r.score, 0) / pRatings.length
          : 0;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { ratings, ...rest } = p;
      rest.avgRating = Math.round(avgRating * 10) / 10;
      return rest;
    });

    const title = this.getTitle(user.level);

    return {
      user: {
        id: user.id,
        nickname: user.nickname,
        avatar: user.avatar,
        bio: user.bio || '这个人很懒，什么都没有留下',
        level: user.level,
        exp: user.exp,
        title,
        expToNextLevel: user.level * 100,
        createdAt: user.createdAt,
      },
      stats: {
        pluginCount,
        totalDownloads: downloadsAgg._sum.downloadCount || 0,
        totalStars: starsAgg._sum.starCount || 0,
        followerCount,
      },
      plugins: pluginsWithRating,
      isFollowing: !!isFollowing,
      isOwner: currentUserId === userId,
    };
  }

  async setPinnedPlugins(userId: string, pluginIds: string[]) {
    if (pluginIds.length > 3) {
      throw new BadRequestException('Maximum 3 pinned plugins');
    }

    const plugins = await this.prisma.pluginProject.findMany({
      where: { id: { in: pluginIds }, userId },
    });
    if (plugins.length !== pluginIds.length) {
      throw new BadRequestException('Some plugins not found or not owned by you');
    }
    const unpublished = plugins.find((p) => !p.isPublished);
    if (unpublished) {
      throw new BadRequestException(`Cannot pin unpublished plugin: ${unpublished.name}`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.pluginProject.updateMany({
        where: { userId, isPinned: true },
        data: { isPinned: false },
      });
      await Promise.all(
        pluginIds.map((id) =>
          tx.pluginProject.update({
            where: { id },
            data: { isPinned: true },
          }),
        ),
      );
    });

    return { pinnedCount: pluginIds.length };
  }

  private getTitle(level: number): string {
    if (level <= 5) return '新手创客';
    if (level <= 15) return '进阶工匠';
    if (level <= 30) return '资深开发者';
    return '大师';
  }
}
