import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificationGateway } from '../notification/notification.gateway';

export const EXP_EVENTS = {
  plugin_generated: 10,
  plugin_published: 20,
  plugin_liked: 5,
  plugin_favorited: 3,
  user_signed_in: 5,
} as const;

export type ExpEvent = keyof typeof EXP_EVENTS;

@Injectable()
export class UserLevelService {
  constructor(
    private prisma: PrismaService,
    private wsGateway: NotificationGateway,
  ) {}

  async addExp(
    userId: string,
    event: ExpEvent,
  ): Promise<{ exp: number; level: number; leveledUp: boolean }> {
    const amount = EXP_EVENTS[event];
    if (!amount) throw new BadRequestException(`Unknown exp event: ${event}`);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { exp: 0, level: 1, leveledUp: false };

    const newExp = user.exp + amount;
    const newLevel = this.calculateLevel(newExp);
    const leveledUp = newLevel > user.level;

    await this.prisma.user.update({
      where: { id: userId },
      data: { exp: newExp, level: newLevel },
    });

    if (leveledUp) {
      this.wsGateway.pushToUser(userId, 'level.up', {
        oldLevel: user.level,
        newLevel,
        title: this.getTitle(newLevel),
      });
    }

    return { exp: newExp, level: newLevel, leveledUp };
  }

  calculateLevel(exp: number): number {
    let level = 1;
    let remaining = exp;
    for (let i = 1; i <= 50; i++) {
      const needed = i * 100;
      if (remaining < needed) break;
      remaining -= needed;
      level = i + 1;
    }
    return Math.min(level, 50);
  }

  getTitle(level: number): string {
    if (level <= 5) return '新手创客';
    if (level <= 15) return '进阶工匠';
    if (level <= 30) return '资深开发者';
    return '大师';
  }

  async getLevelInfo(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    const level = user.level;
    const exp = user.exp;
    const expToNextLevel = level * 100;

    // Calculate progress within current level
    let expAtCurrentLevelStart = 0;
    for (let i = 1; i < level; i++) {
      expAtCurrentLevelStart += i * 100;
    }
    const expInCurrentLevel = exp - expAtCurrentLevelStart;
    const progress = Math.min(1, expInCurrentLevel / expToNextLevel);

    return {
      level,
      exp,
      expToNextLevel,
      title: this.getTitle(level),
      progress,
    };
  }
}
