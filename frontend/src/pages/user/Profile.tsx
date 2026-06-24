import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { LevelBadge } from '@/components/user/LevelBadge';
import { UserStats } from '@/components/user/UserStats';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import type { ApiResponse } from '@/types/api';

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const isAuthenticated = !!useAuthStore((s) => s.token);

  // If the URL id is "undefined"/"null"/invalid, redirect to own profile
  const effectiveId = (id === 'undefined' || id === 'null' || !id) && currentUser?.id
    ? currentUser.id
    : id;

  const { data, isLoading } = useQuery({
    queryKey: ['user-profile', effectiveId],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>(`/user/profile/${effectiveId}`);
      return res.data.data;
    },
    enabled: !!effectiveId,
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/community/follow', { followingId: effectiveId });
      return res.data.data;
    },
  });

  if (isLoading) return <LoadingSpinner />;
  if (!data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="font-sans text-body-md text-muted">用户不存在</p>
      </div>
    );
  }

  const { user, stats, plugins, isFollowing, isOwner } = data;

  return (
    <div className="mx-auto max-w-[800px] px-lg py-section">
      {/* Profile header */}
      <div className="rounded-lg bg-surface-card p-xl">
        <div className="flex items-start gap-lg">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary font-sans text-title-lg text-on-primary">
            {user.nickname.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-sm">
              <h1 className="font-display text-display-sm text-ink">
                {user.nickname}
              </h1>
              <LevelBadge level={user.level} title={user.title} />
            </div>
            <p className="mt-sm font-sans text-body-md text-body">
              {user.bio}
            </p>
            <p className="mt-xs font-sans text-caption text-muted-soft">
              加入于 {new Date(user.createdAt).toLocaleDateString('zh-CN')}
            </p>
          </div>
          {!isOwner && isAuthenticated && (
            <button
              onClick={() => followMutation.mutate()}
              className={`rounded-md px-4 py-2 font-sans text-button transition-colors ${
                isFollowing
                  ? 'border border-hairline bg-canvas text-ink hover:bg-surface-soft'
                  : 'bg-primary text-on-primary hover:bg-primary-active'
              }`}
            >
              {isFollowing ? '已关注' : '+ 关注'}
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mt-md">
        <UserStats
          pluginCount={stats.pluginCount}
          totalDownloads={stats.totalDownloads}
          totalStars={stats.totalStars}
          followerCount={stats.followerCount}
        />
      </div>

      {/* Level progress */}
      <div className="mt-md rounded-lg bg-surface-card p-md">
        <div className="flex items-center justify-between">
          <span className="font-sans text-body-sm text-ink">等级进度</span>
          <span className="font-sans text-caption text-muted">
            {user.exp} / {user.expToNextLevel} exp
          </span>
        </div>
        <div className="mt-sm h-2 overflow-hidden rounded-full bg-hairline">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{
              width: `${Math.min(100, (user.exp / user.expToNextLevel) * 100)}%`,
            }}
          />
        </div>
        <p className="mt-xs font-sans text-caption text-muted-soft">
          下一级: {user.title} → {getNextTitle(user.level)}
        </p>
      </div>

      {/* Plugins list */}
      <h2 className="mt-xl font-display text-display-sm text-ink">作品</h2>
      {plugins.length === 0 ? (
        <div className="mt-md rounded-lg bg-surface-card p-xl text-center">
          <p className="font-sans text-body-md text-muted">暂无发布作品</p>
        </div>
      ) : (
        <div className="mt-md space-y-sm">
          {plugins.map((plugin: any) => (
            <div
              key={plugin.id}
              className="flex items-center justify-between rounded-lg bg-surface-card p-md"
            >
              <div
                className="flex-1 cursor-pointer"
                onClick={() => navigate(`/workspace/${plugin.id}`)}
              >
                <div className="flex items-center gap-sm">
                  <h3 className="font-sans text-title-sm text-ink">
                    {plugin.name}
                  </h3>
                  {plugin.isPinned && (
                    <span className="rounded-pill bg-primary/10 px-sm py-xxs font-sans text-caption text-primary">
                      置顶
                    </span>
                  )}
                </div>
                <div className="mt-xs flex gap-sm font-sans text-caption text-muted">
                  <span>{plugin.coreType}</span>
                  <span>MC {plugin.mcVersion}</span>
                  <span>⭐ {plugin.avgRating?.toFixed(1) || '0.0'}</span>
                  <span>⬇ {plugin.downloadCount}</span>
                  <span>👍 {plugin.starCount}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getNextTitle(level: number): string {
  if (level <= 5) return '进阶工匠';
  if (level <= 15) return '资深开发者';
  return '大师';
}
