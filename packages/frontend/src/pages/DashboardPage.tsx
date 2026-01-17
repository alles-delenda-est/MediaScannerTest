import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Newspaper, MessageSquare, TrendingUp, Clock } from 'lucide-react';
import type { DashboardStats, ArticleWithSource } from '@media-scanner/shared';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [topStories, setTopStories] = useState<ArticleWithSource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const [statsRes, storiesRes] = await Promise.all([
        api.get<{ data: DashboardStats }>('/api/dashboard/stats'),
        api.get<{ data: ArticleWithSource[] }>('/api/dashboard/top-stories?limit=5'),
      ]);
      setStats(statsRes.data.data);
      setTopStories(storiesRes.data.data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="mt-1 text-sm text-gray-500">
          Vue d'ensemble de votre veille médiatique
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Articles aujourd'hui"
          value={stats?.today.articles || 0}
          icon={Newspaper}
          color="blue"
        />
        <StatCard
          title="Articles pertinents"
          value={stats?.today.relevant || 0}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          title="Posts générés"
          value={stats?.today.postsGenerated || 0}
          icon={MessageSquare}
          color="purple"
        />
        <StatCard
          title="Cette semaine"
          value={stats?.week.articles || 0}
          subtext={`${stats?.week.relevant || 0} pertinents`}
          icon={Clock}
          color="orange"
        />
      </div>

      {/* Top stories */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">Top histoires récentes</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {topStories.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              Aucune histoire pertinente trouvée récemment
            </div>
          ) : (
            topStories.map((article) => (
              <div key={article.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-gray-900 hover:text-primary-600"
                    >
                      {article.title}
                    </a>
                    <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                      {article.lede}
                    </p>
                    <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                      <span>{article.source?.name}</span>
                      {article.categories?.slice(0, 2).map((cat) => (
                        <span key={cat} className="badge-info">{cat}</span>
                      ))}
                    </div>
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    <RelevanceScore score={article.relevanceScore || 0} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtext,
  icon: Icon,
  color,
}: {
  title: string;
  value: number;
  subtext?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'purple' | 'orange';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="card p-6">
      <div className="flex items-center">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
          {subtext && <p className="text-xs text-gray-500">{subtext}</p>}
        </div>
      </div>
    </div>
  );
}

function RelevanceScore({ score }: { score: number }) {
  const percentage = Math.round(score * 100);
  const colorClass =
    score >= 0.8 ? 'text-green-600' : score >= 0.6 ? 'text-yellow-600' : 'text-gray-500';

  return (
    <div className={`text-right ${colorClass}`}>
      <div className="text-lg font-bold">{percentage}%</div>
      <div className="text-xs">pertinence</div>
    </div>
  );
}
