const CORE_TYPES = [
  { value: '', label: '全部核心' },
  { value: 'BUKKIT', label: 'Bukkit' },
  { value: 'SPIGOT', label: 'Spigot' },
  { value: 'PAPER', label: 'Paper' },
  { value: 'PURPUR', label: 'Purpur' },
  { value: 'BUNGEECORD', label: 'BungeeCord' },
  { value: 'VELOCITY', label: 'Velocity' },
];

interface SearchBarProps {
  query: string;
  coreType: string;
  sort: string;
  onQueryChange: (q: string) => void;
  onCoreTypeChange: (ct: string) => void;
  onSortChange: (sort: string) => void;
}

export function SearchBar({
  query,
  coreType,
  sort,
  onQueryChange,
  onCoreTypeChange,
  onSortChange,
}: SearchBarProps) {
  return (
    <div className="flex flex-col gap-sm md:flex-row md:items-center">
      <div className="flex-1">
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="搜索插件名称或描述…"
          className="w-full rounded-md border border-hairline bg-canvas px-3.5 py-2.5 font-sans text-body-md text-ink outline-none transition-colors focus:border-primary focus:ring-3 focus:ring-primary/15"
        />
      </div>
      <select
        value={coreType}
        onChange={(e) => onCoreTypeChange(e.target.value)}
        className="rounded-md border border-hairline bg-canvas px-3.5 py-2.5 font-sans text-body-md text-ink outline-none focus:border-primary"
      >
        {CORE_TYPES.map((ct) => (
          <option key={ct.value} value={ct.value}>
            {ct.label}
          </option>
        ))}
      </select>
      <select
        value={sort}
        onChange={(e) => onSortChange(e.target.value)}
        className="rounded-md border border-hairline bg-canvas px-3.5 py-2.5 font-sans text-body-md text-ink outline-none focus:border-primary"
      >
        <option value="latest">最新发布</option>
        <option value="popular">最热门</option>
      </select>
    </div>
  );
}
