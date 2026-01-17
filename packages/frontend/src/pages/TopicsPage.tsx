import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { RefreshCw, Plus, Pencil, Trash2, Tag, Check, X } from 'lucide-react';
import type { Topic, CreateTopicInput, UpdateTopicInput } from '@media-scanner/shared';

export default function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);

  useEffect(() => {
    loadTopics();
  }, []);

  async function loadTopics() {
    setLoading(true);
    try {
      const res = await api.get<{ data: Topic[] }>('/api/topics');
      setTopics(res.data.data);
    } catch (error) {
      console.error('Failed to load topics:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleActive(topic: Topic) {
    try {
      await api.post(`/api/topics/${topic.id}/toggle`);
      loadTopics();
    } catch (error) {
      console.error('Failed to toggle topic:', error);
    }
  }

  async function handleDelete(topic: Topic) {
    if (topic.isSystem) {
      alert('Impossible de supprimer un topic système');
      return;
    }

    if (!confirm(`Supprimer le topic "${topic.name}" ?`)) {
      return;
    }

    try {
      await api.delete(`/api/topics/${topic.id}`);
      loadTopics();
    } catch (error) {
      console.error('Failed to delete topic:', error);
    }
  }

  function handleEdit(topic: Topic) {
    setEditingTopic(topic);
    setShowForm(true);
  }

  function handleCreate() {
    setEditingTopic(null);
    setShowForm(true);
  }

  function handleFormClose() {
    setShowForm(false);
    setEditingTopic(null);
  }

  async function handleFormSubmit(data: CreateTopicInput | UpdateTopicInput) {
    try {
      if (editingTopic) {
        await api.patch(`/api/topics/${editingTopic.id}`, data);
      } else {
        await api.post('/api/topics', data);
      }
      handleFormClose();
      loadTopics();
    } catch (error) {
      console.error('Failed to save topic:', error);
      alert('Erreur lors de la sauvegarde');
    }
  }

  const activeTopics = topics.filter((t) => t.isActive);
  const inactiveTopics = topics.filter((t) => !t.isActive);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Topics</h1>
          <p className="mt-1 text-sm text-gray-500">
            {activeTopics.length} topic(s) actif(s) sur {topics.length}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <button onClick={() => loadTopics()} className="btn-secondary" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          <button onClick={handleCreate} className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Nouveau Topic
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : (
        <div className="space-y-8">
          {activeTopics.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Topics Actifs</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {activeTopics.map((topic) => (
                  <TopicCard
                    key={topic.id}
                    topic={topic}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggle={handleToggleActive}
                  />
                ))}
              </div>
            </div>
          )}

          {inactiveTopics.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-500 mb-4">Topics Inactifs</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {inactiveTopics.map((topic) => (
                  <TopicCard
                    key={topic.id}
                    topic={topic}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggle={handleToggleActive}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <TopicFormModal
          topic={editingTopic}
          onClose={handleFormClose}
          onSubmit={handleFormSubmit}
        />
      )}
    </div>
  );
}

interface TopicCardProps {
  topic: Topic;
  onEdit: (topic: Topic) => void;
  onDelete: (topic: Topic) => void;
  onToggle: (topic: Topic) => void;
}

function TopicCard({ topic, onEdit, onDelete, onToggle }: TopicCardProps) {
  return (
    <div className={`card p-4 ${!topic.isActive ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${topic.isActive ? 'bg-primary-100' : 'bg-gray-100'}`}>
            <Tag className={`w-5 h-5 ${topic.isActive ? 'text-primary-600' : 'text-gray-400'}`} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-medium text-gray-900">{topic.name}</h3>
              {topic.isSystem && (
                <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                  Système
                </span>
              )}
            </div>
            {topic.description && (
              <p className="mt-1 text-xs text-gray-500 line-clamp-2">{topic.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={() => onToggle(topic)}
            className={`p-1.5 rounded ${
              topic.isActive
                ? 'text-green-600 hover:bg-green-50'
                : 'text-gray-400 hover:bg-gray-50'
            }`}
            title={topic.isActive ? 'Désactiver' : 'Activer'}
          >
            {topic.isActive ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
          </button>
          <button
            onClick={() => onEdit(topic)}
            className="p-1.5 rounded text-gray-400 hover:bg-gray-50 hover:text-gray-600"
            title="Modifier"
          >
            <Pencil className="w-4 h-4" />
          </button>
          {!topic.isSystem && (
            <button
              onClick={() => onDelete(topic)}
              className="p-1.5 rounded text-gray-400 hover:bg-red-50 hover:text-red-600"
              title="Supprimer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Mots-clés:</span>
          <span className="text-gray-700">{topic.keywords.length}</span>
        </div>
        <div className="flex items-center justify-between text-xs mt-1">
          <span className="text-gray-500">Score minimum:</span>
          <span className="text-gray-700">{(topic.minRelevanceScore * 100).toFixed(0)}%</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {topic.keywords.slice(0, 5).map((keyword, i) => (
            <span
              key={i}
              className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
            >
              {keyword}
            </span>
          ))}
          {topic.keywords.length > 5 && (
            <span className="px-2 py-0.5 text-xs text-gray-400">
              +{topic.keywords.length - 5}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

interface TopicFormModalProps {
  topic: Topic | null;
  onClose: () => void;
  onSubmit: (data: CreateTopicInput | UpdateTopicInput) => void;
}

function TopicFormModal({ topic, onClose, onSubmit }: TopicFormModalProps) {
  const [name, setName] = useState(topic?.name || '');
  const [description, setDescription] = useState(topic?.description || '');
  const [keywords, setKeywords] = useState(topic?.keywords.join(', ') || '');
  const [aiPrompt, setAiPrompt] = useState(topic?.aiPrompt || '');
  const [minRelevanceScore, setMinRelevanceScore] = useState(
    topic?.minRelevanceScore?.toString() || '0.5'
  );
  const [isActive, setIsActive] = useState(topic?.isActive ?? true);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const keywordList = keywords
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length > 0);

    if (keywordList.length === 0) {
      alert('Veuillez entrer au moins un mot-clé');
      return;
    }

    const data: CreateTopicInput = {
      name,
      description: description || undefined,
      keywords: keywordList,
      aiPrompt,
      minRelevanceScore: parseFloat(minRelevanceScore),
      isActive,
    };

    onSubmit(data);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {topic ? 'Modifier le Topic' : 'Nouveau Topic'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input w-full"
              placeholder="Ex: Absurdités Administratives"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input w-full h-20"
              placeholder="Description optionnelle du topic"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mots-clés * (séparés par des virgules)
            </label>
            <textarea
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className="input w-full h-24"
              placeholder="administration, bureaucratie, réglementation, paperasse..."
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Ces mots-clés servent à pré-filtrer les articles avant l'analyse AI
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prompt AI * (critères d'évaluation)
            </label>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              className="input w-full h-40"
              placeholder="Identifie les articles qui mettent en évidence des dysfonctionnements administratifs..."
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Instructions pour l'IA pour évaluer la pertinence des articles
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Score minimum
              </label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={minRelevanceScore}
                onChange={(e) => setMinRelevanceScore(e.target.value)}
                className="input w-full"
              />
              <p className="mt-1 text-xs text-gray-500">
                Score de 0.0 à 1.0
              </p>
            </div>

            <div className="flex items-center pt-6">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="sr-only"
                />
                <div
                  className={`w-10 h-6 rounded-full transition-colors ${
                    isActive ? 'bg-primary-600' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`w-4 h-4 mt-1 rounded-full bg-white transition-transform ${
                      isActive ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </div>
                <span className="ml-3 text-sm text-gray-700">Actif</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="btn-secondary">
              Annuler
            </button>
            <button type="submit" className="btn-primary">
              {topic ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
