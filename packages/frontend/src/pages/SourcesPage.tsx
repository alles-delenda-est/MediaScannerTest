import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { Source } from '@media-scanner/shared';

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  useEffect(() => {
    loadSources();
  }, [categoryFilter]);

  async function loadSources() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter) params.set('category', categoryFilter);
      params.set('active', 'true');

      const res = await api.get<{ data: Source[] }>(`/api/sources?${params}`);
      setSources(res.data.data);
    } catch (error) {
      console.error('Failed to load sources:', error);
    } finally {
      setLoading(false);
    }
  }

  const nationalSources = sources.filter((s) => s.category === 'national');
  const regionalSources = sources.filter((s) => s.category === 'regional');
  const socialSources = sources.filter((s) => s.category === 'social');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sources</h1>
          <p className="mt-1 text-sm text-gray-500">
            {sources.length} sources actives configurées
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="input w-40"
          >
            <option value="">Toutes</option>
            <option value="national">Nationales</option>
            <option value="regional">Régionales</option>
            <option value="social">Réseaux sociaux</option>
          </select>
          <button onClick={() => loadSources()} className="btn-secondary" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : (
        <div className="space-y-8">
          {nationalSources.length > 0 && (
            <SourceSection title="Presse Nationale" sources={nationalSources} />
          )}
          {regionalSources.length > 0 && (
            <SourceSection title="Presse Régionale" sources={regionalSources} />
          )}
          {socialSources.length > 0 && (
            <SourceSection title="Réseaux Sociaux" sources={socialSources} />
          )}
        </div>
      )}
    </div>
  );
}

function SourceSection({ title, sources }: { title: string; sources: Source[] }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sources.map((source) => (
          <SourceCard key={source.id} source={source} />
        ))}
      </div>
    </div>
  );
}

function SourceCard({ source }: { source: Source }) {
  const hasError = source.errorCount > 0;
  const lastFetchedAgo = source.lastFetchedAt
    ? getTimeAgo(new Date(source.lastFetchedAt))
    : 'Jamais';

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            {source.isActive ? (
              hasError ? (
                <AlertCircle className="w-4 h-4 text-yellow-500" />
              ) : (
                <CheckCircle className="w-4 h-4 text-green-500" />
              )
            ) : (
              <XCircle className="w-4 h-4 text-gray-400" />
            )}
            <h3 className="text-sm font-medium text-gray-900 truncate">{source.name}</h3>
          </div>
          <p className="mt-1 text-xs text-gray-500">{source.type.toUpperCase()}</p>
          {source.region && (
            <p className="text-xs text-gray-400">{source.region}</p>
          )}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Dernier scan:</span>
          <span className={hasError ? 'text-yellow-600' : 'text-gray-700'}>
            {lastFetchedAgo}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs mt-1">
          <span className="text-gray-500">Intervalle:</span>
          <span className="text-gray-700">{source.fetchIntervalMinutes} min</span>
        </div>
        {hasError && (
          <div className="mt-2 text-xs text-yellow-600">
            {source.errorCount} erreur(s)
          </div>
        )}
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "À l'instant";
  if (diffMins < 60) return `${diffMins} min`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays} jour(s)`;
}
