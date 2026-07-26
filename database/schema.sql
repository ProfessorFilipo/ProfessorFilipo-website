-- ============================================================
-- filipomor.com — Postgres schema (Neon)
-- No MySQL-style 767-byte index limit here, so the schema
-- stays simpler: no shortened VARCHAR lengths, no forced ascii
-- charset on locale columns.
-- ============================================================

-- Reusable function to auto-update "updated_at"
-- (Postgres has no native "ON UPDATE CURRENT_TIMESTAMP" like MySQL)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- admin_users — admin panel login
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

-- ------------------------------------------------------------
-- media — uploads (files live in Cloudflare R2; this table holds metadata)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    path VARCHAR(500) NOT NULL, -- R2 object key/path
    alt_text VARCHAR(255),
    mime_type VARCHAR(100) NOT NULL,
    uploaded_by INT REFERENCES admin_users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- pages — Home / About / Contact (bilingual: pt-BR and en-CA)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pages (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(100) NOT NULL,
    locale VARCHAR(5) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL, -- Markdown
    meta_description VARCHAR(320),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (slug, locale)
);
DROP TRIGGER IF EXISTS trg_pages_updated_at ON pages;
CREATE TRIGGER trg_pages_updated_at BEFORE UPDATE ON pages
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- research_projects — current research (bilingual)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS research_projects (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(150) NOT NULL,
    locale VARCHAR(5) NOT NULL,
    title VARCHAR(255) NOT NULL,
    summary VARCHAR(500),
    content TEXT NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (slug, locale)
);
DROP TRIGGER IF EXISTS trg_research_projects_updated_at ON research_projects;
CREATE TRIGGER trg_research_projects_updated_at BEFORE UPDATE ON research_projects
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- experience — industry track record (bilingual)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS experience (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(150) NOT NULL,
    locale VARCHAR(5) NOT NULL,
    organization VARCHAR(255) NOT NULL,
    role VARCHAR(255) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE, -- NULL = current
    description TEXT NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    UNIQUE (slug, locale)
);

-- ------------------------------------------------------------
-- courses — teaching, Portuguese only
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    institution VARCHAR(255) NOT NULL,
    term VARCHAR(20) NOT NULL, -- e.g. 2026/1
    description TEXT,
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- tools — teaching tools (architecture simulator, logic parsers) — bilingual
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tools (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(150) NOT NULL,
    locale VARCHAR(5) NOT NULL,
    title VARCHAR(255) NOT NULL,
    summary VARCHAR(500),
    documentation TEXT, -- Markdown (usage docs, not the technical README)
    repo_url VARCHAR(500),
    demo_url VARCHAR(500),
    tech_stack VARCHAR(100),
    category VARCHAR(100),
    display_order INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (slug, locale)
);
DROP TRIGGER IF EXISTS trg_tools_updated_at ON tools;
CREATE TRIGGER trg_tools_updated_at BEFORE UPDATE ON tools
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- blog_posts — native blog (free language choice per post)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS blog_posts (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(255) NOT NULL,
    locale VARCHAR(5) NOT NULL, -- this specific post's language
    title VARCHAR(255) NOT NULL,
    excerpt VARCHAR(500),
    content TEXT NOT NULL, -- Markdown + video shortcodes
    cover_image_id INT REFERENCES media(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (slug, locale)
);
DROP TRIGGER IF EXISTS trg_blog_posts_updated_at ON blog_posts;
CREATE TRIGGER trg_blog_posts_updated_at BEFORE UPDATE ON blog_posts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- tags + blog_post_tags — blog tags (relational)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS blog_post_tags (
    post_id INT NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
    tag_id INT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)
);

-- ------------------------------------------------------------
-- post_attachments — PDFs/slides attached to a post
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS post_attachments (
    id SERIAL PRIMARY KEY,
    post_id INT NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
    media_id INT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    label VARCHAR(255) NOT NULL,
    display_order INT NOT NULL DEFAULT 0
);

-- ------------------------------------------------------------
-- settings — general key/value configuration
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value TEXT
);

INSERT INTO settings (setting_key, setting_value) VALUES
    ('site_title', 'Filipo Novo Mór'),
    ('contact_email', 'ProfessorFilipo@gmail.com'),
    ('linkedin_url', 'https://www.linkedin.com/in/filipo/'),
    ('lattes_url', 'http://lattes.cnpq.br/0494251468857551')
ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;
