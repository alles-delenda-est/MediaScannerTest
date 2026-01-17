import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { ExternalLink, RefreshCw } from 'lucide-react';
import type { ArticleWithSource, PaginatedResponse } from '@media-scanner/shared';

export default function ArticlesPage() {
  const [articles, setArticles] = useState<ArticleWithSource[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('relevant');

  useEffect(() => {
    loadArticles();
  }, [statusFilter, pagination.page]);

  async function loadArticles() {
    setLoading(true);
    try {
      const res = await api.get<PaginatedResponse<ArticleWithSource>>(
        `/api/articles?status=${statusFilter}&page=${pagination.page}&limit=20&sort=date&order=desc`
      );
      setArticles(res.data.data);
      setPagination(res.data.pagination);
    } catch (error) {
      console.error('Failed to load articles:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Articles</h1>
          <p className="mt-1 text-sm text-gray-500">
            {pagination.total} articles trouvés
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className="input w-40"
          >
            <option value="relevant">Pertinents</option>
            <option value="pending">En attente</option>
            <option value="irrelevant">Non pertinents</option>
            <option value="">Tous</option>
          </select>
          <button
            onClick={() => loadArticles()}
            className="btn-secondary"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Articles list */}
      <div className="card divide-y divide-gray-200">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : articles.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            Aucun article trouvé
          </div>
        ) : (
          articles.map((article) => (
            <ArticleRow key={article.id} article={article} onRefresh={loadArticles} />
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
            disabled={pagination.page === 1}
            className="btn-secondary"
          >
            Précédent
          </button>
          <span className="text-sm text-gray-500">
            Page {pagination.page} sur {pagination.totalPages}
          </span>
          <button
            onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
            disabled={pagination.page === pagination.totalPages}
            className="btn-secondary"
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}

function ArticleRow({
  article,
  onRefresh,
}: {
  article: ArticleWithSource;
  onRefresh: () => void;
}) {
  const statusBadge = {
    relevant: 'badge-success',
    irrelevant: 'badge-gray',
    pending: 'badge-warning',
    analyzing: 'badge-info',
    error: 'badge-danger',
  }[article.status] || 'badge-gray';

  const statusLabel = {
    relevant: 'Pertinent',
    irrelevant: 'Non pertinent',
    pending: 'En attente',
    analyzing: 'Analyse...',
    error: 'Erreur',
  }[article.status] || article.status;

  async function handleReanalyze() {
    try {
      await api.post(`/api/articles/${article.id}/reanalyze`);
      onRefresh();
    } catch (error) {
      console.error('Failed to reanalyze:', error);
    }
  }

  return (
    <div className="px-6 py-4 hover:bg-gray-50">
      <div className="flex items-start">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <span className={statusBadge}>{statusLabel}</span>
            <span className="text-xs text-gray-500">{article.source?.name}</span>
            {article.relevanceScore !== null && (
              <span className="text-xs font-medium text-gray-700">
                {Math.round(article.relevanceScore * 100)}%
              </span>
            )}
          </div>
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block text-sm font-medium text-gray-900 hover:text-primary-600"
          >
            {article.title}
            <ExternalLink className="inline w-3 h-3 ml-1 text-gray-400" />
          </a>
          {article.lede && (
            <p className="mt-1 text-sm text-gray-500 line-clamp-2">{article.lede}</p>
          )}
          {article.relevanceReasoning && (
            <p className="mt-2 text-xs text-gray-600 italic">
              {article.relevanceReasoning}
            </p>
          )}
          <div className="mt-2 flex items-center space-x-2">
            {article.categories?.map((cat) => (
              <span key={cat} className="badge-info text-xs">{cat}</span>
            ))}
          </div>
        </div>
        <div className="ml-4 flex-shrink-0">
          <button
            onClick={handleReanalyze}
            className="text-xs text-gray-500 hover:text-primary-600"
          >
            Ré-analyser
          </button>
        </div>
      </div>
    </div>
  );
}
