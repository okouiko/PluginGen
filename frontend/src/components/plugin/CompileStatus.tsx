import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useWebSocket } from '@/hooks/use-websocket';
import type { ApiResponse } from '@/types/api';

type CompileState = 'IDLE' | 'QUEUED' | 'COMPILING' | 'SUCCESS' | 'FAILED';

interface CompileStatusProps {
  pluginId: string;
  currentVersion: number;
}

export function CompileStatus({ pluginId, currentVersion: _currentVersion }: CompileStatusProps) {
  const [status, setStatus] = useState<CompileState>('IDLE');
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState('');
  const [expandedLog, setExpandedLog] = useState(false);
  const ws = useWebSocket();

  useEffect(() => {
    ws.on('compile.progress', (data: unknown) => {
      const d = data as { percent?: number; stage?: string };
      if (d.percent !== undefined) setProgress(d.percent);
      if (d.stage) setLog((prev) => prev + d.stage);
      setStatus('COMPILING');
    });

    ws.on('compile.completed', (data: unknown) => {
      const d = data as { status: string; error?: string };
      if (d.status === 'SUCCESS') {
        setStatus('SUCCESS');
        setProgress(100);
      } else {
        setStatus('FAILED');
        if (d.error) {
          setLog((prev) => prev + '\n' + d.error);
        }
      }
    });
  }, [ws]);

  const compileMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<ApiResponse<unknown>>(
        `/compile/start/${pluginId}`,
      );
      return res.data;
    },
    onSuccess: () => {
      setStatus('QUEUED');
      setLog('');
      setProgress(0);
    },
  });

  const fixMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<
        ApiResponse<{
          newVersion: number;
          fixRound: number;
          fixes: string[];
          recompileStarted: boolean;
        }>
      >(`/compile/fix/${pluginId}`);
      return res.data.data;
    },
    onSuccess: (data) => {
      setLog(
        (prev) => prev + `\n--- 自动修复 (第${data.fixRound}轮) ---\n${data.fixes.join('\n')}`,
      );
    },
  });

  const handleDownload = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const logLines = log.split('\n').filter(Boolean);
  const displayLog = expandedLog ? logLines : logLines.slice(-50);

  return (
    <div className="space-y-md">
      {/* Compile button */}
      <button
        onClick={() => compileMutation.mutate()}
        disabled={compileMutation.isPending || status === 'COMPILING'}
        className="w-full rounded-md bg-primary px-5 py-3 font-sans text-button text-on-primary transition-colors hover:bg-primary-active disabled:cursor-not-allowed disabled:bg-primary-disabled"
      >
        {status === 'IDLE' && '编译'}
        {status === 'QUEUED' && '等待编译…'}
        {status === 'COMPILING' && `编译中… ${progress}%`}
        {status === 'SUCCESS' && '重新编译'}
        {status === 'FAILED' && '重新编译'}
      </button>

      {/* Progress bar */}
      {(status === 'QUEUED' || status === 'COMPILING') && (
        <div>
          <div className="h-2 overflow-hidden rounded-full bg-hairline">
            <div
              className={`h-full rounded-full bg-primary transition-all duration-300 ${status === 'QUEUED' ? 'animate-pulse' : ''}`}
              style={{ width: status === 'QUEUED' ? '100%' : `${Math.max(5, progress)}%` }}
            />
          </div>
          <p className="mt-xs text-center font-sans text-caption text-muted">
            {status === 'QUEUED' ? '排队中…' : `${progress}%`}
          </p>
        </div>
      )}

      {/* Status indicator */}
      {status === 'SUCCESS' && (
        <div className="rounded-md bg-success/10 px-md py-sm font-sans text-body-sm text-success">
          编译成功！
        </div>
      )}
      {status === 'FAILED' && (
        <div className="rounded-md bg-error/10 px-md py-sm font-sans text-body-sm text-error">
          编译失败
        </div>
      )}

      {/* Log viewer */}
      {(status === 'COMPILING' || status === 'SUCCESS' || status === 'FAILED') && (
        <div className="rounded-lg border border-hairline bg-surface-dark-soft p-sm">
          <div className="mb-xs flex items-center justify-between">
            <span className="font-mono text-caption text-on-dark-soft">
              编译日志
            </span>
            {logLines.length > 50 && (
              <button
                onClick={() => setExpandedLog(!expandedLog)}
                className="font-sans text-caption text-primary hover:text-primary-active"
              >
                {expandedLog ? '收起' : `显示全部 (${logLines.length} 行)`}
              </button>
            )}
          </div>
          <pre className="max-h-48 overflow-y-auto font-mono text-caption text-on-dark-soft">
            {displayLog.length > 0 ? displayLog.join('\n') : '等待编译输出…'}
          </pre>
        </div>
      )}

      {/* Failed: fix button */}
      {status === 'FAILED' && (
        <button
          onClick={() => fixMutation.mutate()}
          disabled={fixMutation.isPending}
          className="w-full rounded-md border border-hairline bg-canvas px-5 py-3 font-sans text-button text-ink transition-colors hover:bg-surface-soft disabled:opacity-50"
        >
          {fixMutation.isPending ? '修复中…' : '自动修复'}
        </button>
      )}

      {/* Success: download buttons */}
      {status === 'SUCCESS' && (
        <div className="flex gap-sm">
          <button
            onClick={() => handleDownload(`/api/file/download/${pluginId}/jar`)}
            className="flex-1 rounded-md bg-primary px-5 py-3 font-sans text-button text-on-primary transition-colors hover:bg-primary-active"
          >
            下载 JAR
          </button>
          <button
            onClick={() => handleDownload(`/api/file/download/${pluginId}/zip`)}
            className="flex-1 rounded-md border border-hairline bg-canvas px-5 py-3 font-sans text-button text-ink transition-colors hover:bg-surface-soft"
          >
            下载源码 ZIP
          </button>
        </div>
      )}
    </div>
  );
}
