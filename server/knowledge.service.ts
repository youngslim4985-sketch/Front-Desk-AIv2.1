import { withTenant } from './db';

export interface KnowledgeChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  pageNumber?: number;
  content: string;
  docTitle?: string;
  docCategory?: string;
  score?: number;
}

export function chunkText(
  text: string,
  title: string,
  docId: string
): KnowledgeChunk[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: KnowledgeChunk[] = [];

  let currentChunk = '';
  let chunkIndex = 0;

  for (let i = 0; i < sentences.length; i++) {
    currentChunk += sentences[i] + ' ';

    if (currentChunk.length > 400 || i === sentences.length - 1) {
      if (currentChunk.trim().length > 0) {
        chunks.push({
          id: `chunk-${docId}-${chunkIndex}`,
          documentId: docId,
          chunkIndex,
          pageNumber: Math.floor(chunkIndex / 2) + 1,
          content: currentChunk.trim(),
        });

        chunkIndex++;
        currentChunk = '';
      }
    }
  }

  return chunks;
}

export async function searchKnowledgeChunks(
  companyId: string,
  query: string,
  topK = 4
) {
  const result = await withTenant(companyId, async (client) => {
    return client.query(
      `select
         c.id,
         c.document_id as "documentId",
         c.chunk_index as "chunkIndex",
         c.page_number as "pageNumber",
         c.content,
         d.title as "docTitle",
         d.category as "docCategory"
       from frontdeskai.document_chunks c
       join frontdeskai.documents d
         on d.id = c.document_id
        and d.company_id = c.company_id
       where c.company_id = $1
         and d.status = 'indexed'`,
      [companyId]
    );
  });

  const queryTerms = query
    .toLowerCase()
    .split(/\W+/)
    .filter((term) => term.length > 2);

  const scored = result.rows.map((chunk) => {
    let score = 0;

    const contentLower = chunk.content.toLowerCase();
    const titleLower = (chunk.docTitle || '').toLowerCase();

    for (const term of queryTerms) {
      if (contentLower.includes(term)) score += 3;
      if (titleLower.includes(term)) score += 5;
    }

    return {
      ...chunk,
      score,
    };
  });

  scored.sort((a, b) => (b.score || 0) - (a.score || 0));

  return scored.slice(0, topK);
}
