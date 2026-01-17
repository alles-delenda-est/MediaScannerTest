export type ScanType = 'scheduled' | 'manual' | 'retry';
export type ScanStatus = 'running' | 'completed' | 'failed' | 'partial';

export interface ScanLog {
  id: string;
  sourceId: string | null;
  scanType: ScanType;
  status: ScanStatus;
  startedAt: Date;
  completedAt: Date | null;
  itemsFound: number;
  itemsNew: number;
  itemsAnalyzed: number;
  itemsRelevant: number;
  errorMessage: string | null;
  errorStack: string | null;
  metadata: Record<string, unknown> | null;
}

export interface DailySummary {
  id: string;
  summaryDate: string;
  totalArticlesScanned: number;
  totalSocialPostsScanned: number;
  relevantArticlesCount: number;
  relevantSocialPostsCount: number;
  postsGenerated: number;
  summaryText: string | null;
  topStories: TopStory[] | null;
  scanStartedAt: Date | null;
  scanCompletedAt: Date | null;
  scanDurationSeconds: number | null;
  errorsCount: number;
  errorDetails: Record<string, unknown> | null;
  createdAt: Date;
}

export interface TopStory {
  articleId: string;
  title: string;
  relevanceScore: number;
  snippet: string;
}

export interface DashboardStats {
  today: {
    articles: number;
    relevant: number;
    postsGenerated: number;
  };
  week: {
    articles: number;
    relevant: number;
    postsGenerated: number;
  };
  month: {
    articles: number;
    relevant: number;
    postsGenerated: number;
  };
}
