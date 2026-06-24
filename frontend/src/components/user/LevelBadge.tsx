interface LevelBadgeProps {
  level: number;
  title: string;
  size?: 'sm' | 'md';
}

export function LevelBadge({ level, title, size = 'md' }: LevelBadgeProps) {
  const sizeClasses = size === 'sm' ? 'text-caption px-sm py-xxs' : 'text-body-sm px-md py-xs';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill bg-surface-cream-strong font-sans text-muted ${sizeClasses}`}
    >
      <span>Lv.{level}</span>
      <span className="text-muted-soft">·</span>
      <span>{title}</span>
    </span>
  );
}
