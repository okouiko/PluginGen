export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
