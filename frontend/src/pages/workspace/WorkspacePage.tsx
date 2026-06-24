import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { SearchBar } from '@/components/community/SearchBar';
import { PluginGrid } from '@/components/community/PluginGrid';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import type { ApiResponse } from '@/types/api';

export default function WorkspacePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [coreType, setCoreType] = useState(searchParams.get('coreType') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || 'latest');
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQuery) params.set('q', debouncedQuery);
    if (coreType) params.set('coreType', coreType);
    if (sort) params.set('sort', sort);
    if (page > 1) params.set('page', String(page));
    setSearchParams(params, { replace: true });
  }, [debouncedQuery, coreType, sort, page, setSearchParams]);

  const { data, isLoading } = useQuery({
    queryKey: ['community-plugins', debouncedQuery, coreType, sort, page],
    queryFn: async () => {
      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (debouncedQuery) params.q = debouncedQuery;
      if (coreType) params.coreType = coreType;
      if (sort) params.sort = sort;
      const res = await apiClient.get<ApiResponse<any>>('/community/plugins', {
        params,
      });
      return res.data.data;
    },
  });

  const plugins = data?.items || [];
  const totalPages = data?.totalPages || 1;

  return (
    <div className="mx-auto max-w-[1200px] px-lg py-section">
      <h1 className="font-display text-display-sm text-ink">作品广场</h1>
      <p className="mt-sm font-sans text-body-md text-muted">
        发现其他创作者的 Minecraft 插件
      </p>

      <div className="mt-xl space-y-md">
        <SearchBar
          query={query}
          coreType={coreType}
          sort={sort}
          onQueryChange={(q) => {
            setQuery(q);
            setPage(1);
          }}
          onCoreTypeChange={(ct) => {
            setCoreType(ct);
            setPage(1);
          }}
          onSortChange={(s) => {
            setSort(s);
            setPage(1);
          }}
        />

        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <>
            <PluginGrid plugins={plugins} />
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-sm">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-md border border-hairline bg-canvas px-md py-sm font-sans text-button text-ink transition-colors hover:bg-surface-soft disabled:opacity-50"
                >
                  上一页
                </button>
                <span className="font-sans text-body-sm text-muted">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-md border border-hairline bg-canvas px-md py-sm font-sans text-button text-ink transition-colors hover:bg-surface-soft disabled:opacity-50"
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
