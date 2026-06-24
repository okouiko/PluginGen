import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class RatingService {
  constructor(private prisma: PrismaService) {}

  async upsert(userId: string, pluginId: string, score: number) {
    const plugin = await this.prisma.pluginProject.findUnique({
      where: { id: pluginId },
    });
    if (!plugin) throw new NotFoundException('Plugin not found');
    if (plugin.userId === userId) {
      throw new BadRequestException('Cannot rate your own plugin');
    }

    await this.prisma.rating.upsert({
      where: { userId_pluginId: { userId, pluginId } },
      update: { score },
      create: { userId, pluginId, score },
    });

    const aggregate = await this.prisma.rating.aggregate({
      where: { pluginId },
      _avg: { score: true },
      _count: { score: true },
    });

    return {
      score,
      avgRating: Math.round((aggregate._avg.score || 0) * 10) / 10,
      ratingCount: aggregate._count.score,
    };
  }
}
