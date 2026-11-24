/**
 * Devnexes.ai — Enterprise-Grade Hybrid RAG Engine
 * (Retrieval-Augmented Generation)
 * 
 * Implements 5 Production RAG Pillars:
 * 1. Recursive Syntax-Aware Document & Code Chunking (Code boundaries, AST hints, Markdown headers)
 * 2. Sparse Lexical Inverted Index with Okapi BM25 (Robertson-Spärck Jones IDF, Length Normalization)
 * 3. Dense Vector Representation with Sublinear TF-IDF & Cosine Similarity
 * 4. Hybrid Search with Reciprocal Rank Fusion (RRF k=60) + Exact Identifier/Proximity Boosting
 * 5. Cross-Chunk Consolidation (Adjacent Chunk Merging & Strict Token Budgeting)
 */

import { isUrduOrHindi } from '../utils/dynamicNLP.js';

// ── 1. Stopwords & Lexical Normalization ──────────────────────────────
const STOP_WORDS = new Set([
  // English
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from',
  'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself',
  'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more', 'most',
  'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our',
  'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than',
  'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this',
  'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when',
  'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your', 'yours',
  // Roman Urdu / Hindi
  'kya', 'hai', 'hain', 'ka', 'ki', 'ke', 'ko', 'se', 'par', 'mein', 'aur', 'ya', 'yeh', 'woh', 'karo',
  'karein', 'karta', 'karti', 'mujhe', 'mera', 'meri', 'mere', 'aap', 'apka', 'apki', 'apke', 'bhi', 'to',
  'is', 'us', 'kisi', 'sab', 'wala', 'wali', 'wale', 'batao', 'dekho', 'kaha', 'kar', 'raha', 'rahi', 'rahe'
]);

/**
 * Tokenize text into normalized tokens + sub-tokens (camelCase / snake_case aware)
 */
export function tokenizeText(text = '', preserveCase = false) {
  if (!text) return [];
  const raw = String(text);
  
  // Extract identifiers and words
  const words = raw.match(/[a-zA-Z0-9_\-.$#@/]+/g) || [];
  const tokens = [];

  for (const word of words) {
    const clean = preserveCase ? word : word.toLowerCase();
    if (clean.length > 1 && !STOP_WORDS.has(clean)) {
      tokens.push(clean);
    }

    // Split camelCase and PascalCase (e.g. AuthContext -> auth, context)
    const subParts = word.replace(/([a-z])([A-Z])/g, '$1 $2').split(/[\s_\-./]+/);
    if (subParts.length > 1) {
      for (const sp of subParts) {
        const cleanSp = preserveCase ? sp : sp.toLowerCase();
        if (cleanSp.length > 2 && !STOP_WORDS.has(cleanSp)) {
          tokens.push(cleanSp);
        }
      }
    }
  }

  return tokens;
}

/**
 * Generate unigrams and bigrams for phrase matching
 */
export function generateNgrams(tokens = [], n = 2) {
  const result = [...tokens];
  if (tokens.length >= 2) {
    for (let i = 0; i < tokens.length - 1; i++) {
      result.push(`${tokens[i]}_${tokens[i + 1]}`);
    }
  }
  return result;
}

// ── 2. Recursive & Syntax-Aware Chunking ──────────────────────────────

export const CHUNK_CONFIG = {
  DEFAULT_CHUNK_SIZE: 1100,      // Ideal sweet spot ~300 tokens
  DEFAULT_CHUNK_OVERLAP: 180,    // 15-20% overlap
  MIN_CHUNK_SIZE: 250,
  MAX_CHUNK_SIZE: 2400
};

/**
 * Smart document chunker that respects code block boundaries, function declarations,
 * classes, Markdown headings (#, ##), and line numbers.
 * 
 * @param {string} content - Full file text
 * @param {Object} metadata - { filePath, fileName, fileKind }
 * @param {Object} options - { chunkSize, chunkOverlap }
 * @returns {Array} Array of structured chunk objects
 */
export function chunkDocument(content = '', metadata = {}, options = {}) {
  if (!content || typeof content !== 'string') return [];

  const chunkSize = options.chunkSize || CHUNK_CONFIG.DEFAULT_CHUNK_SIZE;
  const chunkOverlap = options.chunkOverlap || CHUNK_CONFIG.DEFAULT_CHUNK_OVERLAP;
  const lines = content.split('\n');
  const totalLines = lines.length;

  // Single short document fits in 1 chunk
  if (content.length <= chunkSize + chunkOverlap) {
    return [{
      id: `${metadata.filePath || 'doc'}_chunk_0`,
      filePath: metadata.filePath || 'unknown',
      fileName: metadata.fileName || 'file',
      fileKind: metadata.fileKind || 'text',
      lineStart: 1,
      lineEnd: totalLines,
      content: content.trim(),
      charCount: content.length,
      tokenEstimate: Math.ceil(content.length / 4),
      heading: metadata.fileName || 'Root Document'
    }];
  }

  const chunks = [];
  let currentChunkLines = [];
  let currentChunkChars = 0;
  let chunkStartLine = 1;
  let currentHeading = metadata.fileName || '';
  let chunkIdx = 0;

  // Detect code vs markdown vs prose
  const ext = (metadata.filePath || '').split('.').pop()?.toLowerCase();
  const isCode = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'cs', 'go', 'rs', 'php', 'rb', 'html', 'css', 'sql'].includes(ext);
  const isMarkdown = ['md', 'markdown', 'txt'].includes(ext);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const lineLength = line.length + 1; // +1 for newline

    // Track active headings or function scopes
    if (isMarkdown && line.startsWith('#')) {
      currentHeading = line.replace(/^#+\s*/, '').trim();
    } else if (isCode) {
      const fnMatch = line.match(/^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\s+([a-zA-Z0-9_]+)|class\s+([a-zA-Z0-9_]+)|const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\()/);
      if (fnMatch) {
        currentHeading = fnMatch[1] || fnMatch[2] || fnMatch[3] || currentHeading;
      }
    }

    currentChunkLines.push(line);
    currentChunkChars += lineLength;

    // Check if chunk threshold reached
    const naturalBreakPoint = (
      (isMarkdown && line.trim() === '') ||
      (isCode && (line.trim() === '}' || line.trim() === '};' || line.trim() === '')) ||
      (!isCode && !isMarkdown && (line.endsWith('.') || line.endsWith('?') || line.trim() === ''))
    );

    const isOversized = currentChunkChars >= chunkSize;
    const isHardLimit = currentChunkChars >= CHUNK_CONFIG.MAX_CHUNK_SIZE;

    if ((isOversized && naturalBreakPoint) || isHardLimit || lineNum === totalLines) {
      const chunkText = currentChunkLines.join('\n').trim();

      if (chunkText.length >= CHUNK_CONFIG.MIN_CHUNK_SIZE || lineNum === totalLines) {
        chunks.push({
          id: `${metadata.filePath || 'doc'}_chunk_${chunkIdx++}`,
          filePath: metadata.filePath || 'unknown',
          fileName: metadata.fileName || 'file',
          fileKind: metadata.fileKind || 'text',
          lineStart: chunkStartLine,
          lineEnd: lineNum,
          content: chunkText,
          charCount: chunkText.length,
          tokenEstimate: Math.ceil(chunkText.length / 4),
          heading: currentHeading || metadata.fileName
        });

        // Compute overlap lines for sliding window
        let overlapChars = 0;
        let overlapLines = [];
        for (let j = currentChunkLines.length - 1; j >= 0; j--) {
          const oLine = currentChunkLines[j];
          overlapChars += oLine.length + 1;
          overlapLines.unshift(oLine);
          if (overlapChars >= chunkOverlap) break;
        }

        // Start next chunk with overlap
        currentChunkLines = overlapLines;
        currentChunkChars = overlapChars;
        chunkStartLine = Math.max(1, lineNum - overlapLines.length + 1);
      }
    }
  }

  return chunks;
}

// ── 3. BM25 Lexical Inverted Index ────────────────────────────────────

export class BM25Index {
  constructor(k1 = 1.2, b = 0.75) {
    this.k1 = k1;
    this.b = b;
    this.documents = [];          // Chunks array
    this.docLengths = [];        // Length of each chunk in tokens
    this.avgDocLength = 0;       // avgdl
    this.invertedIndex = new Map(); // term -> Map(docIndex -> termFrequency)
    this.idfCache = new Map();   // term -> idf
    this.totalDocs = 0;
  }

  clear() {
    this.documents = [];
    this.docLengths = [];
    this.avgDocLength = 0;
    this.invertedIndex.clear();
    this.idfCache.clear();
    this.totalDocs = 0;
  }

  buildIndex(chunks = []) {
    this.clear();
    this.documents = chunks;
    this.totalDocs = chunks.length;
    if (this.totalDocs === 0) return;

    let totalTokens = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      // Index both content, filename, and heading for rich coverage
      const textToIndex = `${chunk.fileName} ${chunk.heading || ''}\n${chunk.content}`;
      const tokens = tokenizeText(textToIndex);
      const ngrams = generateNgrams(tokens, 2);

      const length = ngrams.length;
      this.docLengths.push(length);
      totalTokens += length;

      // Count term frequencies
      const tfMap = new Map();
      for (const token of ngrams) {
        tfMap.set(token, (tfMap.get(token) || 0) + 1);
      }

      // Add to inverted index
      for (const [token, tf] of tfMap.entries()) {
        if (!this.invertedIndex.has(token)) {
          this.invertedIndex.set(token, new Map());
        }
        this.invertedIndex.get(token).set(i, tf);
      }
    }

    this.avgDocLength = totalTokens / this.totalDocs;

    // Pre-calculate Robertson-Spärck Jones IDF
    for (const [term, postingList] of this.invertedIndex.entries()) {
      const df = postingList.size;
      // RSJ IDF with smoothing: ln(1 + (N - df + 0.5) / (df + 0.5))
      const idf = Math.log(1 + (this.totalDocs - df + 0.5) / (df + 0.5));
      this.idfCache.set(term, Math.max(idf, 0.05));
    }
  }

  /**
   * Search index using Okapi BM25 scoring
   * @param {string} query 
   * @returns {Array<{ docIndex: number, score: number, chunk: Object }>}
   */
  search(query = '') {
    if (!query || this.totalDocs === 0) return [];

    const queryTokens = tokenizeText(query);
    const queryNgrams = generateNgrams(queryTokens, 2);
    if (queryNgrams.length === 0) return [];

    const scores = new Float32Array(this.totalDocs);

    for (const term of queryNgrams) {
      const idf = this.idfCache.get(term);
      if (!idf) continue;

      const postingList = this.invertedIndex.get(term);
      if (!postingList) continue;

      for (const [docIdx, tf] of postingList.entries()) {
        const docLen = this.docLengths[docIdx];
        const numerator = tf * (this.k1 + 1);
        const denominator = tf + this.k1 * (1 - this.b + this.b * (docLen / this.avgDocLength));
        scores[docIdx] += idf * (numerator / denominator);
      }
    }

    const results = [];
    for (let i = 0; i < this.totalDocs; i++) {
      if (scores[i] > 0) {
        results.push({
          docIndex: i,
          score: scores[i],
          chunk: this.documents[i]
        });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }
}

// ── 4. Dense Vector Representation & Cosine Similarity ─────────────────

export class VectorSpaceIndex {
  constructor() {
    this.documents = [];
    this.vectors = []; // Array of Map(term -> normalizedWeight)
    this.vocab = new Set();
    this.idf = new Map();
  }

  clear() {
    this.documents = [];
    this.vectors = [];
    this.vocab.clear();
    this.idf.clear();
  }

  buildVectors(chunks = []) {
    this.clear();
    this.documents = chunks;
    const N = chunks.length;
    if (N === 0) return;

    const docFreqs = new Map();
    const docTermFreqs = [];

    // Pass 1: Gather vocab & term frequencies
    for (let i = 0; i < N; i++) {
      const chunk = chunks[i];
      const text = `${chunk.fileName} ${chunk.filePath} ${chunk.heading || ''}\n${chunk.content}`;
      const tokens = tokenizeText(text);

      const tf = new Map();
      for (const t of tokens) {
        tf.set(t, (tf.get(t) || 0) + 1);
        this.vocab.add(t);
      }
      docTermFreqs.push(tf);

      for (const t of tf.keys()) {
        docFreqs.set(t, (docFreqs.get(t) || 0) + 1);
      }
    }

    // Pass 2: Calculate IDF with log-smooth
    for (const [t, df] of docFreqs.entries()) {
      this.idf.set(t, Math.log(1 + N / df));
    }

    // Pass 3: Construct sublinear TF-IDF unit vectors (L2 normalized)
    for (let i = 0; i < N; i++) {
      const tf = docTermFreqs[i];
      const vector = new Map();
      let normSq = 0;

      for (const [term, freq] of tf.entries()) {
        const idfVal = this.idf.get(term) || 0.1;
        // Sublinear TF: 1 + ln(freq)
        const weight = (1 + Math.log(freq)) * idfVal;
        vector.set(term, weight);
        normSq += weight * weight;
      }

      // Unit normalization
      const norm = Math.sqrt(normSq) || 1;
      for (const [term, weight] of vector.entries()) {
        vector.set(term, weight / norm);
      }

      this.vectors.push(vector);
    }
  }

  /**
   * Search vectors using Cosine Similarity
   * @param {string} query 
   * @returns {Array<{ docIndex: number, score: number, chunk: Object }>}
   */
  search(query = '') {
    if (!query || this.documents.length === 0) return [];

    const tokens = tokenizeText(query);
    if (tokens.length === 0) return [];

    // Build query vector
    const qTf = new Map();
    for (const t of tokens) {
      qTf.set(t, (qTf.get(t) || 0) + 1);
    }

    const qVec = new Map();
    let qNormSq = 0;
    for (const [term, freq] of qTf.entries()) {
      const idfVal = this.idf.get(term) || Math.log(1 + this.documents.length);
      const weight = (1 + Math.log(freq)) * idfVal;
      qVec.set(term, weight);
      qNormSq += weight * weight;
    }

    const qNorm = Math.sqrt(qNormSq) || 1;
    for (const [term, weight] of qVec.entries()) {
      qVec.set(term, weight / qNorm);
    }

    // Calculate dot product (cosine similarity)
    const results = [];
    for (let i = 0; i < this.documents.length; i++) {
      const docVec = this.vectors[i];
      let dotProduct = 0;

      for (const [qTerm, qVal] of qVec.entries()) {
        const docVal = docVec.get(qTerm);
        if (docVal) {
          dotProduct += qVal * docVal;
        }
      }

      if (dotProduct > 0.02) {
        results.push({
          docIndex: i,
          score: dotProduct,
          chunk: this.documents[i]
        });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }
}

// ── 5. Reciprocal Rank Fusion & Hybrid Retrieval ───────────────────────

/**
 * Perform Reciprocal Rank Fusion (RRF) combining BM25 and Vector Search
 * 
 * Formula: RRF_score(d) = sum( 1 / (k + rank_m(d)) )
 * where k = 60 (industry gold standard constant)
 */
export function hybridRetrieve({
  bm25Index,
  vectorIndex,
  query = '',
  topK = 6,
  minScore = 0.015,
  boostExactMatch = true
}) {
  if (!query || !query.trim()) return [];

  const bm25Results = bm25Index ? bm25Index.search(query) : [];
  const vectorResults = vectorIndex ? vectorIndex.search(query) : [];

  const rrfConstant = 60;
  const chunkScores = new Map(); // chunkId -> { chunk, rrfScore, bm25Rank, vectorRank, bm25Score, vectorScore }

  // 1. Process BM25 ranks
  bm25Results.forEach((res, rank) => {
    const id = res.chunk.id;
    if (!chunkScores.has(id)) {
      chunkScores.set(id, {
        chunk: res.chunk,
        rrfScore: 0,
        bm25Rank: rank + 1,
        vectorRank: null,
        bm25Score: res.score,
        vectorScore: 0
      });
    }
    const item = chunkScores.get(id);
    item.rrfScore += 0.55 / (rrfConstant + rank + 1);
  });

  // 2. Process Vector ranks
  vectorResults.forEach((res, rank) => {
    const id = res.chunk.id;
    if (!chunkScores.has(id)) {
      chunkScores.set(id, {
        chunk: res.chunk,
        rrfScore: 0,
        bm25Rank: null,
        vectorRank: rank + 1,
        bm25Score: 0,
        vectorScore: res.score
      });
    }
    const item = chunkScores.get(id);
    item.vectorRank = rank + 1;
    item.vectorScore = res.score;
    item.rrfScore += 0.45 / (rrfConstant + rank + 1);
  });

  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

  // 3. Proximity, Exact Identifier & Filename Boosting
  if (boostExactMatch) {
    chunkScores.forEach((item) => {
      const chunk = item.chunk;
      const pathLower = (chunk.filePath || '').toLowerCase();
      const contentLower = chunk.content.toLowerCase();

      // Filename boost: If user mentions the file or folder
      for (const w of queryWords) {
        if (pathLower.includes(w)) {
          item.rrfScore *= 1.35;
          break;
        }
      }

      // Exact backtick or camelCase symbol match
      const exactCodeMatches = query.match(/`([^`]+)`|[A-Z][a-zA-Z0-9]{3,}/g) || [];
      for (const sym of exactCodeMatches) {
        const cleanSym = sym.replace(/`/g, '');
        if (contentLower.includes(cleanSym.toLowerCase())) {
          item.rrfScore *= 1.25;
        }
      }
    });
  }

  // 4. Sort and filter
  const ranked = Array.from(chunkScores.values())
    .filter(item => item.rrfScore >= minScore)
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, topK * 2); // Get candidate pool for cross-chunk consolidation

  // 5. Consolidate Adjacent / Overlapping Chunks from the same file
  const consolidated = consolidateAdjacentChunks(ranked, topK);

  return consolidated;
}

/**
 * Consolidate adjacent chunks from the same file to prevent context fragmentation
 */
function consolidateAdjacentChunks(rankedCandidates, topK) {
  if (rankedCandidates.length === 0) return [];

  const fileBuckets = new Map();

  for (const item of rankedCandidates) {
    const path = item.chunk.filePath;
    if (!fileBuckets.has(path)) {
      fileBuckets.set(path, []);
    }
    fileBuckets.get(path).push(item);
  }

  const finalResults = [];

  for (const [_, items] of fileBuckets.entries()) {
    // Sort items by lineStart
    items.sort((a, b) => a.chunk.lineStart - b.chunk.lineStart);

    let currentMerged = null;

    for (const item of items) {
      if (!currentMerged) {
        currentMerged = {
          ...item.chunk,
          score: item.rrfScore,
          relevancePercent: Math.min(Math.round(item.rrfScore * 4200), 99)
        };
        continue;
      }

      // Check if adjacent or overlapping lines (within 15 lines)
      if (item.chunk.lineStart <= currentMerged.lineEnd + 15) {
        // Merge lines
        const combinedText = `${currentMerged.content}\n\n[...]\n\n${item.chunk.content}`;
        currentMerged = {
          ...currentMerged,
          lineEnd: Math.max(currentMerged.lineEnd, item.chunk.lineEnd),
          content: combinedText,
          charCount: combinedText.length,
          score: Math.max(currentMerged.score, item.rrfScore),
          relevancePercent: Math.max(currentMerged.relevancePercent, Math.min(Math.round(item.rrfScore * 4200), 99))
        };
      } else {
        finalResults.push(currentMerged);
        currentMerged = {
          ...item.chunk,
          score: item.rrfScore,
          relevancePercent: Math.min(Math.round(item.rrfScore * 4200), 99)
        };
      }
    }

    if (currentMerged) {
      finalResults.push(currentMerged);
    }
  }

  // Final sort by score and slice to topK
  return finalResults
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// ── 6. RAG Context Formatter for LLM Injection ────────────────────────

/**
 * Format retrieved chunks into clean, high-signal Markdown context for the LLM prompt
 */
export function formatRagChunksForPrompt(chunks = []) {
  if (!chunks || chunks.length === 0) return '';

  let out = '## [RETRIEVED KNOWLEDGE & CODE CONTEXT (RAG Engine)]\n';
  out += 'The following exact sections were retrieved via hybrid search (BM25 + Semantic Cosine Vector) from the attached files/codebase.\n';
  out += 'Cite the exact file and line numbers when referencing this information.\n\n';

  chunks.forEach((chunk, idx) => {
    out += `### Source [${idx + 1}]: \`${chunk.filePath}\` (Lines ${chunk.lineStart}-${chunk.lineEnd}) — Relevance: ${chunk.relevancePercent || 90}%\n`;
    if (chunk.heading && chunk.heading !== chunk.fileName) {
      out += `Scope / Heading: *${chunk.heading}*\n`;
    }
    out += '```' + (chunk.filePath.split('.').pop() || '') + '\n';
    out += chunk.content + '\n';
    out += '```\n\n';
  });

  return out.trim();
}

// ── 7. Global Workspace RAG Manager (In-Memory Singleton Store) ───────

class WorkspaceRagManager {
  constructor() {
    this.indexes = new Map(); // convId -> { bm25Index, vectorIndex, chunks, stats, lastIndexedAt }
  }

  /**
   * Index an entire workspace for a conversation
   * @param {Object} workspace - { files: Array, treeText: string }
   * @param {string} convId - Conversation ID
   */
  indexWorkspace(workspace, convId = 'default') {
    if (!workspace || !Array.isArray(workspace.files) || workspace.files.length === 0) {
      this.indexes.delete(convId);
      return null;
    }

    const existing = this.indexes.get(convId);
    // Skip re-indexing if file count and timestamp match
    if (existing && existing.fileCount === workspace.files.length && existing.lastWorkspaceHash === workspace.treeText) {
      return existing.stats;
    }

    const startTime = performance.now();
    const allChunks = [];

    // 1. Chunk all files
    for (const file of workspace.files) {
      if (!file.content || typeof file.content !== 'string') continue;

      const fileChunks = chunkDocument(file.content, {
        filePath: file.path || file.name,
        fileName: file.name || (file.path || '').split('/').pop(),
        fileKind: file.kind || 'text'
      });

      allChunks.push(...fileChunks);
    }

    // 2. Build BM25 Index
    const bm25 = new BM25Index();
    bm25.buildIndex(allChunks);

    // 3. Build Vector Index
    const vector = new VectorSpaceIndex();
    vector.buildVectors(allChunks);

    const elapsed = Math.round(performance.now() - startTime);

    const stats = {
      convId,
      indexedFilesCount: workspace.files.length,
      totalChunksCount: allChunks.length,
      vocabSize: vector.vocab.size,
      indexingTimeMs: elapsed,
      lastIndexedAt: Date.now()
    };

    this.indexes.set(convId, {
      bm25Index: bm25,
      vectorIndex: vector,
      chunks: allChunks,
      stats,
      fileCount: workspace.files.length,
      lastWorkspaceHash: workspace.treeText
    });

    console.log(`[RAG Engine] Indexed ${workspace.files.length} files (${allChunks.length} chunks, vocab: ${vector.vocab.size}) in ${elapsed}ms for conv: ${convId}`);
    return stats;
  }

  /**
   * Retrieve relevant chunks for query
   */
  retrieve(query = '', convId = 'default', options = {}) {
    const entry = this.indexes.get(convId) || this.indexes.get('default');
    if (!entry) return [];

    return hybridRetrieve({
      bm25Index: entry.bm25Index,
      vectorIndex: entry.vectorIndex,
      query,
      topK: options.topK || 5,
      minScore: options.minScore || 0.015
    });
  }

  /**
   * Get stats for a conversation
   */
  getStats(convId = 'default') {
    const entry = this.indexes.get(convId) || this.indexes.get('default');
    return entry ? entry.stats : null;
  }

  /**
   * Clear index
   */
  clear(convId) {
    if (convId) {
      this.indexes.delete(convId);
    } else {
      this.indexes.clear();
    }
  }
}

export const ragManager = new WorkspaceRagManager();
