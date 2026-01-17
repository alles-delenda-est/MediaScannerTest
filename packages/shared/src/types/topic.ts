export interface Topic {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  keywords: string[];
  aiPrompt: string;
  minRelevanceScore: number;
  isActive: boolean;
  isSystem: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ArticleTopic {
  id: string;
  articleId: string;
  topicId: string;
  relevanceScore: number;
  reasoning: string | null;
  potentialAngle: string | null;
  analyzedAt: Date;
}

export interface ArticleTopicWithTopic extends ArticleTopic {
  topic: Topic;
}

export interface TopicRelevanceResult {
  topicId: string;
  topicName: string;
  relevanceScore: number;
  reasoning: string;
  potentialAngle: string;
}

export interface CreateTopicInput {
  name: string;
  description?: string;
  keywords: string[];
  aiPrompt: string;
  minRelevanceScore?: number;
  isActive?: boolean;
}

export interface UpdateTopicInput {
  name?: string;
  description?: string;
  keywords?: string[];
  aiPrompt?: string;
  minRelevanceScore?: number;
  isActive?: boolean;
}

export interface TopicFilters {
  active?: boolean;
}
