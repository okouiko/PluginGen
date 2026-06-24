import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { useAuthStore } from '@/stores/auth-store';
import type { ApiResponse } from '@/types/api';

interface DailyTask {
  id: string;
  taskType: string;
  name: string;
  description: string;
  progress: number;
  target: number;
  reward: number;
  completed: boolean;
  rewardClaimed: boolean;
  status: 'in_progress' | 'ready' | 'done';
}

export default function DailyPage() {
  const queryClient = useQueryClient();
  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['daily-tasks'],
    queryFn: async () => {
      const res = await apiClient.get<
        ApiResponse<{ date: string; tasks: DailyTask[] }>
      >('/daily/tasks');
      return res.data.data;
    },
  });

  const checkinMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<
        ApiResponse<{
          checkedIn: boolean;
          streak: number;
          expAwarded: number;
          bonusDetails: { base: number; streak7: number; streak30: number };
          leveledUp: boolean;
        }>
      >('/daily/checkin');
      return res.data.data;
    },
    onSuccess: async (data) => {
      toast.success(`签到成功！连续 ${data.streak} 天，获得 ${data.expAwarded} 经验`);
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['daily-status'] });
      // Refresh user profile to update exp/level in authStore
      try {
        const profileRes = await apiClient.get<ApiResponse<any>>('/user/profile');
        const profile = profileRes.data.data;
        useAuthStore.getState().setUser({
          id: profile.id,
          email: profile.email,
          nickname: profile.nickname,
          avatar: profile.avatar,
          level: profile.level,
          exp: profile.exp,
          dailyQuota: profile.dailyQuota,
        });
      } catch {}
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast.error(axiosErr?.response?.data?.message || '签到失败');
    },
  });

  const claimMutation = useMutation({
    mutationFn: async (taskType: string) => {
      const res = await apiClient.post<
        ApiResponse<{ taskType: string; reward: number; claimed: boolean }>
      >(`/daily/tasks/${taskType}/claim`);
      return res.data.data;
    },
    onSuccess: (data) => {
      toast.success(`领取 ${data.reward} 经验奖励`);
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['daily-status'] });
    },
  });

  const { data: statusData } = useQuery({
    queryKey: ['daily-status'],
    queryFn: async () => {
      const res = await apiClient.get<
        ApiResponse<{
          checkedInToday: boolean;
          streak: number;
          dailyQuota: number;
        }>
      >('/daily/status');
      return res.data.data;
    },
  });

  if (tasksLoading) return <LoadingSpinner />;

  const tasks = tasksData?.tasks || [];
  const allCompleted = tasks.every((t) => t.status === 'done');

  return (
    <div className="mx-auto max-w-[600px] px-lg py-section">
      <h1 className="font-display text-display-sm text-ink">每日签到</h1>
      <p className="mt-sm font-sans text-body-md text-muted">
        坚持签到，获取经验奖励
      </p>

      {/* Check-in card */}
      <div className="mt-xl rounded-lg bg-surface-card p-xl text-center">
        {statusData?.checkedInToday ? (
          <div>
            <div className="text-4xl">✅</div>
            <h2 className="mt-md font-display text-title-md text-ink">
              今日已签到
            </h2>
            <p className="mt-sm font-sans text-body-md text-primary">
              连续 {statusData.streak} 天
            </p>
          </div>
        ) : (
          <div>
            <div className="text-4xl">📅</div>
            <h2 className="mt-md font-display text-title-md text-ink">
              今日未签到
            </h2>
            <p className="mt-sm font-sans text-body-sm text-muted">
              {statusData?.streak
                ? `连续 ${statusData.streak} 天`
                : '开始你的签到之旅'}
            </p>
            <button
              onClick={() => checkinMutation.mutate()}
              disabled={checkinMutation.isPending}
              className="mt-md rounded-md bg-primary px-5 py-3 font-sans text-button text-on-primary transition-colors hover:bg-primary-active disabled:bg-primary-disabled"
            >
              {checkinMutation.isPending ? '签到中…' : '签到'}
            </button>
          </div>
        )}
      </div>

      {/* Streak bonus info */}
      <div className="mt-md grid grid-cols-3 gap-sm">
        <div className="rounded-lg bg-surface-soft p-md text-center">
          <div className="font-sans text-caption text-muted">每日签到</div>
          <div className="font-sans text-title-md text-ink">+5</div>
        </div>
        <div className="rounded-lg bg-surface-soft p-md text-center">
          <div className="font-sans text-caption text-muted">连续 7 天</div>
          <div className="font-sans text-title-md text-accent-amber">+10</div>
        </div>
        <div className="rounded-lg bg-surface-soft p-md text-center">
          <div className="font-sans text-caption text-muted">连续 30 天</div>
          <div className="font-sans text-title-md text-accent-teal">+30</div>
        </div>
      </div>

      {/* Tasks */}
      <h2 className="mt-xl font-display text-display-sm text-ink">今日任务</h2>

      {allCompleted && (
        <div className="mt-md rounded-lg bg-success/10 px-md py-sm font-sans text-body-sm text-success">
          今日任务全部完成！
        </div>
      )}

      <div className="mt-md space-y-sm">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center justify-between rounded-lg bg-surface-card p-md"
          >
            <div className="flex-1">
              <div className="flex items-center gap-sm">
                <span className="font-sans text-title-sm text-ink">
                  {task.name}
                </span>
                {task.status === 'done' && (
                  <span className="font-sans text-caption text-success">✓</span>
                )}
                {task.status === 'ready' && (
                  <span className="rounded-pill bg-accent-amber/10 px-sm py-xxs font-sans text-caption text-accent-amber">
                    可领取
                  </span>
                )}
              </div>
              <p className="font-sans text-body-sm text-muted">
                {task.description}
              </p>
              <div className="mt-xs flex items-center gap-sm">
                <div className="h-1.5 w-32 overflow-hidden rounded-full bg-hairline">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${(task.progress / task.target) * 100}%`,
                    }}
                  />
                </div>
                <span className="font-sans text-caption text-muted-soft">
                  {task.progress}/{task.target}
                </span>
                <span className="font-sans text-caption text-accent-amber">
                  +{task.reward} exp
                </span>
              </div>
            </div>
            {task.status === 'ready' && (
              <button
                onClick={() => claimMutation.mutate(task.taskType)}
                disabled={claimMutation.isPending}
                className="ml-sm rounded-md bg-primary px-4 py-2 font-sans text-button text-on-primary transition-colors hover:bg-primary-active disabled:bg-primary-disabled"
              >
                领取
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
