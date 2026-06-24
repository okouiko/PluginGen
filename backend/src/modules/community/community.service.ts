import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PublishPluginDto } from './dto/publish-plugin.dto';
import { UserLevelService } from '../user/user-level.service';
import { DailyTaskService } from '../daily/daily-task.service';
import type { CoreType } from '@prisma/client';

export interface SearchQuery {
  q?: string;
  coreType?: CoreType;
  mcVersion?: string;
  sort?: 'latest' | 'popular';
  page: number;
  limit: number;
}

@Injectable()
export class CommunityService {
  constructor(
    private prisma: PrismaService,
    private userLevelService: UserLevelService,
    private dailyTaskService: DailyTaskService,
  ) {}

  async publish(pluginId: string, userId: string, dto: PublishPluginDto) {
    const plugin = await this.prisma.pluginProject.findUnique({
      where: { id: pluginId },
    });
    if (!plugin) throw new NotFoundException('Plugin not found');
    if (plugin.userId !== userId) throw new ForbiddenException('Not your plugin');
    if (plugin.status !== 'COMPILED' && plugin.status !== 'MODIFIED') {
      throw new BadRequestException('Plugin must be compiled before publishing');
    }
    if (plugin.isPublished) {
      throw new BadRequestException('Plugin is already published');
    }

    const updated = await this.prisma.pluginProject.update({
      where: { id: pluginId },
      data: {
        isPublished: true,
        description: dto.description,
      },
    });

    this.userLevelService.addExp(userId, 'plugin_published').catch(() => {});
    this.dailyTaskService.updateProgress(userId, 'publish_plugin').catch(() => {});

    return updated;
  }

  async unpublish(pluginId: string, userId: string) {
    const plugin = await this.prisma.pluginProject.findUnique({
      where: { id: pluginId },
    });
    if (!plugin) throw new NotFoundException('Plugin not found');
    if (plugin.userId !== userId) throw new ForbiddenException('Not your plugin');

    return this.prisma.pluginProject.update({
      where: { id: pluginId },
      data: { isPublished: false },
    });
  }

  async search(query: SearchQuery) {
    const where: any = { isPublished: true };

    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    if (query.coreType) {
      where.coreType = query.coreType;
    }
    if (query.mcVersion) {
      where.mcVersion = query.mcVersion;
    }

    const orderBy: any =
      query.sort === 'popular'
        ? { downloadCount: 'desc' }
        : { createdAt: 'desc' };

    const [items, total] = await Promise.all([
      this.prisma.pluginProject.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          user: { select: { id: true, nickname: true, avatar: true } },
          ratings: { select: { score: true } },
        },
      }),
      this.prisma.pluginProject.count({ where }),
    ]);

    const mapped = items.map((p: any) => {
      const pRatings = p.ratings || [];
      const avgRating =
        pRatings.length > 0
          ? pRatings.reduce((s: number, r: any) => s + r.score, 0) / pRatings.length
          : 0;
      const rest = { ...p };
      delete rest.ratings;
      return {
        ...rest,
        avgRating: Math.round(avgRating * 10) / 10,
        ratingCount: pRatings.length,
      };
    });

    return {
      items: mapped,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async getDetail(pluginId: string, currentUserId?: string) {
    const plugin: any = await this.prisma.pluginProject.findUnique({
      where: { id: pluginId },
      include: {
        user: { select: { id: true, nickname: true, avatar: true, bio: true } },
        ratings: { select: { score: true } },
      },
    });

    if (!plugin || !plugin.isPublished) {
      throw new NotFoundException('Plugin not found');
    }

    const ratings = plugin.ratings || [];
    const avgRating =
      ratings.length > 0
        ? ratings.reduce((s: number, r: any) => s + r.score, 0) / ratings.length
        : 0;

    const pluginData = { ...plugin };
    delete pluginData.ratings;

    let userState: any = {
      isFavorited: false,
      isLiked: false,
      userRating: null,
      isFollowing: false,
      isOwner: false,
    };

    if (currentUserId) {
      const [favorite, like, rating, follow] = await Promise.all([
        this.prisma.favorite.findUnique({
          where: { userId_pluginId: { userId: currentUserId, pluginId } },
        }),
        this.prisma.like.findUnique({
          where: {
            userId_targetId_targetType: {
              userId: currentUserId,
              targetId: pluginId,
              targetType: 'PLUGIN',
            },
          },
        }),
        this.prisma.rating.findUnique({
          where: { userId_pluginId: { userId: currentUserId, pluginId } },
        }),
        this.prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: currentUserId,
              followingId: plugin.userId,
            },
          },
        }),
      ]);

      userState = {
        isFavorited: !!favorite,
        isLiked: !!like,
        userRating: rating?.score || null,
        isFollowing: !!follow,
        isOwner: plugin.userId === currentUserId,
      };
    }

    return {
      plugin: {
        ...pluginData,
        avgRating: Math.round(avgRating * 10) / 10,
        ratingCount: ratings.length,
      },
      ...userState,
    };
  }
}
