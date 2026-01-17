export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface ApiSuccess<T> {
  data: T;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface ArticleFilters {
  status?: string;
  sourceId?: string;
  from?: string;
  to?: string;
  minScore?: number;
  category?: string;
  search?: string;
}

export interface ArticleQueryParams extends ArticleFilters {
  page?: number;
  limit?: number;
  sort?: 'relevance' | 'date';
  order?: 'asc' | 'desc';
}

export interface PostFilters {
  status?: string;
  articleId?: string;
  from?: string;
  to?: string;
}

export interface PostQueryParams extends PostFilters {
  page?: number;
  limit?: number;
}

export interface SourceFilters {
  type?: string;
  category?: string;
  active?: boolean;
}

export interface TriggerScanRequest {
  type?: 'full' | 'incremental';
  sourceId?: string;
}

export interface UpdatePostRequest {
  status?: string;
  editedContent?: string;
}

export interface RegeneratePostRequest {
  tone?: string;
  instructions?: string;
}
