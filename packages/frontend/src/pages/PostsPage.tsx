import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Copy, Check, RefreshCw, ThumbsUp, ThumbsDown, ExternalLink } from 'lucide-react';
import type { GeneratedPostWithArticle, PaginatedResponse } from '@media-scanner/shared';

export default function PostsPage() {
  const [posts, setPosts] = useState<GeneratedPostWithArticle[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('draft');

  useEffect(() => {
    loadPosts();
  }, [statusFilter, pagination.page]);

  async function loadPosts() {
    setLoading(true);
    try {
      const res = await api.get<PaginatedResponse<GeneratedPostWithArticle>>(
        `/api/posts?status=${statusFilter}&page=${pagination.page}&limit=20`
      );
      setPosts(res.data.data);
      setPagination(res.data.pagination);
    } catch (error) {
      console.error('Failed to load posts:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Posts générés</h1>
          <p className="mt-1 text-sm text-gray-500">
            {pagination.total} posts disponibles
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
            <option value="draft">Brouillons</option>
            <option value="approved">Approuvés</option>
            <option value="rejected">Rejetés</option>
            <option value="">Tous</option>
          </select>
          <button onClick={() => loadPosts()} className="btn-secondary" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Posts grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : posts.length === 0 ? (
        <div className="card px-6 py-12 text-center text-gray-500">
          Aucun post trouvé
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onRefresh={loadPosts} />
          ))}
        </div>
      )}

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

function PostCard({
  post,
  onRefresh,
}: {
  post: GeneratedPostWithArticle;
  onRefresh: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'twitter' | 'mastodon' | 'bluesky'>('twitter');

  const content = {
    twitter: post.contentTwitter,
    mastodon: post.contentMastodon,
    bluesky: post.contentBluesky,
  }[activeTab];

  const charLimit = {
    twitter: 280,
    mastodon: 500,
    bluesky: 300,
  }[activeTab];

  async function handleApprove() {
    try {
      await api.post(`/api/posts/${post.id}/approve`);
      onRefresh();
    } catch (error) {
      console.error('Failed to approve:', error);
    }
  }

  async function handleReject() {
    try {
      await api.post(`/api/posts/${post.id}/reject`);
      onRefresh();
    } catch (error) {
      console.error('Failed to reject:', error);
    }
  }

  const statusBadge = {
    draft: 'badge-warning',
    approved: 'badge-success',
    rejected: 'badge-danger',
    posted: 'badge-info',
    edited: 'badge-info',
  }[post.status] || 'badge-gray';

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className={statusBadge}>{post.status}</span>
            {post.tone && <span className="text-xs text-gray-500">Ton: {post.tone}</span>}
          </div>
          {post.status === 'draft' && (
            <div className="flex items-center space-x-2">
              <button
                onClick={handleApprove}
                className="p-1 text-green-600 hover:bg-green-50 rounded"
                title="Approuver"
              >
                <ThumbsUp className="w-5 h-5" />
              </button>
              <button
                onClick={handleReject}
                className="p-1 text-red-600 hover:bg-red-50 rounded"
                title="Rejeter"
              >
                <ThumbsDown className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
        {post.article && (
          <a
            href={post.article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block text-sm text-gray-600 hover:text-primary-600"
          >
            <span className="font-medium">{post.article.source?.name}</span>:{' '}
            {post.article.title}
            <ExternalLink className="inline w-3 h-3 ml-1" />
          </a>
        )}
      </div>

      <div className="p-4">
        {/* Platform tabs */}
        <div className="flex border-b border-gray-200 mb-4">
          {(['twitter', 'mastodon', 'bluesky'] as const).map((platform) => (
            <button
              key={platform}
              onClick={() => setActiveTab(platform)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === platform
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {platform === 'twitter' ? 'X/Twitter' : platform.charAt(0).toUpperCase() + platform.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="relative">
          <div className="bg-gray-50 rounded-lg p-4 min-h-[120px]">
            <p className="text-sm text-gray-900 whitespace-pre-wrap">{content || 'Non disponible'}</p>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {content?.length || 0} / {charLimit} caractères
            </span>
            <CopyButton text={content || ''} />
          </div>
        </div>

        {/* Hashtags */}
        {post.hashtags && post.hashtags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {post.hashtags.map((tag) => (
              <span key={tag} className="text-xs text-primary-600">
                {tag.startsWith('#') ? tag : `#${tag}`}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  return (
    <button
      onClick={handleCopy}
      disabled={!text}
      className={`btn-secondary text-sm ${copied ? 'bg-green-50 text-green-600' : ''}`}
    >
      {copied ? (
        <>
          <Check className="w-4 h-4 mr-1" />
          Copié !
        </>
      ) : (
        <>
          <Copy className="w-4 h-4 mr-1" />
          Copier
        </>
      )}
    </button>
  );
}
