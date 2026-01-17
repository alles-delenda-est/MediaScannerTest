-- Media Scanner Database Schema
-- Version: 1.0.0

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================
-- USERS & AUTHENTICATION
-- =========================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    avatar_url TEXT,
    provider VARCHAR(50) NOT NULL,
    provider_id VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(provider, provider_id)
);

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- =========================================
-- NEWS SOURCES
-- =========================================

CREATE TYPE source_type AS ENUM ('rss', 'twitter', 'mastodon', 'bluesky');
CREATE TYPE source_category AS ENUM ('national', 'regional', 'social');

CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    type source_type NOT NULL,
    category source_category NOT NULL,
    url TEXT NOT NULL,
    region VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    fetch_interval_minutes INT DEFAULT 60,
    last_fetched_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    error_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sources_type ON sources(type);
CREATE INDEX idx_sources_active ON sources(is_active);
CREATE INDEX idx_sources_slug ON sources(slug);

-- =========================================
-- ARTICLES
-- =========================================

CREATE TYPE article_status AS ENUM (
    'pending',
    'analyzing',
    'relevant',
    'irrelevant',
    'error'
);

CREATE TABLE articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
    external_id VARCHAR(500),
    url TEXT NOT NULL,
    url_hash VARCHAR(64) NOT NULL,
    title TEXT NOT NULL,
    lede TEXT,
    full_text TEXT,
    author VARCHAR(255),
    published_at TIMESTAMP WITH TIME ZONE,
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status article_status DEFAULT 'pending',
    relevance_score DECIMAL(3,2),
    relevance_reasoning TEXT,
    keywords TEXT[],
    categories TEXT[],
    potential_angle TEXT,
    analyzed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_url_hash UNIQUE (url_hash)
);

CREATE INDEX idx_articles_status ON articles(status);
CREATE INDEX idx_articles_source ON articles(source_id);
CREATE INDEX idx_articles_published ON articles(published_at DESC);
CREATE INDEX idx_articles_relevance ON articles(relevance_score DESC) WHERE status = 'relevant';
CREATE INDEX idx_articles_url_hash ON articles(url_hash);
CREATE INDEX idx_articles_created ON articles(created_at DESC);

-- =========================================
-- SOCIAL MEDIA POSTS (Scanned)
-- =========================================

CREATE TABLE social_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
    platform VARCHAR(50) NOT NULL,
    external_id VARCHAR(255) NOT NULL,
    author_handle VARCHAR(255),
    author_name VARCHAR(255),
    content TEXT NOT NULL,
    url TEXT,
    posted_at TIMESTAMP WITH TIME ZONE,
    likes_count INT DEFAULT 0,
    reposts_count INT DEFAULT 0,
    replies_count INT DEFAULT 0,
    status article_status DEFAULT 'pending',
    relevance_score DECIMAL(3,2),
    relevance_reasoning TEXT,
    linked_article_id UUID REFERENCES articles(id),
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    analyzed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(platform, external_id)
);

CREATE INDEX idx_social_posts_platform ON social_posts(platform);
CREATE INDEX idx_social_posts_status ON social_posts(status);
CREATE INDEX idx_social_posts_posted ON social_posts(posted_at DESC);

-- =========================================
-- GENERATED POSTS (For Social Media)
-- =========================================

CREATE TYPE generated_post_status AS ENUM (
    'draft',
    'approved',
    'edited',
    'posted',
    'rejected'
);

CREATE TABLE generated_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
    social_post_id UUID REFERENCES social_posts(id) ON DELETE CASCADE,
    content_twitter VARCHAR(280),
    content_mastodon VARCHAR(500),
    content_bluesky VARCHAR(300),
    content_long TEXT,
    tone VARCHAR(50),
    hashtags TEXT[],
    status generated_post_status DEFAULT 'draft',
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    edited_content TEXT,
    posted_to TEXT[],
    posted_at TIMESTAMP WITH TIME ZONE,
    external_post_ids JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT article_or_social CHECK (
        article_id IS NOT NULL OR social_post_id IS NOT NULL
    )
);

CREATE INDEX idx_generated_posts_status ON generated_posts(status);
CREATE INDEX idx_generated_posts_article ON generated_posts(article_id);
CREATE INDEX idx_generated_posts_created ON generated_posts(created_at DESC);

-- =========================================
-- DAILY SUMMARIES
-- =========================================

CREATE TABLE daily_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    summary_date DATE UNIQUE NOT NULL,
    total_articles_scanned INT DEFAULT 0,
    total_social_posts_scanned INT DEFAULT 0,
    relevant_articles_count INT DEFAULT 0,
    relevant_social_posts_count INT DEFAULT 0,
    posts_generated INT DEFAULT 0,
    summary_text TEXT,
    top_stories JSONB,
    scan_started_at TIMESTAMP WITH TIME ZONE,
    scan_completed_at TIMESTAMP WITH TIME ZONE,
    scan_duration_seconds INT,
    errors_count INT DEFAULT 0,
    error_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_daily_summaries_date ON daily_summaries(summary_date DESC);

-- =========================================
-- SCAN LOGS
-- =========================================

CREATE TYPE scan_type AS ENUM ('scheduled', 'manual', 'retry');
CREATE TYPE scan_status AS ENUM ('running', 'completed', 'failed', 'partial');

CREATE TABLE scan_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES sources(id) ON DELETE SET NULL,
    scan_type scan_type NOT NULL,
    status scan_status DEFAULT 'running',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    items_found INT DEFAULT 0,
    items_new INT DEFAULT 0,
    items_analyzed INT DEFAULT 0,
    items_relevant INT DEFAULT 0,
    error_message TEXT,
    error_stack TEXT,
    metadata JSONB
);

CREATE INDEX idx_scan_logs_source ON scan_logs(source_id);
CREATE INDEX idx_scan_logs_started ON scan_logs(started_at DESC);
CREATE INDEX idx_scan_logs_status ON scan_logs(status);

-- =========================================
-- USER PREFERENCES & SETTINGS
-- =========================================

CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    email_daily_summary BOOLEAN DEFAULT true,
    email_high_relevance_alerts BOOLEAN DEFAULT false,
    default_view VARCHAR(50) DEFAULT 'dashboard',
    items_per_page INT DEFAULT 20,
    theme VARCHAR(50) DEFAULT 'light',
    min_relevance_threshold DECIMAL(3,2) DEFAULT 0.60,
    preferred_regions TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================
-- API RATE LIMIT TRACKING
-- =========================================

CREATE TABLE api_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service VARCHAR(100) NOT NULL,
    endpoint VARCHAR(255),
    requests_made INT DEFAULT 0,
    requests_limit INT,
    window_start TIMESTAMP WITH TIME ZONE,
    window_end TIMESTAMP WITH TIME ZONE,
    last_request_at TIMESTAMP WITH TIME ZONE,
    reset_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(service, endpoint)
);

-- =========================================
-- HELPER FUNCTIONS
-- =========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sources_updated_at BEFORE UPDATE ON sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_articles_updated_at BEFORE UPDATE ON articles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_generated_posts_updated_at BEFORE UPDATE ON generated_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
