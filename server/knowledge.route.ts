import express from 'express';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import pool, { withTenant } from './db';
import { chunkText, searchKnowledgeChunks } from './knowledge.service';

const router = express.Router();

function hashApiKey(key: string) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

async function resolveCompany(apiKey: string) {
  const keyHash = hashApiKey(apiKey);

  const result = await pool.query(
    'select id, name from frontdeskai.companies where api_key_hash = $1',
    [keyHash]
  );

  return result.rows[0] || null;
}

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return null;
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

router.get('/api/knowledge/documents', async (req, res) => {
  const apiKey = req.header('x-api-key');

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing x-api-key header' });
  }

  try {
    const company = await resolveCompany(apiKey);

    if (!company) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const result = await withTenant(company.id, async (client) => {
      const docs = await client.query(
        `select
           id,
           company_id as "companyId",
           filename,
           title,
           category,
           file_size as "fileSize",
           summary,
           status,
           page_count as "pageCount",
           chunk_count as "chunkCount",
           created_at as "uploadedAt"
         from frontdeskai.documents
         where company_id = $1
         order by created_at desc`,
        [company.id]
      );

      const chunks = await client.query(
        `select
           id,
           document_id as "documentId",
           chunk_index as "chunkIndex",
           page_number as "pageNumber",
           content
         from frontdeskai.document_chunks
         where company_id = $1
         order by document_id, chunk_index`,
        [company.id]
      );

      return { docs: docs.rows, chunks: chunks.rows };
    });

    const documents = result.docs.map((doc) => ({
      ...doc,
      uploadedAt:
        doc.uploadedAt instanceof Date
          ? doc.uploadedAt.toISOString()
          : doc.uploadedAt,
      chunks: result.chunks.filter(
        (chunk) => chunk.documentId === doc.id
      ),
    }));

    res.json(documents);
  } catch (err) {
    console.error('GET /api/knowledge/documents failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/knowledge/upload', async (req, res) => {
  const apiKey = req.header('x-api-key');

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing x-api-key header' });
  }

  const {
    title,
    category = 'other',
    rawText,
    filename,
    fileSize,
  } = req.body;

  if (!title || typeof title !== 'string') {
    return res.status(400).json({ error: 'Document title is required' });
  }

  if (!rawText || typeof rawText !== 'string') {
    return res.status(400).json({ error: 'Document text is required' });
  }

  try {
    const company = await resolveCompany(apiKey);

    if (!company) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    let summary =
      `Operational knowledge document "${title}" containing company procedures and guidelines.`;

    const ai = getGeminiClient();

    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents:
            `Briefly summarize this document for an AI receptionist knowledge base in 2-3 sentences.\n\n` +
            `Title: ${title}\nCategory: ${category}\nText:\n${rawText.slice(0, 1500)}`,
        });

        if (response.text) {
          summary = response.text.trim();
        }
      } catch (err) {
        console.error('Gemini document summary failed:', err);
      }
    }

    const result = await withTenant(company.id, async (client) => {
      const documentResult = await client.query(
        `insert into frontdeskai.documents (
           company_id,
           filename,
           title,
           category,
           file_size,
           raw_text,
           summary,
           status
         )
         values ($1, $2, $3, $4, $5, $6, $7, 'processing')
         returning id, created_at`,
        [
          company.id,
          filename || `${title.toLowerCase().replace(/\s+/g, '_')}.pdf`,
          title.trim(),
          category,
          fileSize || null,
          rawText,
          summary,
        ]
      );

      const documentId = documentResult.rows[0].id;
      const chunks = chunkText(rawText, title, documentId);
      const pageCount = Math.max(1, Math.ceil(chunks.length / 2));

      for (const chunk of chunks) {
        await client.query(
          `insert into frontdeskai.document_chunks (
             id,
             document_id,
             company_id,
             chunk_index,
             page_number,
             content
           )
           values ($1, $2, $3, $4, $5, $6)`,
          [
            chunk.id,
            documentId,
            company.id,
            chunk.chunkIndex,
            chunk.pageNumber || null,
            chunk.content,
          ]
        );
      }

      await client.query(
        `update frontdeskai.documents
         set
           status = 'indexed',
           page_count = $2,
           chunk_count = $3
         where id = $1`,
        [documentId, pageCount, chunks.length]
      );

      return {
        id: documentId,
        companyId: company.id,
        filename:
          filename || `${title.toLowerCase().replace(/\s+/g, '_')}.pdf`,
        title: title.trim(),
        category,
        fileSize: fileSize || '',
        uploadedAt: documentResult.rows[0].created_at,
        status: 'indexed',
        pageCount,
        chunkCount: chunks.length,
        chunks,
        summary,
      };
    });

    res.status(201).json(result);
  } catch (err) {
    console.error('POST /api/knowledge/upload failed:', err);
    res.status(500).json({ error: 'Failed to ingest knowledge document' });
  }
});

router.post('/api/knowledge/search', async (req, res) => {
  const apiKey = req.header('x-api-key');

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing x-api-key header' });
  }

  const { query } = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    const company = await resolveCompany(apiKey);

    if (!company) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const chunks = await searchKnowledgeChunks(
      company.id,
      query,
      5
    );

    res.json({
      query,
      chunks,
    });
  } catch (err) {
    console.error('POST /api/knowledge/search failed:', err);
    res.status(500).json({ error: 'Knowledge search failed' });
  }
});

router.delete('/api/knowledge/documents/:id', async (req, res) => {
  const apiKey = req.header('x-api-key');

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing x-api-key header' });
  }

  try {
    const company = await resolveCompany(apiKey);

    if (!company) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const result = await withTenant(company.id, async (client) => {
      return client.query(
        `delete from frontdeskai.documents
         where id = $1
           and company_id = $2
         returning id`,
        [req.params.id, company.id]
      );
    });

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/knowledge/documents/:id failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
