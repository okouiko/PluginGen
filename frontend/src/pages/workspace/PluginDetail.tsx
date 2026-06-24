import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { RatingStars } from '@/components/community/RatingStars';
import { CommentList } from '@/components/community/CommentList';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { useAuthStore } from '@/stores/auth-store';
import type { ApiResponse } from '@/types/api';

export default function PluginDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAuthenticated = !!useAuthStore((state) => state.token);

  const { data, isLoading } = useQuery({
    queryKey: ['community-plugin', id],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>(`/community/plugins/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });

  const { data: comments } = useQuery({
    queryKey: ['plugin-comments', id],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any[]>>(
        `/community/plugins/${id}/comments`,
      );
      return res.data.data;
    },
    enabled: !!id,
  });

  const favoriteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/community/favorite', { pluginId: id });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-plugin', id] });
    },
  });

  const likeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/community/like', {
        targetId: id,
        targetType: 'PLUGIN',
      });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-plugin', id] });
    },
  });

  const ratingMutation = useMutation({
    mutationFn: async (score: number) => {
      const res = await apiClient.post('/community/rating', {
        pluginId: id,
        score,
      });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-plugin', id] });
    },
  });

  const followMutation = useMutation({
    mutationFn: async (followingId: string) => {
      const res = await apiClient.post('/community/follow', { followingId });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-plugin', id] });
    },
  });

  const handleAddComment = async (content: string) => {
    await apiClient.post('/community/comment', { pluginId: id, content });
    queryClient.invalidateQueries({ queryKey: ['plugin-comments', id] });
  };

  const handleAction = (action: () => void) => {
    if (!isAuthenticated) {
      navigate('/login?redirect=' + encodeURIComponent(`/workspace/${id}`));
      return;
    }
    action();
  };

  if (isLoading) return <LoadingSpinner />;
  if (!data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="font-sans text-body-md text-muted">插件不存在</p>
      </div>
    );
  }

  const { plugin, isFavorited, isLiked, userRating, isFollowing, isOwner } =
    data;
  const commentList = comments || [];

  return (
    <div className="mx-auto max-w-[1000px] px-lg py-section">
      {/* Header */}
      <div className="rounded-lg bg-surface-card p-xl">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-display-sm text-ink">
              {plugin.name}
            </h1>
            <div className="mt-sm flex flex-wrap gap-xs">
              <span className="rounded-pill bg-surface-cream-strong px-sm py-xxs font-sans text-caption text-muted">
                {plugin.coreType}
              </span>
              <span className="rounded-pill bg-surface-cream-strong px-sm py-xxs font-sans text-caption text-muted">
                MC {plugin.mcVersion}
              </span>
            </div>
            <p className="mt-md font-sans text-body-md text-body">
              {plugin.description || '暂无描述'}
            </p>
          </div>

          {/* Author info */}
          <div className="text-right">
            <div className="flex items-center gap-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-caption text-on-primary">
                {plugin.user.nickname.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-sans text-body-sm text-ink">
                  {plugin.user.nickname}
                </p>
                {!isOwner && (
                  <button
                    onClick={() =>
                      handleAction(() => followMutation.mutate(plugin.user.id))
                    }
                    className="font-sans text-caption text-primary hover:text-primary-active"
                  >
                    {isFollowing ? '已关注' : '+ 关注'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-lg flex flex-wrap gap-lg border-t border-hairline pt-md">
          <div>
            <RatingStars value={plugin.avgRating || 0} readonly size="sm" />
            <span className="ml-sm font-sans text-caption text-muted">
              {plugin.avgRating?.toFixed(1)} ({plugin.ratingCount || 0})
            </span>
          </div>
          <span className="font-sans text-caption text-muted">
            ⬇ {plugin.downloadCount} 下载
          </span>
          <span className="font-sans text-caption text-muted">
            ★ {plugin.favoriteCount} 收藏
          </span>
          <span className="font-sans text-caption text-muted">
            👍 {plugin.starCount} 点赞
          </span>
        </div>

        {/* Actions */}
        {!isOwner && (
          <div className="mt-md flex flex-wrap gap-sm">
            <button
              onClick={() => handleAction(() => favoriteMutation.mutate())}
              className={`rounded-md px-4 py-2 font-sans text-button transition-colors ${
                isFavorited
                  ? 'bg-primary/10 text-primary'
                  : 'border border-hairline bg-canvas text-ink hover:bg-surface-soft'
              }`}
            >
              {isFavorited ? '★ 已收藏' : '☆ 收藏'}
            </button>
            <button
              onClick={() => handleAction(() => likeMutation.mutate())}
              className={`rounded-md px-4 py-2 font-sans text-button transition-colors ${
                isLiked
                  ? 'bg-primary/10 text-primary'
                  : 'border border-hairline bg-canvas text-ink hover:bg-surface-soft'
              }`}
            >
              {isLiked ? '👍 已赞' : '👍 点赞'}
            </button>
            <button
              onClick={() =>
                handleAction(() =>
                  window.open(`/api/file/download/${plugin.id}/zip`, '_blank'),
                )
              }
              className="rounded-md border border-hairline bg-canvas px-4 py-2 font-sans text-button text-ink transition-colors hover:bg-surface-soft"
            >
              ⬇ 下载源码
            </button>
          </div>
        )}

        {/* Rating */}
        {!isOwner && isAuthenticated && (
          <div className="mt-md flex items-center gap-sm rounded-md bg-surface-soft px-md py-sm">
            <span className="font-sans text-body-sm text-muted">你的评分:</span>
            <RatingStars
              value={userRating || 0}
              onChange={(score) => ratingMutation.mutate(score)}
            />
            {userRating && (
              <button
                onClick={() => navigate('/login')}
                className="font-sans text-caption text-primary"
              >
                {userRating > 0 ? ` (${userRating} 星)` : ''}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Comments */}
      <div className="mt-xl">
        <CommentList
          comments={commentList}
          onAddComment={async (content) => {
            if (!isAuthenticated) {
              navigate('/login?redirect=' + encodeURIComponent(`/workspace/${id}`));
              return;
            }
            await handleAddComment(content);
          }}
        />
      </div>
    </div>
  );
}
