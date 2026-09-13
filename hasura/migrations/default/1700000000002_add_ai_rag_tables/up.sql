-- ==============================================================================
-- AI Agent Workflow Builder — Vector & AI Architecture Migration
-- ==============================================================================

-- Enable vector extension for embeddings if available
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Documents table (RAG Ingestion)
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL DEFAULT 'text',
    source_url TEXT NULL,
    content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_org_id ON public.documents(org_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status);

-- 2. Document Chunks table
CREATE TABLE IF NOT EXISTS public.document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
    content TEXT NOT NULL,
    token_count INTEGER NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_org_id ON public.document_chunks(org_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON public.document_chunks(document_id);

-- 3. Document Embeddings table (Vector Storage)
CREATE TABLE IF NOT EXISTS public.document_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chunk_id UUID NOT NULL REFERENCES public.document_chunks(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL DEFAULT 'local',
    model VARCHAR(100) NOT NULL DEFAULT 'text-embedding-3-small',
    vector_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_org_id ON public.document_embeddings(org_id);
CREATE INDEX IF NOT EXISTS idx_document_embeddings_chunk_id ON public.document_embeddings(chunk_id);

-- 4. Prompt Templates table (Versioned Prompt Studio)
CREATE TABLE IF NOT EXISTS public.prompt_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    purpose VARCHAR(100) NOT NULL DEFAULT 'general',
    active_version INTEGER NOT NULL DEFAULT 1,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prompt_templates_org_id ON public.prompt_templates(org_id);

-- 5. Prompt Versions table
CREATE TABLE IF NOT EXISTS public.prompt_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.prompt_templates(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    version INTEGER NOT NULL CHECK (version >= 1),
    system_prompt TEXT NOT NULL,
    user_template TEXT NOT NULL,
    variables JSONB NOT NULL DEFAULT '[]'::jsonb,
    model VARCHAR(100) NULL,
    temperature NUMERIC(3, 2) NULL DEFAULT 0.3,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_template_version UNIQUE (template_id, version)
);

CREATE INDEX IF NOT EXISTS idx_prompt_versions_org_id ON public.prompt_versions(org_id);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_template_id ON public.prompt_versions(template_id);

-- 6. Agent Runs table
CREATE TABLE IF NOT EXISTS public.agent_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    workflow_run_id UUID NULL REFERENCES public.workflow_runs(id) ON DELETE SET NULL,
    user_request TEXT NOT NULL,
    intent VARCHAR(100) NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'planning', 'executing', 'waiting_for_approval', 'completed', 'failed')),
    plan JSONB NULL DEFAULT '{}'::jsonb,
    final_output JSONB NULL DEFAULT '{}'::jsonb,
    error TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_org_id ON public.agent_runs(org_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON public.agent_runs(status);

-- 7. Agent Steps table
CREATE TABLE IF NOT EXISTS public.agent_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_run_id UUID NOT NULL REFERENCES public.agent_runs(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL CHECK (step_number >= 0),
    action_type VARCHAR(100) NOT NULL,
    tool_name VARCHAR(100) NULL,
    tool_input JSONB NULL DEFAULT '{}'::jsonb,
    tool_output JSONB NULL DEFAULT '{}'::jsonb,
    thought TEXT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    error TEXT NULL,
    started_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_steps_agent_run_id ON public.agent_steps(agent_run_id);
CREATE INDEX IF NOT EXISTS idx_agent_steps_org_id ON public.agent_steps(org_id);

-- 8. Memories table
CREATE TABLE IF NOT EXISTS public.memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NULL,
    conversation_id UUID NULL,
    memory_type VARCHAR(50) NOT NULL DEFAULT 'short_term' CHECK (memory_type IN ('short_term', 'long_term', 'fact', 'preference')),
    key VARCHAR(255) NOT NULL,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    vector_data JSONB NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memories_org_id ON public.memories(org_id);
CREATE INDEX IF NOT EXISTS idx_memories_key ON public.memories(key);

-- 9. Audit Logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address VARCHAR(50) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id ON public.audit_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
