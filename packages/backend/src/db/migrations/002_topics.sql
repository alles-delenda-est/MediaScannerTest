-- Topics Feature Migration
-- Version: 1.1.0

-- =========================================
-- TOPICS CONFIGURATION
-- =========================================

CREATE TABLE topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    keywords TEXT[] NOT NULL DEFAULT '{}',
    ai_prompt TEXT NOT NULL,
    min_relevance_score DECIMAL(3,2) DEFAULT 0.50,
    is_active BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_topics_active ON topics(is_active);
CREATE INDEX idx_topics_slug ON topics(slug);

-- =========================================
-- ARTICLE-TOPIC RESULTS (Many-to-Many)
-- =========================================

CREATE TABLE article_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    relevance_score DECIMAL(3,2) NOT NULL,
    reasoning TEXT,
    potential_angle TEXT,
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(article_id, topic_id)
);

CREATE INDEX idx_article_topics_article ON article_topics(article_id);
CREATE INDEX idx_article_topics_topic ON article_topics(topic_id);
CREATE INDEX idx_article_topics_score ON article_topics(relevance_score DESC);

-- =========================================
-- TRIGGERS
-- =========================================

CREATE TRIGGER update_topics_updated_at BEFORE UPDATE ON topics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================================
-- SEED DEFAULT TOPIC
-- =========================================

INSERT INTO topics (name, slug, description, keywords, ai_prompt, min_relevance_score, is_active, is_system)
VALUES (
    'Absurdités Administratives',
    'absurdites-administratives',
    'Actualités mettant en évidence les excès bureaucratiques et les dysfonctionnements administratifs en France',
    ARRAY[
        'administration', 'administratif', 'bureaucratie', 'bureaucratique',
        'réglementation', 'règlement', 'paperasse', 'paperasserie',
        'formulaire', 'cerfa', 'norme', 'normes',
        'complexité', 'simplification', 'fonctionnaire', 'fonctionnaires',
        'service public', 'impôt', 'impôts', 'taxe', 'taxes',
        'dépense publique', 'dépenses publiques', 'gaspillage',
        'collectivité', 'collectivités', 'mairie', 'préfecture',
        'délai', 'délais', 'procédure', 'procédures', 'démarche', 'démarches',
        'absurde', 'aberrant', 'kafkaïen', 'ubuesque',
        'excès', 'excessif', 'lourdeur', 'contrainte',
        'autorisation', 'permis', 'agrément', 'habilitation'
    ],
    'Identifie les articles qui mettent en évidence des dysfonctionnements administratifs, des réglementations absurdes, des gaspillages d''argent public, ou des lourdeurs bureaucratiques affectant les citoyens ou entreprises françaises.

Critères de pertinence élevée (0.8-1.0):
- Exemples concrets d''absurdités réglementaires
- Gaspillage d''argent public documenté
- Procédures administratives kafkaïennes
- Contradictions entre administrations
- Normes excessives freinant l''activité économique

Critères de pertinence moyenne (0.5-0.79):
- Discussions générales sur la réforme de l''État
- Débats fiscaux sans exemple concret
- Annonces de simplification administrative

Critères de faible pertinence (0.0-0.49):
- Politique générale sans angle bureaucratique
- Actualités internationales
- Sport, culture, divertissement',
    0.50,
    true,
    true
);
