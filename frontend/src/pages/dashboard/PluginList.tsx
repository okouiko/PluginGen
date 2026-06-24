import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';
import type { PluginProject } from '@/types/plugin';

export default function PluginListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['plugins'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<{ items: PluginProject[]; total: number }>>(
        '/plugins',
      );
      return res.data.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/plugins/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plugins'] });
      setConfirmDelete(null);
    },
  });

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1200px] px-lg py-section">
        <p className="text-muted font-sans text-body-md">加载中...</p>
      </div>
    );
  }

  const plugins = data?.items || [];

  return (
    <div className="mx-auto max-w-[1200px] px-lg py-section">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-display-sm text-ink">我的插件</h1>
        <Link
          to="/dashboard/create"
          className="rounded-md bg-primary px-5 py-3 font-sans text-button text-on-primary transition-colors hover:bg-primary-active"
        >
          创建新插件
        </Link>
      </div>

      {plugins.length === 0 ? (
        <div className="mt-xl rounded-lg border border-hairline bg-surface-card p-xl text-center">
          <p className="font-sans text-body-md text-muted">
            还没有插件，去创建一个吧
          </p>
          <Link
            to="/dashboard/create"
            className="mt-md inline-block rounded-md bg-primary px-5 py-3 font-sans text-button text-on-primary transition-colors hover:bg-primary-active"
          >
            创建第一个插件
          </Link>
        </div>
      ) : (
        <div className="mt-xl grid grid-cols-1 gap-md md:grid-cols-2 lg:grid-cols-3">
          {plugins.map((plugin) => (
            <div
              key={plugin.id}
              className="rounded-lg border border-hairline bg-surface-card p-xl transition-shadow hover:shadow-sm"
            >
              <div
                className="cursor-pointer"
                onClick={() => navigate(`/dashboard/plugins/${plugin.id}/edit`)}
              >
                <h3 className="font-display text-title-md text-ink">{plugin.name}</h3>
                <div className="mt-sm flex gap-sm">
                  <span className="rounded-pill bg-surface-cream-strong px-sm py-xxs font-sans text-caption text-muted">
                    {plugin.coreType}
                  </span>
                  <span className="rounded-pill bg-surface-cream-strong px-sm py-xxs font-sans text-caption text-muted">
                    MC {plugin.mcVersion}
                  </span>
                </div>
                <p className="mt-sm font-sans text-body-sm text-muted">
                  状态: {plugin.status}
                </p>
                <p className="font-sans text-caption text-muted-soft">
                  v{plugin.currentVersion} ·{' '}
                  {new Date(plugin.createdAt).toLocaleDateString('zh-CN')}
                </p>
              </div>

              <div className="mt-md flex gap-sm border-t border-hairline pt-md">
                <button
                  onClick={() => navigate(`/dashboard/plugins/${plugin.id}/edit`)}
                  className="flex-1 rounded-md border border-hairline bg-canvas px-md py-sm font-sans text-button text-ink transition-colors hover:bg-surface-soft"
                >
                  编辑
                </button>
                {confirmDelete === plugin.id ? (
                  <div className="flex gap-sm">
                    <button
                      onClick={() => handleDelete(plugin.id)}
                      className="rounded-md bg-error px-md py-sm font-sans text-button text-on-primary transition-colors hover:bg-error/80"
                    >
                      确认删除
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="rounded-md border border-hairline bg-canvas px-md py-sm font-sans text-button text-ink transition-colors hover:bg-surface-soft"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(plugin.id)}
                    className="rounded-md px-md py-sm font-sans text-button text-error transition-colors hover:bg-error/10"
                  >
                    删除
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="mx-lg w-full max-w-md rounded-lg bg-canvas p-xl">
            <h3 className="font-display text-title-md text-ink">确认删除</h3>
            <p className="mt-sm font-sans text-body-md text-muted">
              确定要删除此插件吗？此操作不可撤销。
            </p>
            <div className="mt-lg flex justify-end gap-sm">
              <button
                onClick={() => {
                  setConfirmDelete(null);
                }}
                className="rounded-md border border-hairline bg-canvas px-md py-sm font-sans text-button text-ink transition-colors hover:bg-surface-soft"
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="rounded-md bg-error px-md py-sm font-sans text-button text-on-primary transition-colors hover:bg-error/80"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
