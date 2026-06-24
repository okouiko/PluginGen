import type { CompileStatus } from '@/types/plugin';

interface VersionItem {
  id: string;
  version: number;
  compileStatus: CompileStatus;
  createdAt: string;
}

interface VersionHistoryProps {
  versions: VersionItem[];
  currentVersion: number;
  onRestore: (version: number) => void;
  onDiff?: (v1: number, v2: number) => void;
}

const statusLabels: Record<CompileStatus, { label: string; color: string }> = {
  PENDING: { label: '待编译', color: 'text-muted' },
  COMPILING: { label: '编译中', color: 'text-accent-amber' },
  SUCCESS: { label: '成功', color: 'text-success' },
  FAILED: { label: '失败', color: 'text-error' },
};

export function VersionHistory({
  versions,
  currentVersion,
  onRestore,
  onDiff,
}: VersionHistoryProps) {
  if (!versions || versions.length === 0) {
    return (
      <div className="p-md font-sans text-body-sm text-muted">
        暂无版本历史
      </div>
    );
  }

  return (
    <div className="space-y-xs">
      <h3 className="font-sans text-title-sm text-ink">版本历史</h3>
      <p className="font-sans text-caption text-muted-soft">
        当前: v{currentVersion}
        {currentVersion !== versions[0]?.version && (
          <button
            onClick={() => onRestore(versions[0].version)}
            className="ml-sm text-primary hover:text-primary-active"
          >
            回到最新
          </button>
        )}
      </p>
      <div className="mt-sm space-y-xs">
        {versions.map((v) => {
          const { label, color } = statusLabels[v.compileStatus];
          const isCurrent = v.version === currentVersion;

          return (
            <div
              key={v.id}
              className={`rounded-md border p-sm transition-colors ${
                isCurrent
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-transparent hover:bg-surface-soft'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-sans text-body-sm text-ink">
                    v{v.version}
                    {isCurrent && (
                      <span className="ml-sm font-sans text-caption text-primary">当前</span>
                    )}
                  </span>
                  <span className={`ml-sm font-sans text-caption ${color}`}>
                    {label}
                  </span>
                </div>
                <span className="font-sans text-caption text-muted-soft">
                  {new Date(v.createdAt).toLocaleDateString('zh-CN')}
                </span>
              </div>

              <div className="mt-sm flex gap-sm">
                {!isCurrent && (
                  <button
                    onClick={() => onRestore(v.version)}
                    className="font-sans text-caption text-accent-teal transition-colors hover:text-accent-teal/80"
                  >
                    回退到此版本
                  </button>
                )}
                {onDiff && v.version > 1 && (
                  <button
                    onClick={() => onDiff(v.version - 1, v.version)}
                    className="font-sans text-caption text-primary transition-colors hover:text-primary-active"
                  >
                    对比 v{v.version - 1}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
