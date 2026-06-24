import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useWebSocket } from '@/hooks/use-websocket';
import type { ApiResponse } from '@/types/api';
import type { CoreType } from '@/types/plugin';

const CORE_TYPES: { value: CoreType; label: string }[] = [
  { value: 'BUKKIT', label: 'Bukkit' },
  { value: 'SPIGOT', label: 'Spigot' },
  { value: 'PAPER', label: 'Paper' },
  { value: 'PURPUR', label: 'Purpur' },
  { value: 'BUNGEECORD', label: 'BungeeCord' },
  { value: 'VELOCITY', label: 'Velocity' },
];

const MC_VERSIONS = [
  '1.8', '1.9', '1.10', '1.11', '1.12',
  '1.13', '1.14', '1.15', '1.16',
  '1.17', '1.18', '1.19', '1.20', '1.20.1', '1.20.4', '1.20.6',
  '1.21', '1.21.1', '1.21.3', '1.21.4',
];

function autoSelectJava(mcVersion: string): string {
  if (!mcVersion) return '17';
  const parts = mcVersion.split('.');
  const major = parseInt(parts[1] || '0', 10);
  if (major <= 12) return '8';
  if (major <= 16) return '11';
  if (major <= 20) {
    const minor = parseInt(parts[2] || '0', 10);
    return minor >= 6 ? '21' : '17';
  }
  return '21';
}

export default function CreatePluginPage() {
  const navigate = useNavigate();
  const ws = useWebSocket();
  const [name, setName] = useState('');
  const [mcVersion, setMcVersion] = useState('');
  const [coreType, setCoreType] = useState<CoreType | ''>('');
  const [javaVersion, setJavaVersion] = useState('');
  const [packageName, setPackageName] = useState('');
  const [description, setDescription] = useState('');
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');
  const [streamContent, setStreamContent] = useState('');

  useEffect(() => {
    ws.on('ai.progress', (data: unknown) => {
      const d = data as { percent: number; stage: string };
      setProgress(d.percent);
      setStage(d.stage);
    });
    ws.on('ai.stream', (data: unknown) => {
      const d = data as { content: string };
      setStreamContent((prev) => prev + d.content);
    });
    return () => {
      setStreamContent('');
    };
  }, [ws]);

  const mutation = useMutation({
    mutationFn: async (data: {
      name: string;
      mcVersion: string;
      coreType: CoreType;
      javaVersion: string;
      packageName: string;
      description: string;
    }) => {
      const apiKey = (() => { try { return localStorage.getItem('plugingen_deepseek_api_key') || ''; } catch { return ''; } })();
      const res = await apiClient.post<ApiResponse<{ pluginId: string; version: number }>>(
        '/ai/generate',
        data,
        { headers: apiKey ? { 'x-api-key': apiKey } : undefined },
      );
      return res.data.data;
    },
    onSuccess: (data) => {
      navigate(`/dashboard/plugins/${data.pluginId}/edit`, { replace: true });
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { message?: string; details?: string[] } } };
      const details = axiosErr?.response?.data?.details;
      setError(
        details?.join('; ') ||
        axiosErr?.response?.data?.message ||
        '生成失败，请重试',
      );
      setProgress(0);
      setStage('');
    },
  });

  const handleMcVersionChange = (version: string) => {
    setMcVersion(version);
    if (version) {
      setJavaVersion(autoSelectJava(version));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!coreType) {
      setError('请选择服务端核心');
      return;
    }

    setProgress(5);
    setStage('正在准备生成…');

    mutation.mutate({
      name,
      mcVersion,
      coreType: coreType as CoreType,
      javaVersion,
      packageName,
      description,
    });
  };

  const isSubmitting = mutation.isPending;

  return (
    <div className="mx-auto max-w-[640px] px-lg py-section">
      <h1 className="font-display text-display-sm text-ink">创建新插件</h1>
      <p className="mt-sm font-sans text-body-md text-muted">
        描述你的插件功能，AI 将自动生成完整的 Maven 项目
      </p>

      <form onSubmit={handleSubmit} className="mt-xl space-y-md">
        {error && (
          <div className="rounded-md bg-error/10 px-md py-sm font-sans text-body-sm text-error">
            {error}
          </div>
        )}

        <div>
          <label className="mb-xs block font-sans text-body-sm text-ink">
            插件名称 <span className="text-error">*</span>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="DailyReward"
            required
            disabled={isSubmitting}
            className="w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 font-sans text-body-md text-ink outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15 disabled:opacity-50"
          />
        </div>

        <div className="grid grid-cols-2 gap-md">
          <div>
            <label className="mb-xs block font-sans text-body-sm text-ink">
              Minecraft 版本 <span className="text-error">*</span>
            </label>
            <select
              value={mcVersion}
              onChange={(e) => handleMcVersionChange(e.target.value)}
              required
              disabled={isSubmitting}
              className="w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 font-sans text-body-md text-ink outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15 disabled:opacity-50"
            >
              <option value="">请选择</option>
              {MC_VERSIONS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-xs block font-sans text-body-sm text-ink">
              服务端核心 <span className="text-error">*</span>
            </label>
            <select
              value={coreType}
              onChange={(e) => setCoreType(e.target.value as CoreType)}
              required
              disabled={isSubmitting}
              className="w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 font-sans text-body-md text-ink outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15 disabled:opacity-50"
            >
              <option value="">请选择</option>
              {CORE_TYPES.map((ct) => (
                <option key={ct.value} value={ct.value}>
                  {ct.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-md">
          <div>
            <label className="mb-xs block font-sans text-body-sm text-ink">
              Java 版本
            </label>
            <input
              value={javaVersion}
              onChange={(e) => setJavaVersion(e.target.value)}
              placeholder="自动匹配"
              disabled={isSubmitting}
              className="w-full rounded-md border border-hairline bg-surface-soft px-3.5 py-2.5 font-sans text-body-md text-muted outline-none disabled:opacity-50"
            />
          </div>

          <div>
            <label className="mb-xs block font-sans text-body-sm text-ink">
              包名 <span className="text-error">*</span>
            </label>
            <input
              value={packageName}
              onChange={(e) => setPackageName(e.target.value)}
              placeholder="com.example.myplugin"
              required
              disabled={isSubmitting}
              className="w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 font-sans text-body-md text-ink outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15 disabled:opacity-50"
            />
          </div>
        </div>

        <div>
          <label className="mb-xs block font-sans text-body-sm text-ink">
            功能描述 <span className="text-error">*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="描述你想实现的插件功能，包括命令、事件、配置等……"
            required
            rows={6}
            disabled={isSubmitting}
            className="w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 font-sans text-body-md text-ink outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15 disabled:opacity-50"
          />
        </div>

        {isSubmitting && (
          <div className="rounded-lg border border-hairline bg-surface-card p-md">
            <div className="mb-sm flex items-center justify-between">
              <span className="font-sans text-body-sm text-ink">{stage}</span>
              <span className="font-sans text-caption text-muted">
                {progress}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-hairline">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            {streamContent && (
              <div className="mt-sm max-h-48 overflow-y-auto rounded-md bg-surface-dark-soft p-sm font-mono text-caption text-on-dark-soft">
                <pre className="whitespace-pre-wrap break-all">{streamContent}</pre>
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-primary px-5 py-3 font-sans text-button text-on-primary transition-colors hover:bg-primary-active disabled:cursor-not-allowed disabled:bg-primary-disabled"
        >
          {isSubmitting ? '生成中…' : '生成插件'}
        </button>
      </form>
    </div>
  );
}
