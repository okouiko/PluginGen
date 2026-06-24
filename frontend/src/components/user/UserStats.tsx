interface UserStatsProps {
  pluginCount: number;
  totalDownloads: number;
  totalStars: number;
  followerCount: number;
}

export function UserStats({
  pluginCount,
  totalDownloads,
  totalStars,
  followerCount,
}: UserStatsProps) {
  const stats = [
    { label: '作品', value: pluginCount },
    { label: '下载', value: totalDownloads },
    { label: '获赞', value: totalStars },
    { label: '粉丝', value: followerCount },
  ];

  return (
    <div className="grid grid-cols-4 gap-sm">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-lg bg-surface-soft p-md text-center"
        >
          <div className="font-sans text-title-md text-ink">
            {stat.value.toLocaleString()}
          </div>
          <div className="font-sans text-caption text-muted">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}
