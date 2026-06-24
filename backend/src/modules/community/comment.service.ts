import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { DailyTaskService } from '../daily/daily-task.service';
import { CreateCommentDto } from './dto/comment.dto';

@Injectable()
export class CommentService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private dailyTaskService: DailyTaskService,
  ) {}

  async create(userId: string, dto: CreateCommentDto) {
    const plugin = await this.prisma.pluginProject.findUnique({
      where: { id: dto.pluginId },
    });
    if (!plugin || !plugin.isPublished) {
      throw new NotFoundException('Plugin not found');
    }
    if (plugin.userId === userId) {
      throw new BadRequestException('Cannot comment on your own plugin');
    }

    const comment = await this.prisma.comment.create({
      data: {
        userId,
        pluginId: dto.pluginId,
        content: dto.content,
      },
      include: {
        user: { select: { id: true, nickname: true, avatar: true } },
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { nickname: true },
    });
    this.notificationService.create({
      userId: plugin.userId,
      actorId: userId,
      actorNickname: user?.nickname || '',
      type: 'comment',
      pluginId: dto.pluginId,
      pluginName: plugin.name,
      commentContent: dto.content,
    });

    this.dailyTaskService.updateProgress(userId, 'comment').catch(() => {});

    return comment;
  }

  async findByPlugin(pluginId: string) {
    return this.prisma.comment.findMany({
      where: { pluginId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, nickname: true, avatar: true } },
      },
    });
  }
}
