import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UserLevelService } from '../user/user-level.service';

const TASK_DEFINITIONS = [
  {
    taskType: 'generate_plugin',
    name: '生成 1 个插件',
    description: '使用 AI 生成一个 Minecraft 插件',
    target: 1,
    reward: 5,
  },
  {
    taskType: 'publish_plugin',
    name: '发布 1 个作品',
    description: '将你的插件发布到作品广场',
    target: 1,
    reward: 5,
  },
  {
    taskType: 'comment',
    name: '评论 1 次',
    description: '在作品广场发表一个评论',
    target: 1,
    reward: 5,
  },
  {
    taskType: 'checkin',
    name: '签到 1 次',
    description: '完成今日签到',
    target: 1,
    reward: 5,
  },
];

@Injectable()
export class DailyTaskService {
  constructor(
    private prisma: PrismaService,
    private userLevelService: UserLevelService,
  ) {}

  private getTodayDate(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }

  async getTodayTasks(userId: string) {
    const today = this.getTodayDate();
    const existingTasks = await this.prisma.dailyTask.findMany({
      where: { userId, date: today },
    });

    if (existingTasks.length > 0) {
      return { date: today.toISOString().split('T')[0], tasks: this.enrichTasks(existingTasks) };
    }

    const created = await Promise.all(
      TASK_DEFINITIONS.map((def) =>
        this.prisma.dailyTask.create({
          data: { userId, date: today, taskType: def.taskType },
        }),
      ),
    );

    return { date: today.toISOString().split('T')[0], tasks: this.enrichTasks(created) };
  }

  async updateProgress(userId: string, taskType: string) {
    const today = this.getTodayDate();

    let task = await this.prisma.dailyTask.findUnique({
      where: { userId_date_taskType: { userId, date: today, taskType } },
    });

    if (!task) {
      task = await this.prisma.dailyTask.create({
        data: { userId, date: today, taskType },
      });
    }

    if (task.completed) return;

    const definition = TASK_DEFINITIONS.find((d) => d.taskType === taskType);
    if (!definition) return;

    const newProgress = task.progress + 1;
    const completed = newProgress >= definition.target;

    await this.prisma.dailyTask.update({
      where: { id: task.id },
      data: { progress: newProgress, completed },
    });
  }

  async claimReward(userId: string, taskType: string) {
    const today = this.getTodayDate();
    const task = await this.prisma.dailyTask.findUnique({
      where: { userId_date_taskType: { userId, date: today, taskType } },
    });

    if (!task || !task.completed) throw new BadRequestException('Task not completed yet');
    if (task.rewardClaimed) throw new ConflictException('Reward already claimed');

    const definition = TASK_DEFINITIONS.find((d) => d.taskType === taskType);
    if (!definition) throw new BadRequestException('Unknown task type');

    await this.prisma.dailyTask.update({
      where: { id: task.id },
      data: { rewardClaimed: true },
    });

    await this.userLevelService.addExp(userId, 'user_signed_in');

    return { taskType, reward: definition.reward, claimed: true };
  }

  private enrichTasks(tasks: any[]) {
    return tasks.map((task) => {
      const def = TASK_DEFINITIONS.find((d) => d.taskType === task.taskType);
      let status: 'in_progress' | 'ready' | 'done' = 'in_progress';
      if (task.completed && task.rewardClaimed) status = 'done';
      else if (task.completed) status = 'ready';

      return {
        ...task,
        name: def?.name || '',
        description: def?.description || '',
        target: def?.target || 1,
        reward: def?.reward || 0,
        status,
      };
    });
  }
}
