export type ArticleStatus = 'pending' | 'analyzing' | 'relevant' | 'irrelevant' | 'error';

export interface Article {
  id: string;
  sourceId: string | null;
  externalId: string | null;
  url: string;
  urlHash: string;
  title: string;
  lede: string | null;
  fullText: string | null;
  author: string | null;
  publishedAt: Date | null;
  fetchedAt: Date;
  status: ArticleStatus;
  relevanceScore: number | null;
  relevanceReasoning: string | null;
  keywords: string[];
  categories: string[];
  analyzedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ArticleWithSource extends Article {
  source: Source | null;
}

export interface ArticleForAnalysis {
  id: string;
  title: string;
  lede: string;
  source: string;
  url: string;
}

export interface RelevanceResult {
  relevanceScore: number;
  reasoning: string;
  keywords: string[];
  categories: string[];
  potentialAngle: string;
}

export type SourceType = 'rss' | 'twitter' | 'mastodon' | 'bluesky';
export type SourceCategory = 'national' | 'regional' | 'social';

export interface Source {
  id: string;
  name: string;
  slug: string;
  type: SourceType;
  category: SourceCategory;
  url: string;
  region: string | null;
  isActive: boolean;
  fetchIntervalMinutes: number;
  lastFetchedAt: Date | null;
  lastError: string | null;
  errorCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateArticleInput {
  sourceId: string;
  externalId?: string;
  url: string;
  title: string;
  lede?: string;
  fullText?: string;
  author?: string;
  publishedAt?: Date;
}
