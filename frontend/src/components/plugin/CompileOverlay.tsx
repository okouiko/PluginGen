import { useState, useEffect, useRef, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useWebSocket } from '@/hooks/use-websocket';
import type { ApiResponse } from '@/types/api';

type CompileState = 'IDLE' | 'QUEUED' | 'COMPILING' | 'SUCCESS' | 'FAILED';

interface CompileOverlayProps {
  pluginId: string;
  pluginName: string;
  open: boolean;
  onClose: () => void;
}

export function CompileOverlay({ pluginId, pluginName, open, onClose }: CompileOverlayProps) {
  const [status, setStatus] = useState<CompileState>('IDLE');
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState('');
  const logEndRef = useRef<HTMLDivElement>(null);
  const ws = useWebSocket();

  useEffect(() => {
    setStatus('IDLE');
    setProgress(0);
    setLog('');
  }, [open, pluginId]);

  // Poll compile status as fallback for logs
  const pollStatus = useCallback(async () => {
    if (status !== 'COMPILING') return;
    try {
      const res = await apiClient.get<ApiResponse<{ compileLog: string; status: string }>>(`/compile/status/${pluginId}`);
      const d = res.data.data;
      if (d.compileLog) setLog(d.compileLog);
      if (d.status === 'SUCCESS') { setStatus('SUCCESS'); setProgress(100); }
      else if (d.status === 'FAILED') setStatus('FAILED');
    } catch {}
  }, [status, pluginId]);

  useEffect(() => {
    if (status === 'COMPILING') {
      const interval = setInterval(pollStatus, 2000);
      return () => clearInterval(interval);
    }
  }, [status, pollStatus]);

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

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  const compileMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<ApiResponse<unknown>>(`/compile/start/${pluginId}`);
      return res.data;
    },
    onSuccess: () => {
      setStatus('COMPILING');
      setLog('正在连接 Maven…\n');
      setProgress(5);
    },
  });

  const fixMutation = useMutation({
    mutationFn: async () => {
      const apiKey = (() => { try { return localStorage.getItem('plugingen_deepseek_api_key') || ''; } catch { return ''; } })();
      const res = await apiClient.post<ApiResponse<{ newVersion: number; fixRound: number; fixes: string[]; recompileStarted: boolean }>>(`/compile/fix/${pluginId}`, {}, { headers: apiKey ? { 'x-api-key': apiKey } : undefined });
      return res.data.data;
    },
    onSuccess: (data) => {
      setLog((prev) => prev + `\n--- 自动修复 (第${data.fixRound}轮) ---\n${data.fixes.join('\n')}`);
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setLog((prev) => prev + `\n自动修复失败: ${axiosErr?.response?.data?.message || '请检查 API Key 配置'}\n`);
    },
  });

  const handleDownload = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-md flex w-full max-w-2xl flex-col rounded-xl bg-canvas shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-hairline px-lg py-md">
          <div>
            <h3 className="font-sans text-title-md text-ink">编译 {pluginName}</h3>
            <p className="font-sans text-caption text-muted">
              {status === 'IDLE' && '准备编译'}
              {status === 'COMPILING' && `正在编译… ${progress}%`}
              {status === 'SUCCESS' && '编译成功'}
              {status === 'FAILED' && '编译失败'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-sm font-sans text-body-sm text-muted transition-colors hover:bg-surface-soft hover:text-ink"
          >
            ✕
          </button>
        </div>

        {/* Progress bar */}
        {status === 'COMPILING' && (
          <div className="px-lg pt-md">
            <div className="h-2 overflow-hidden rounded-full bg-hairline">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${Math.max(5, progress)}%` }}
              />
            </div>
          </div>
        )}

        {/* Status badges */}
        <div className="px-lg pt-md">
          {status === 'SUCCESS' && (
            <div className="rounded-md bg-success/10 px-md py-sm font-sans text-body-sm text-success">编译成功！</div>
          )}
          {status === 'FAILED' && (
            <div className="rounded-md bg-error/10 px-md py-sm font-sans text-body-sm text-error">编译失败</div>
          )}
        </div>

        {/* Log area - always visible once compiling */}
        {(status === 'COMPILING' || status === 'SUCCESS' || status === 'FAILED') && (
          <div className="flex-1 px-lg py-md" style={{ minHeight: 200 }}>
            <div className="h-64 overflow-y-auto rounded-lg bg-surface-dark p-md font-mono text-caption text-on-dark-soft">
              <pre className="whitespace-pre-wrap">
                {log || '正在启动 Maven 编译…'}
                <div ref={logEndRef} />
              </pre>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-between border-t border-hairline px-lg py-md">
          <div className="flex gap-sm">
            {status === 'IDLE' && (
              <button
                onClick={() => compileMutation.mutate()}
                className="rounded-md bg-primary px-5 py-2.5 font-sans text-button text-on-primary transition-colors hover:bg-primary-active"
              >
                开始编译
              </button>
            )}
            {status === 'FAILED' && (
              <button
                onClick={() => compileMutation.mutate()}
                className="rounded-md bg-primary px-5 py-2.5 font-sans text-button text-on-primary transition-colors hover:bg-primary-active"
              >
                重新编译
              </button>
            )}
            {status === 'FAILED' && (
              <button
                onClick={() => fixMutation.mutate()}
                disabled={fixMutation.isPending}
                className="rounded-md border border-hairline bg-canvas px-5 py-2.5 font-sans text-button text-ink transition-colors hover:bg-surface-soft disabled:opacity-50"
              >
                {fixMutation.isPending ? '修复中…' : '自动修复'}
              </button>
            )}
            {status === 'SUCCESS' && (
              <>
                <button
                  onClick={() => handleDownload(`/api/file/download/${pluginId}/jar`)}
                  className="rounded-md bg-primary px-5 py-2.5 font-sans text-button text-on-primary transition-colors hover:bg-primary-active"
                >
                  下载 JAR
                </button>
                <button
                  onClick={() => handleDownload(`/api/file/download/${pluginId}/zip`)}
                  className="rounded-md border border-hairline bg-canvas px-5 py-2.5 font-sans text-button text-ink transition-colors hover:bg-surface-soft"
                >
                  下载源码 ZIP
                </button>
              </>
            )}
          </div>
          {(status === 'SUCCESS' || status === 'FAILED') && (
            <button
              onClick={onClose}
              className="rounded-md px-4 py-2 font-sans text-button text-muted transition-colors hover:text-ink"
            >
              关闭
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
