import { claudeService } from './claude.service.js';
import {
  RELEVANCE_ANALYSIS_SYSTEM_PROMPT,
  RELEVANCE_ANALYSIS_USER_PROMPT,
  MULTI_TOPIC_RELEVANCE_SYSTEM_PROMPT,
  MULTI_TOPIC_RELEVANCE_USER_PROMPT,
} from '@media-scanner/shared';
import { logger } from '../../utils/logger.js';
import type { Article, RelevanceResult, Topic, TopicRelevanceResult } from '@media-scanner/shared';

export interface ArticleForAnalysis {
  id: string;
  title: string;
  lede: string;
  source: string;
  url: string;
}

interface RawRelevanceResult {
  relevance_score: number;
  reasoning: string;
  keywords: string[];
  categories: string[];
  potential_angle: string;
}

class RelevanceAnalyzerService {
  private analysisCount = 0;
  private relevantCount = 0;

  /**
   * Analyze a single article for relevance to administrative absurdities
   */
  async analyzeArticle(article: ArticleForAnalysis): Promise<RelevanceResult> {
    const startTime = Date.now();
    this.analysisCount++;

    logger.debug({
      articleId: article.id,
      title: article.title.slice(0, 50),
    }, 'Starting relevance analysis');

    try {
      // Skip articles without meaningful content
      if (!article.lede || article.lede.length < 50) {
        logger.debug({ articleId: article.id }, 'Article has insufficient lede, marking as low relevance');
        return {
          relevanceScore: 0.1,
          reasoning: 'Article sans chapeau suffisant pour analyse',
          keywords: [],
          categories: [],
          potentialAngle: '',
        };
      }

      const result = await claudeService.chatJson<RawRelevanceResult>(
        [
          {
            role: 'user',
            content: RELEVANCE_ANALYSIS_USER_PROMPT({
              title: article.title,
              lede: article.lede,
              source: article.source,
            }),
          },
        ],
        {
          model: 'claude-3-haiku-20240307', // Fast and cheap for classification
          maxTokens: 500,
          temperature: 0.3, // Lower temperature for more consistent scoring
          systemPrompt: RELEVANCE_ANALYSIS_SYSTEM_PROMPT,
        }
      );

      const normalizedResult = this.normalizeResult(result);

      const duration = Date.now() - startTime;

      if (normalizedResult.relevanceScore >= 0.5) {
        this.relevantCount++;
      }

      logger.info({
        articleId: article.id,
        score: normalizedResult.relevanceScore,
        categories: normalizedResult.categories,
        duration,
      }, 'Relevance analysis completed');

      return normalizedResult;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error({
        articleId: article.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      }, 'Relevance analysis failed');

      // Return a default low-relevance result on error
      return {
        relevanceScore: 0,
        reasoning: 'Erreur lors de l\'analyse',
        keywords: [],
        categories: [],
        potentialAngle: '',
      };
    }
  }

  /**
   * Analyze multiple articles in batch (with rate limiting)
   */
  async analyzeBatch(
    articles: ArticleForAnalysis[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<Map<string, RelevanceResult>> {
    const results = new Map<string, RelevanceResult>();

    logger.info({ count: articles.length }, 'Starting batch relevance analysis');

    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];

      try {
        const result = await this.analyzeArticle(article);
        results.set(article.id, result);

        if (onProgress) {
          onProgress(i + 1, articles.length);
        }
      } catch (error) {
        logger.error({
          articleId: article.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        }, 'Failed to analyze article in batch');

        // Continue with other articles
        results.set(article.id, {
          relevanceScore: 0,
          reasoning: 'Erreur lors de l\'analyse',
          keywords: [],
          categories: [],
          potentialAngle: '',
        });
      }

      // Small delay between requests to be nice to the API
      if (i < articles.length - 1) {
        await this.sleep(100);
      }
    }

    logger.info({
      total: articles.length,
      relevant: [...results.values()].filter(r => r.relevanceScore >= 0.5).length,
    }, 'Batch relevance analysis completed');

    return results;
  }

  /**
   * Analyze an article against multiple topics in a single API call
   */
  async analyzeArticleForTopics(
    article: ArticleForAnalysis,
    topics: Topic[]
  ): Promise<TopicRelevanceResult[]> {
    const startTime = Date.now();

    logger.debug({
      articleId: article.id,
      topicCount: topics.length,
      title: article.title.slice(0, 50),
    }, 'Starting multi-topic relevance analysis');

    if (topics.length === 0) {
      return [];
    }

    // Skip articles without meaningful content
    if (!article.lede || article.lede.length < 50) {
      logger.debug({ articleId: article.id }, 'Article has insufficient lede for multi-topic analysis');
      return topics.map((topic) => ({
        topicId: topic.id,
        topicName: topic.name,
        relevanceScore: 0.1,
        reasoning: 'Article sans chapeau suffisant pour analyse',
        potentialAngle: '',
      }));
    }

    try {
      const result = await claudeService.chatJson<{
        results: Array<{
          topic_id: string;
          topic_name: string;
          relevance_score: number;
          reasoning: string;
          potential_angle: string;
        }>;
      }>(
        [
          {
            role: 'user',
            content: MULTI_TOPIC_RELEVANCE_USER_PROMPT(
              {
                title: article.title,
                lede: article.lede,
                source: article.source,
              },
              topics.map((t) => ({
                id: t.id,
                name: t.name,
                aiPrompt: t.aiPrompt,
              }))
            ),
          },
        ],
        {
          model: 'claude-3-haiku-20240307',
          maxTokens: 1000, // More tokens for multiple topics
          temperature: 0.3,
          systemPrompt: MULTI_TOPIC_RELEVANCE_SYSTEM_PROMPT,
        }
      );

      const duration = Date.now() - startTime;

      // Normalize and map results
      const normalizedResults: TopicRelevanceResult[] = result.results.map((r) => ({
        topicId: r.topic_id,
        topicName: r.topic_name,
        relevanceScore: Math.max(0, Math.min(1, r.relevance_score || 0)),
        reasoning: r.reasoning || '',
        potentialAngle: r.potential_angle || '',
      }));

      // Ensure we have results for all topics (fill in missing ones)
      const resultMap = new Map(normalizedResults.map((r) => [r.topicId, r]));
      const completeResults = topics.map((topic) => {
        const existing = resultMap.get(topic.id);
        if (existing) return existing;
        return {
          topicId: topic.id,
          topicName: topic.name,
          relevanceScore: 0,
          reasoning: 'Résultat manquant',
          potentialAngle: '',
        };
      });

      logger.info({
        articleId: article.id,
        topicCount: topics.length,
        duration,
        scores: completeResults.map((r) => ({ topic: r.topicName, score: r.relevanceScore })),
      }, 'Multi-topic relevance analysis completed');

      return completeResults;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error({
        articleId: article.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      }, 'Multi-topic relevance analysis failed');

      // Return default low-relevance results on error
      return topics.map((topic) => ({
        topicId: topic.id,
        topicName: topic.name,
        relevanceScore: 0,
        reasoning: 'Erreur lors de l\'analyse',
        potentialAngle: '',
      }));
    }
  }

  /**
   * Quick pre-filter using keywords to avoid unnecessary API calls
   * @deprecated Use topic-based filtering with dynamic keywords
   */
  preFilterByKeywords(article: { title: string; lede: string }): boolean {
    const text = `${article.title} ${article.lede}`.toLowerCase();

    // Keywords that often indicate relevant content
    const positiveKeywords = [
      'administration',
      'bureaucratie',
      'bureaucratique',
      'réglementation',
      'paperasse',
      'formulaire',
      'cerfa',
      'norme',
      'complexité',
      'simplification',
      'fonctionnaire',
      'service public',
      'impôt',
      'taxe',
      'dépense publique',
      'gaspillage',
      'collectivité',
      'mairie',
      'préfecture',
      'délai',
      'procédure',
      'démarche',
      'absurde',
      'aberrant',
      'kafkaïen',
    ];

    // Check if any positive keyword is present
    return positiveKeywords.some((keyword) => text.includes(keyword));
  }

  /**
   * Normalize and validate the AI response
   */
  private normalizeResult(raw: RawRelevanceResult): RelevanceResult {
    return {
      relevanceScore: Math.max(0, Math.min(1, raw.relevance_score || 0)),
      reasoning: raw.reasoning || '',
      keywords: Array.isArray(raw.keywords) ? raw.keywords.slice(0, 10) : [],
      categories: Array.isArray(raw.categories) ? raw.categories.slice(0, 5) : [],
      potentialAngle: raw.potential_angle || '',
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get analysis statistics
   */
  getStats() {
    return {
      totalAnalyzed: this.analysisCount,
      totalRelevant: this.relevantCount,
      relevanceRate: this.analysisCount > 0
        ? (this.relevantCount / this.analysisCount * 100).toFixed(1)
        : '0',
    };
  }
}

// Export singleton instance
export const relevanceAnalyzer = new RelevanceAnalyzerService();
