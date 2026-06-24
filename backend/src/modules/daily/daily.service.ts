import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UserLevelService } from '../user/user-level.service';
import { DailyTaskService } from './daily-task.service';

@Injectable()
export class DailyService {
  private checkedInToday = new Set<string>();

  constructor(
    private prisma: PrismaService,
    private userLevelService: UserLevelService,
    private taskService: DailyTaskService,
  ) {}

  private getTodayDate(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }

  async checkin(userId: string) {
    const today = this.getTodayDate();
    const dateKey = today.toISOString().split('T')[0];
    const dedupKey = `checkin:${dateKey}:${userId}`;

    const existingRecord = await this.prisma.dailyCheckIn.findUnique({
      where: { userId_date: { userId, date: today } },
    });
    if (existingRecord) {
      throw new ConflictException('Already checked in today');
    }

    this.checkedInToday.add(dedupKey);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayCheckin = await this.prisma.dailyCheckIn.findUnique({
      where: { userId_date: { userId, date: yesterday } },
    });
    const streak = yesterdayCheckin ? yesterdayCheckin.streak + 1 : 1;

    await this.prisma.dailyCheckIn.create({
      data: { userId, date: today, streak },
    });

    const base = 5;
    const bonus7 = streak > 0 && streak % 7 === 0 ? 10 : 0;
    const bonus30 = streak > 0 && streak % 30 === 0 ? 30 : 0;
    const totalExp = base + bonus7 + bonus30;

    const levelResult = await this.userLevelService.addExp(userId, 'user_signed_in');

    try {
      await this.taskService.updateProgress(userId, 'checkin');
      await this.taskService.claimReward(userId, 'checkin');
    } catch {
      // task auto-completion is best-effort
    }

    return {
      checkedIn: true,
      streak,
      expAwarded: totalExp,
      bonusDetails: { base, streak7: bonus7, streak30: bonus30 },
      leveledUp: levelResult.leveledUp,
    };
  }

  async getStatus(userId: string) {
    const today = this.getTodayDate();
    const todayCheckin = await this.prisma.dailyCheckIn.findUnique({
      where: { userId_date: { userId, date: today } },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { dailyQuota: true },
    });

    const tasks = await this.prisma.dailyTask.findMany({
      where: { userId, date: today, completed: true, rewardClaimed: false },
    });
    const unclaimedTaskCount = tasks.length;

    return {
      checkedInToday: !!todayCheckin,
      streak: todayCheckin?.streak || 0,
      dailyQuota: user?.dailyQuota || 20,
      maxQuota: 20,
      unclaimedTaskCount,
    };
  }
}
