import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';
import type { ApiResponse } from '@/types/api';

export function QuotaDisplay() {
  const { data } = useQuery({
    queryKey: ['daily-status'],
    queryFn: async () => {
      const res = await apiClient.get<
        ApiResponse<{
          checkedInToday: boolean;
          streak: number;
          dailyQuota: number;
          maxQuota: number;
          unclaimedTaskCount: number;
        }>
      >('/daily/status');
      return res.data.data;
    },
    refetchInterval: 60000,
  });

  if (!data) return null;

  const remaining = data.dailyQuota;
  const isLow = remaining <= 5;

  return (
    <span
      className={cn(
        'font-sans text-caption',
        isLow ? 'text-error' : 'text-muted',
      )}
    >
      剩余 {remaining}/{data.maxQuota}
    </span>
  );
}
