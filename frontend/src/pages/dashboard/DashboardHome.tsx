import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { PluginListSkeleton } from '@/components/shared/Skeleton';
import type { ApiResponse } from '@/types/api';
import type { PluginProject } from '@/types/plugin';

export default function DashboardHomePage() {
  const authUser = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const { data: profile } = useQuery({
    queryKey: ['my-profile'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>('/user/profile');
      if (res.data.data && authUser) {
        setUser({ ...authUser, ...res.data.data });
      }
      return res.data.data;
    },
    staleTime: 10 * 1000,
    refetchInterval: 30 * 1000,
  });

  const user = profile || authUser;

  const { data: pluginsData, isLoading } = useQuery({
    queryKey: ['my-plugins', { limit: 5 }],
    queryFn: async () => {
      const res = await apiClient.get<
        ApiResponse<{ items: PluginProject[]; total: number }>
      >('/plugins', { params: { limit: 5 } });
      return res.data.data;
    },
  });

  const plugins = pluginsData?.items || [];

  return (
    <div className="mx-auto max-w-[1200px] px-lg py-xl">
      {/* User overview card */}
      <div className="mb-xl rounded-lg bg-surface-card p-xl">
        <div className="flex items-center gap-md">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary font-sans text-title-md text-on-primary">
            {user?.nickname?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div>
            <h2 className="font-sans text-title-md text-ink">
              欢迎回来，{user?.nickname || '用户'}
            </h2>
            <p className="font-sans text-body-sm text-muted">
              Lv.{user?.level || 1} · 经验 {user?.exp || 0} · 今日剩余{' '}
              <strong>{user?.dailyQuota || 20}</strong>/20 次
            </p>
          </div>
        </div>
      </div>

      {/* Create button */}
      <Link to="/dashboard/create">
        <div className="mb-xl cursor-pointer rounded-lg bg-primary p-xl text-center text-on-primary transition-colors hover:bg-primary-active">
          <div className="mb-sm text-3xl">+</div>
          <span className="font-sans text-title-md">创建新插件</span>
        </div>
      </Link>

      {/* Recent projects */}
      <h3 className="font-sans text-title-md text-ink mb-md">最近项目</h3>

      {isLoading ? (
        <PluginListSkeleton />
      ) : plugins.length > 0 ? (
        <div className="space-y-sm">
          {plugins.map((plugin) => (
            <Link
              key={plugin.id}
              to={`/dashboard/plugins/${plugin.id}/edit`}
              className="block rounded-lg bg-surface-card p-xl transition-shadow hover:shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-sans text-title-sm text-ink">
                    {plugin.name}
                  </h4>
                  <p className="font-sans text-body-sm text-muted">
                    {plugin.coreType} · MC {plugin.mcVersion} · v
                    {plugin.currentVersion}
                  </p>
                </div>
                <span className="font-sans text-caption text-muted-soft">
                  {plugin.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-lg bg-surface-card p-xl text-center">
          <p className="mb-md font-sans text-body-md text-muted">还没有插件</p>
          <Link
            to="/dashboard/create"
            className="inline-block rounded-md border border-hairline bg-canvas px-5 py-3 font-sans text-button text-ink transition-colors hover:bg-surface-soft"
          >
            创建第一个插件
          </Link>
        </div>
      )}
    </div>
  );
}
