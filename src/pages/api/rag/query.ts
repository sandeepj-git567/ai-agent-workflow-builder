import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/db';
import { RAGRetriever } from '@/lib/rag/retriever';
import { LLMManager } from '@/lib/ai/providers';
import { PromptTemplateService } from '@/lib/ai/prompts/promptService';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const userId = (req.headers['x-hasura-user-id'] || req.headers['authorization']?.replace('Bearer ', '') || '') as string;
  if (!userId) {
    return res.status(401).json({ message: '401: Unauthorized — Authentication required' });
  }

  const body = req.body || {};
  const memberships = await db.getUserMemberships(userId);
  if (!memberships || memberships.length === 0) {
    return res.status(403).json({ message: '403: Forbidden — User does not belong to any organization' });
  }

  const orgId = body.org_id || memberships[0].org_id;

  const member = await db.getOrgMember(userId, orgId);
  if (!member) {
    return res.status(403).json({ message: `403: Forbidden — Access to organization ${orgId} denied` });
  }

  if (!body.query || typeof body.query !== 'string') {
    return res.status(400).json({ message: 'query string parameter is required' });
  }

  try {
    // 1. Retrieve relevant document chunks
    const retrievedChunks = await RAGRetriever.retrieve({
      orgId,
      query: body.query,
      topK: body.top_k ? Number(body.top_k) : 3,
      minScore: body.min_score ? Number(body.min_score) : 0.05,
    });

    // 2. Build Context String with Source Attribution
    const contextString = RAGRetriever.buildContext(retrievedChunks);

    // 3. Construct System & User Prompt with Prompt Injection Protections
    const systemPrompt = 'You are an enterprise AI RAG assistant. Answer the user question accurately based ONLY on the provided document context. Cite source document names when referencing facts. If the context does not contain the answer, state that clearly.';
    
    const userPromptTemplate = 'Question: {{user_query}}';

    const compiled = PromptTemplateService.compilePrompt({
      systemPrompt,
      userTemplate: userPromptTemplate,
      variables: { user_query: body.query },
      untrustedContext: contextString,
    });

    // 4. Invoke LLM Provider
    const llmResult = await LLMManager.generate({
      provider: body.provider || 'groq',
      model: body.model || 'llama-3.1-8b-instant',
      systemPrompt: compiled.systemPrompt,
      prompt: compiled.finalPrompt,
      temperature: body.temperature ?? 0.2,
    });

    // Extract citations
    const citations = retrievedChunks.map(c => ({
      chunk_id: c.chunk_id,
      document_id: c.document_id,
      document_name: c.document_name,
      relevance_score: Math.round(c.score * 100) / 100,
    }));

    return res.status(200).json({
      success: true,
      query: body.query,
      answer: llmResult.text,
      citations,
      sources: retrievedChunks,
      provider: llmResult.provider,
      model: llmResult.model,
      usage: llmResult.usage || {},
    });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
}
