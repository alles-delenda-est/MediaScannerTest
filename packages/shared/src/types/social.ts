import type { ArticleStatus } from './article.js';

export type SocialPlatform = 'twitter' | 'mastodon' | 'bluesky';

export interface SocialPost {
  id: string;
  sourceId: string | null;
  platform: SocialPlatform;
  externalId: string;
  authorHandle: string | null;
  authorName: string | null;
  content: string;
  url: string | null;
  postedAt: Date | null;
  likesCount: number;
  repostsCount: number;
  repliesCount: number;
  status: ArticleStatus;
  relevanceScore: number | null;
  relevanceReasoning: string | null;
  linkedArticleId: string | null;
  fetchedAt: Date;
  analyzedAt: Date | null;
  createdAt: Date;
}

export type GeneratedPostStatus = 'draft' | 'approved' | 'edited' | 'posted' | 'rejected';

export interface GeneratedPost {
  id: string;
  articleId: string | null;
  socialPostId: string | null;
  contentTwitter: string | null;
  contentMastodon: string | null;
  contentBluesky: string | null;
  contentLong: string | null;
  tone: string | null;
  hashtags: string[];
  status: GeneratedPostStatus;
  approvedBy: string | null;
  approvedAt: Date | null;
  editedContent: string | null;
  postedTo: string[];
  postedAt: Date | null;
  externalPostIds: Record<string, string> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GeneratedPostWithArticle extends GeneratedPost {
  article: {
    id: string;
    title: string;
    url: string;
    source: {
      name: string;
    } | null;
  } | null;
}

export interface GeneratePostsResult {
  twitter: {
    content: string;
    hashtags: string[];
  };
  mastodon: {
    content: string;
    hashtags: string[];
  };
  bluesky: {
    content: string;
  };
  tone: string;
  qualityScore: number;
}
