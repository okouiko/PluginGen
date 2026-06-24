import { Link } from 'react-router-dom';

interface PluginSummary {
  id: string;
  name: string;
  description: string | null;
  coreType: string;
  mcVersion: string;
  status: string;
  downloadCount: number;
  favoriteCount: number;
  starCount: number;
  avgRating: number;
  ratingCount: number;
  createdAt: string;
  user: {
    id: string;
    nickname: string;
    avatar: string;
  };
}

interface PluginGridProps {
  plugins: PluginSummary[];
}

export function PluginGrid({ plugins }: PluginGridProps) {
  if (plugins.length === 0) {
    return (
      <div className="rounded-lg bg-surface-card p-xl text-center">
        <p className="font-sans text-body-md text-muted">
          没有找到匹配的插件
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-md md:grid-cols-2 lg:grid-cols-3">
      {plugins.map((plugin) => (
        <Link
          key={plugin.id}
          to={`/workspace/${plugin.id}`}
          className="block rounded-lg border border-hairline bg-surface-card p-xl transition-shadow hover:shadow-sm"
        >
          <h3 className="font-display text-title-md text-ink">{plugin.name}</h3>
          <p className="mt-xs font-sans text-body-sm text-muted line-clamp-2">
            {plugin.description || '暂无描述'}
          </p>
          <div className="mt-sm flex flex-wrap gap-xs">
            <span className="rounded-pill bg-surface-cream-strong px-sm py-xxs font-sans text-caption text-muted">
              {plugin.coreType}
            </span>
            <span className="rounded-pill bg-surface-cream-strong px-sm py-xxs font-sans text-caption text-muted">
              MC {plugin.mcVersion}
            </span>
          </div>
          <div className="mt-md flex items-center justify-between border-t border-hairline pt-sm">
            <div className="flex items-center gap-sm">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-caption text-primary">
                {plugin.user.nickname.charAt(0).toUpperCase()}
              </div>
              <span className="font-sans text-caption text-muted">
                {plugin.user.nickname}
              </span>
            </div>
            <div className="flex items-center gap-sm font-sans text-caption text-muted-soft">
              <span>⭐ {plugin.avgRating.toFixed(1)}</span>
              <span>⬇ {plugin.downloadCount}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
