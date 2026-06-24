import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api-client';
import { FileTree } from '@/components/plugin/FileTree';
import { EditorPanel } from '@/components/plugin/EditorPanel';
import { VersionHistory } from '@/components/plugin/VersionHistory';
import { DiffViewer } from '@/components/plugin/DiffViewer';
import { CompileOverlay } from '@/components/plugin/CompileOverlay';
import type { ApiResponse } from '@/types/api';
import type { PluginProject, PluginVersion, CompileStatus as CompileStatusType } from '@/types/plugin';

interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
}

interface DiffData {
  files: Array<{ path: string; oldContent: string; newContent: string }>;
  oldVersion: number;
  newVersion: number;
}

export default function PluginEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedFilePath, setSelectedFilePath] = useState<string>('');
  const [showDiff, setShowDiff] = useState<DiffData | null>(null);
  const [modifyDescription, setModifyDescription] = useState('');
  const [compileOverlayOpen, setCompileOverlayOpen] = useState(false);
  const [explainPanel, setExplainPanel] = useState<{
    filePath: string;
    explanation: string;
    loading: boolean;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['plugin', id],
    queryFn: async () => {
      const res = await apiClient.get<
        ApiResponse<{
          plugin: PluginProject;
          fileTree: FileTreeNode[];
          versions: (PluginVersion & {
            version: number;
            compileStatus: CompileStatusType;
            createdAt: string;
          })[];
        }>
      >(`/plugins/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });

  const { data: fileContent } = useQuery({
    queryKey: ['plugin-file', id, selectedFilePath],
    queryFn: async () => {
      const res = await apiClient.get<
        ApiResponse<{ path: string; content: string }>
      >(`/plugins/${id}/files`, {
        params: { path: selectedFilePath },
      });
      return res.data.data;
    },
    enabled: !!id && !!selectedFilePath,
  });

  const snapshotMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<ApiResponse<PluginVersion>>(
        `/plugins/${id}/versions`,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plugin', id] });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (version: number) => {
      const res = await apiClient.post(`/plugins/${id}/versions/${version}/restore`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plugin', id] });
      setSelectedFilePath('');
      toast.success('版本已切换');
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast.error(axiosErr?.response?.data?.message || '切换失败');
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      const currentPlugin = data?.plugin;
      const res = await apiClient.post(`/plugins/${id}/publish`, {
        description: currentPlugin?.description || '一个 Minecraft 插件',
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plugin', id] });
      toast.success('发布成功！');
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast.error(axiosErr?.response?.data?.message || '发布失败');
    },
  });

  const modifyMutation = useMutation({
    mutationFn: async (description: string) => {
      const apiKey = (() => { try { return localStorage.getItem('plugingen_deepseek_api_key') || ''; } catch { return ''; } })();
      const res = await apiClient.post<
        ApiResponse<{ pluginId: string; newVersion: number; changes: string[] }>
      >(`/ai/modify/${id}`, { description }, { headers: apiKey ? { 'x-api-key': apiKey } : undefined });
      return res.data.data;
    },
    onSuccess: () => {
      setModifyDescription('');
      queryClient.invalidateQueries({ queryKey: ['plugin', id] });
      setSelectedFilePath('');
      toast.success('修改成功！');
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { message?: string; details?: string[] } } };
      const details = axiosErr?.response?.data?.details;
      toast.error(details?.join('; ') || axiosErr?.response?.data?.message || '修改失败');
    },
  });

  const explainMutation = useMutation({
    mutationFn: async (data: { filePath: string; code: string }) => {
      const res = await apiClient.post<
        ApiResponse<{ filePath: string; explanation: string }>
      >(`/ai/explain/${id}`, data);
      return res.data.data;
    },
    onSuccess: (data) => {
      setExplainPanel((prev) =>
        prev ? { ...prev, explanation: data.explanation, loading: false } : null,
      );
    },
    onError: () => {
      setExplainPanel((prev) =>
        prev
          ? { ...prev, explanation: '解释失败，请重试', loading: false }
          : null,
      );
    },
  });

  const handleExplain = useCallback(() => {
    const code = fileContent?.content;
    if (!selectedFilePath || !code) return;

    setExplainPanel({
      filePath: selectedFilePath,
      explanation: '',
      loading: true,
    });

    explainMutation.mutate({ filePath: selectedFilePath, code });
  }, [selectedFilePath, fileContent, explainMutation]);

  const handleDownloadZip = async () => {
    const link = document.createElement('a');
    link.href = `/api/file/download/${id}/zip`;
    link.download = `${data?.plugin.name || 'plugin'}-source.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileSelect = (filePath: string) => {
    setSelectedFilePath(filePath);
  };

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <p className="font-sans text-body-md text-muted">加载中...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center">
        <p className="font-sans text-body-md text-muted">插件项目不存在</p>
        <button
          onClick={() => navigate('/dashboard/plugins')}
          className="mt-md rounded-md bg-primary px-5 py-3 font-sans text-button text-on-primary"
        >
          返回列表
        </button>
      </div>
    );
  }

  const plugin = data.plugin;
  const fileTree = data.fileTree;
  const versions = data.versions;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Top toolbar */}
      <div className="flex items-center justify-between border-b border-hairline bg-canvas px-lg py-sm">
        <div className="flex items-center gap-md">
          <button
            onClick={() => navigate('/dashboard/plugins')}
            className="font-sans text-body-sm text-muted hover:text-ink"
          >
            ← 返回
          </button>
          <h2 className="font-display text-title-md text-ink">{plugin.name}</h2>
          <span className="rounded-pill bg-surface-cream-strong px-sm py-xxs font-sans text-caption text-muted">
            {plugin.coreType}
          </span>
          <span className="font-sans text-caption text-muted-soft">
            v{plugin.currentVersion}
          </span>
        </div>
        <div className="flex items-center gap-sm">
          <button
            onClick={() => snapshotMutation.mutate()}
            disabled={snapshotMutation.isPending}
            className="rounded-md border border-hairline bg-canvas px-md py-sm font-sans text-button text-ink transition-colors hover:bg-surface-soft disabled:opacity-50"
          >
            创建快照
          </button>
          <button
            onClick={handleDownloadZip}
            className="rounded-md border border-hairline bg-canvas px-md py-sm font-sans text-button text-ink transition-colors hover:bg-surface-soft"
          >
            下载 ZIP
          </button>
          {!plugin.isPublished && (
            <button
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
              className="rounded-md bg-primary px-md py-sm font-sans text-button text-on-primary transition-colors hover:bg-primary-active disabled:opacity-50"
            >
              {publishMutation.isPending ? '发布中…' : '发布到广场'}
            </button>
          )}
          {plugin.isPublished && (
            <span className="rounded-pill bg-success/10 px-sm py-xxs font-sans text-caption text-success">
              已发布
            </span>
          )}
        </div>
      </div>

      {/* Three-column layout */}
      {showDiff ? (
        <DiffViewer
          files={showDiff.files}
          oldVersion={showDiff.oldVersion}
          newVersion={showDiff.newVersion}
          onClose={() => setShowDiff(null)}
        />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Left: File tree */}
          <aside className="w-60 overflow-y-auto border-r border-hairline bg-canvas p-sm">
            <FileTree
              files={fileTree}
              selectedPath={selectedFilePath}
              onSelect={handleFileSelect}
            />
          </aside>

          {/* Center: Editor + AI Explain */}
          <main className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-hidden">
              {selectedFilePath ? (
                <EditorPanel
                  value={fileContent?.content || ''}
                  path={selectedFilePath}
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <p className="font-sans text-body-md text-muted">
                    从左侧文件树选择一个文件
                  </p>
                </div>
              )}
            </div>

            {/* AI Explain Panel */}
            {explainPanel && (
              <div className="max-h-64 overflow-y-auto border-t border-hairline bg-surface-soft p-md">
                <div className="flex items-center justify-between">
                  <span className="font-sans text-title-sm text-ink">
                    AI 解释: {explainPanel.filePath}
                  </span>
                  <button
                    onClick={() => setExplainPanel(null)}
                    className="font-sans text-body-sm text-muted hover:text-ink"
                  >
                    关闭
                  </button>
                </div>
                <div className="mt-sm font-sans text-body-sm text-body prose prose-sm max-w-none">
                  {explainPanel.loading ? (
                    <p className="text-muted">正在解释代码…</p>
                  ) : (
                    <ReactMarkdown>{explainPanel.explanation}</ReactMarkdown>
                  )}
                </div>
              </div>
            )}
          </main>

          {/* Right: Version history + compile + modify */}
          <aside className="flex w-64 flex-col border-l border-hairline bg-canvas">
            {/* Compile section */}
            <div className="border-b border-hairline p-sm">
              <button
                onClick={() => setCompileOverlayOpen(true)}
                className="w-full rounded-md bg-primary px-5 py-3 font-sans text-button text-on-primary transition-colors hover:bg-primary-active"
              >
                编译
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-sm">
              <VersionHistory
                versions={versions}
                currentVersion={plugin.currentVersion}
                onDiff={(_v1, v2) => {
                  setSelectedFilePath('');
                  apiClient
                    .get<ApiResponse<DiffData>>(
                      `/plugins/${id}/versions/${v2}/diff`,
                    )
                    .then((res) => {
                      setShowDiff(res.data.data);
                    });
                }}
                onRestore={(version) => {
                  if (
                    window.confirm(
                      `确定要回退到 v${version} 吗？`,
                    )
                  ) {
                    restoreMutation.mutate(version);
                  }
                }}
              />
            </div>

            {/* AI Explain button */}
            {selectedFilePath && (
              <div className="border-t border-hairline p-sm">
                <button
                  onClick={handleExplain}
                  disabled={explainMutation.isPending}
                  className="w-full rounded-md bg-primary/10 px-md py-sm font-sans text-button text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
                >
                  {explainMutation.isPending ? '解释中…' : 'AI 解释'}
                </button>
              </div>
            )}

            {/* Modify input */}
            <div className="border-t border-hairline p-sm">
              <textarea
                value={modifyDescription}
                onChange={(e) => setModifyDescription(e.target.value)}
                placeholder="输入修改描述，如：添加 /reload 命令"
                rows={3}
                disabled={modifyMutation.isPending}
                className="w-full rounded-md border border-hairline bg-canvas px-3 py-2 font-sans text-body-sm text-ink outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15 disabled:opacity-50"
              />
              <button
                onClick={() => modifyMutation.mutate(modifyDescription)}
                disabled={modifyMutation.isPending || !modifyDescription.trim()}
                className="mt-xs w-full rounded-md bg-primary px-md py-sm font-sans text-button text-on-primary transition-colors hover:bg-primary-active disabled:cursor-not-allowed disabled:bg-primary-disabled"
              >
                {modifyMutation.isPending ? '修改中…' : '应用修改'}
              </button>
            </div>
          </aside>
        </div>
      )}

      <CompileOverlay
        pluginId={id || ''}
        pluginName={plugin?.name || ''}
        open={compileOverlayOpen}
        onClose={() => setCompileOverlayOpen(false)}
      />
    </div>
  );
}
