/**
 * FileReaderService.js
 * Comprehensive Multi-Format File Reader, Archive Extractor & Codebase Explorer
 *
 * Implements 7-step architecture:
 * 1. File ingestion (drag-drop / folder / archives)
 * 2. Type identification (extensions + magic bytes + null-byte binary check)
 * 3. Text extraction (Code, Text, Markdown, JSON, CSV, DOCX, XLSX, PPTX, PDF, ZIP)
 * 4. .gitignore engine + security skips (.env, passwords, binaries)
 * 5. Strict safety limits (Zip-bomb guard, 100MB archive, 200MB total, Groq 8000 TPM chunking)
 * 6. Read-Only On-Demand Query API (list_files, read_file, search_text)
 */

import JSZip from 'jszip';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import ignore from 'ignore';

// ── 1. Safety Limits & Token Optimization Constants ─────────────────
export const SAFETY_LIMITS = {
  MAX_ARCHIVE_BYTES: 100 * 1024 * 1024,      // 100 MB max archive size
  MAX_TOTAL_UNCOMPRESSED: 200 * 1024 * 1024, // 200 MB max total extracted bytes (zip-bomb guard)
  MAX_SINGLE_FILE_BYTES: 2 * 1024 * 1024,    // 2 MB max single text file size
  MAX_FILES_COUNT: 300,                      // 300 files maximum in indexed tree
  MAX_ARCHIVE_RECURSION: 3,                  // Max 3 levels of nested archives
  CHUNK_CHAR_SIZE: 2500                      // 2500 chars per chunk to protect Groq TPM limit
};

// Default ignored files & directories (applied if no .gitignore, and enforced for sensitive files)
export const DEFAULT_IGNORED_PATTERNS = [
  'node_modules/**',
  'node_modules',
  '.git/**',
  '.git',
  'dist/**',
  'dist',
  'build/**',
  'build',
  '.next/**',
  '.next',
  '__pycache__/**',
  '__pycache__',
  'venv/**',
  'venv',
  '.env',
  '.env.*',
  '*.env',
  '*.log',
  '*.lock',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  '.DS_Store',
  'Thumbs.db'
];

// Always skip sensitive files (security requirement)
export const SENSITIVE_PATTERNS = [
  '.env',
  '.env.local',
  '.env.production',
  'id_rsa',
  'id_ed25519',
  '*.pem',
  '*.key',
  'credentials.json'
];

// Common known code & text extensions
export const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'json', 'csv', 'tsv', 'xml', 'yaml', 'yml',
  'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
  'html', 'htm', 'css', 'scss', 'sass', 'less',
  'py', 'pyw', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go', 'rs', 'php', 'rb', 'swift', 'kt',
  'sh', 'bash', 'zsh', 'bat', 'cmd', 'ps1',
  'sql', 'graphql', 'gql', 'dockerfile', 'makefile', 'cmake', 'toml', 'ini', 'conf', 'cfg',
  'gitignore', 'gitattributes', 'gitmodules', 'dockerignore', 'env', 'example', 'lock', 'log',
  'properties', 'editorconfig', 'prettierrc', 'eslintrc', 'babelrc', 'npmrc', 'yarnrc',
  'proto', 'r', 'dart', 'lua', 'scala', 'vue', 'svelte', 'astro', 'prisma', 'sol'
]);

// ── 2. Type & Magic Bytes Detection ─────────────────────────────────
export function detectMagicBytes(uint8) {
  if (!uint8 || uint8.length < 4) return null;

  // PDF: %PDF (0x25, 0x50, 0x44, 0x46)
  if (uint8[0] === 0x25 && uint8[1] === 0x50 && uint8[2] === 0x44 && uint8[3] === 0x46) {
    return 'pdf';
  }

  // ZIP / DOCX / XLSX / PPTX: PK (0x50, 0x4B, 0x03, 0x04)
  if (uint8[0] === 0x50 && uint8[1] === 0x4B && (uint8[2] === 0x03 || uint8[2] === 0x05 || uint8[2] === 0x07)) {
    return 'zip_family';
  }

  // RAR: Rar! (0x52, 0x61, 0x72, 0x21)
  if (uint8[0] === 0x52 && uint8[1] === 0x61 && uint8[2] === 0x72 && uint8[3] === 0x21) {
    return 'rar';
  }

  // 7z: 7z (0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C)
  if (uint8[0] === 0x37 && uint8[1] === 0x7A && uint8[2] === 0xBC && uint8[3] === 0xAF) {
    return '7z';
  }

  // PNG: \x89PNG
  if (uint8[0] === 0x89 && uint8[1] === 0x50 && uint8[2] === 0x4E && uint8[3] === 0x47) {
    return 'png';
  }

  // JPEG: \xFF\xD8\xFF
  if (uint8[0] === 0xFF && uint8[1] === 0xD8 && uint8[2] === 0xFF) {
    return 'jpeg';
  }

  return null;
}

/**
 * Null-byte Binary Check (First 4KB scan)
 * If \0 byte is present, file is binary and should not be read as raw text.
 */
export function isBinaryBuffer(uint8, maxCheckBytes = 4096) {
  if (!uint8 || !uint8.length) return false;
  const len = Math.min(uint8.length, maxCheckBytes);
  for (let i = 0; i < len; i++) {
    if (uint8[i] === 0) return true;
  }
  return false;
}

/**
 * Inspect and extract structured metadata, strings, and instructions for binary files
 * Ensures binary models / checkpoints (e.g. .pt, .pth, .onnx, .pkl, .wasm) are never rejected.
 */
export function inspectBinaryFile(filename, uint8, size) {
  const parts = filename.split('.');
  const ext = (parts.length > 1 ? parts.pop() : filename.startsWith('.') ? filename.slice(1) : '').toLowerCase();
  const sizeKb = Math.round(size / 1024);
  const sizeMb = (size / (1024 * 1024)).toFixed(2);
  const displaySize = size > 1024 * 1024 ? `${sizeMb} MB` : `${sizeKb} KB`;

  let typeDescription = 'Binary Data File';
  let usageHint = '';

  if (['pt', 'pth'].includes(ext)) {
    typeDescription = 'PyTorch Model Checkpoint / Weights (.pt / YOLO / TorchScript)';
    usageHint = 'Trained neural network model weights in PyTorch format. Commonly loaded via `torch.load("path.pt")` or Ultralytics `YOLO("best.pt")` for object detection and inference.';
  } else if (ext === 'onnx') {
    typeDescription = 'ONNX (Open Neural Network Exchange) Model';
    usageHint = 'Cross-platform neural network model runnable with onnxruntime.';
  } else if (['pkl', 'pickle'].includes(ext)) {
    typeDescription = 'Python Pickle Serialized Object';
    usageHint = 'Serialized Python object, data pipeline, or scikit-learn model.';
  } else if (['h5', 'hdf5', 'keras'].includes(ext)) {
    typeDescription = 'Keras / HDF5 Model Weights';
    usageHint = 'Deep learning neural network weights for TensorFlow/Keras.';
  } else if (ext === 'safetensors') {
    typeDescription = 'Hugging Face SafeTensors Weights';
    usageHint = 'Safe, fast tensor weights without arbitrary code execution risk.';
  } else if (ext === 'tflite') {
    typeDescription = 'TensorFlow Lite Embedded Model';
    usageHint = 'Quantized model optimized for edge and mobile inference.';
  } else if (['sqlite', 'db', 'sqlite3'].includes(ext)) {
    typeDescription = 'SQLite Database';
    usageHint = 'Embedded relational database containing tables and structured records.';
  } else if (ext === 'wasm') {
    typeDescription = 'WebAssembly Binary Module';
    usageHint = 'Compiled WebAssembly bytecode.';
  } else if (['exe', 'dll', 'so', 'dylib', 'bin'].includes(ext)) {
    typeDescription = 'Compiled Binary / Library / Machine Code';
    usageHint = 'Native binary executable or dynamic shared library.';
  }

  // Scan first 4KB for readable ASCII strings (len >= 4)
  const printableStrings = [];
  let currentStr = '';
  const scanLimit = Math.min((uint8 && uint8.length) || 0, 4096);
  if (uint8) {
    for (let i = 0; i < scanLimit; i++) {
      const c = uint8[i];
      if (c >= 32 && c <= 126) {
        currentStr += String.fromCharCode(c);
      } else {
        if (currentStr.length >= 4 && /[a-zA-Z0-9]{3,}/.test(currentStr)) {
          printableStrings.push(currentStr);
        }
        currentStr = '';
      }
    }
    if (currentStr.length >= 4 && /[a-zA-Z0-9]{3,}/.test(currentStr)) {
      printableStrings.push(currentStr);
    }
  }
  const sampleStrings = printableStrings.slice(0, 10).join(', ');

  return `[Binary File Attached: ${filename}]
• File Type: ${typeDescription}
• File Size: ${displaySize} (${size.toLocaleString()} bytes)
• Status: Successfully attached and recognized by Devnexes AI.
${usageHint ? `• Description: ${usageHint}\n` : ''}${sampleStrings ? `• Embedded Header Identifiers: ${sampleStrings}\n` : ''}
[Guidance for Devnexes AI]:
The user attached this binary artifact (${filename}). Explain what this file is, its architecture, typical usage (e.g. YOLOv8/v5 or PyTorch inference), how to load and use it in code with code examples, and assist with their questions. Do NOT state that the file is missing or not attached.`;
}

/**
 * Determine high-level file kind
 */
export function classifyFileKind(filename, uint8) {
  const parts = filename.split('.');
  const ext = (parts.length > 1 ? parts.pop() : filename.startsWith('.') ? filename.slice(1) : '').toLowerCase();
  const magic = detectMagicBytes(uint8);

  if (ext === 'docx' || (magic === 'zip_family' && ext === 'docx')) return 'docx';
  if (ext === 'xlsx' || ext === 'xls' || (magic === 'zip_family' && ext === 'xlsx')) return 'xlsx';
  if (ext === 'pptx' || (magic === 'zip_family' && ext === 'pptx')) return 'pptx';
  if (ext === 'pdf' || magic === 'pdf') return 'pdf';
  if (magic === 'rar' || ext === 'rar') return 'rar';
  if (magic === '7z' || ext === '7z') return '7z';
  if (magic === 'zip_family' || ext === 'zip') return 'zip';
  if (['png', 'jpeg', 'jpg', 'webp', 'gif', 'bmp', 'svg'].includes(ext) || magic === 'png' || magic === 'jpeg') return 'image';

  if (TEXT_EXTENSIONS.has(ext)) return 'text';

  // Fallback: check if binary
  if (uint8 && isBinaryBuffer(uint8)) return 'binary';
  return 'text';
}

// ── 3. Lazy PDF.js Browser Loader ───────────────────────────────────
let pdfjsPromise = null;
export async function loadPdfJs() {
  if (typeof window === 'undefined') return null;
  if (window.pdfjsLib) return window.pdfjsLib;

  if (!pdfjsPromise) {
    pdfjsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          resolve(window.pdfjsLib);
        } else {
          reject(new Error('pdf.js library failed to initialize'));
        }
      };
      script.onerror = () => reject(new Error('Could not load pdf.js from CDN'));
      document.head.appendChild(script);
    });
  }
  return pdfjsPromise;
}

// ── 4. Content Extractors ───────────────────────────────────────────

/** Extract clean text from DOCX using mammoth */
export async function extractDocxText(arrayBuffer) {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer });
    return (result.value || '').trim();
  } catch (err) {
    throw new Error(`DOCX extraction failed: ${err.message}`);
  }
}

/** Extract tabular sheets from XLSX / XLS using SheetJS */
export function extractXlsxText(arrayBuffer) {
  try {
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheets = [];
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      if (csv && csv.trim()) {
        sheets.push(`--- Sheet: ${sheetName} ---\n${csv.trim()}`);
      }
    }
    return sheets.join('\n\n');
  } catch (err) {
    throw new Error(`XLSX extraction failed: ${err.message}`);
  }
}

/** Extract slides text from PPTX using JSZip XML parsing */
export async function extractPptxText(arrayBuffer) {
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const slideFiles = Object.keys(zip.files)
      .filter(f => /^ppt\/slides\/slide\d+\.xml$/i.test(f))
      .sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, '') || '0', 10);
        const numB = parseInt(b.replace(/\D/g, '') || '0', 10);
        return numA - numB;
      });

    const slideTexts = [];
    for (let i = 0; i < slideFiles.length; i++) {
      const xml = await zip.files[slideFiles[i]].async('text');
      const matches = [...xml.matchAll(/<a:t[^>]*>(.*?)<\/a:t>/gi)].map(m => m[1]);
      if (matches.length) {
        slideTexts.push(`--- Slide ${i + 1} ---\n${matches.join(' ')}`);
      }
    }
    return slideTexts.join('\n\n');
  } catch (err) {
    throw new Error(`PPTX extraction failed: ${err.message}`);
  }
}

/** Extract page-by-page text from PDF using PDF.js */
export async function extractPdfText(arrayBuffer, maxPages = 40) {
  try {
    const pdfjs = await loadPdfJs();
    if (!pdfjs) throw new Error('PDF viewer not available');

    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const pages = [];
    const totalPages = Math.min(pdf.numPages, maxPages);

    for (let i = 1; i <= totalPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      if (pageText.trim()) {
        pages.push(`--- Page ${i} of ${pdf.numPages} ---\n${pageText.trim()}`);
      }
    }
    if (pdf.numPages > maxPages) {
      pages.push(`... [Truncated: ${pdf.numPages - maxPages} additional pages omitted for token optimization]`);
    }
    return pages.join('\n\n');
  } catch (err) {
    throw new Error(`PDF extraction failed: ${err.message}`);
  }
}

// ── 5. .gitignore & Path Filtering Engine ────────────────────────────
export function createIgnoreFilter(gitignoreContents = []) {
  const ig = ignore();
  ig.add(DEFAULT_IGNORED_PATTERNS);

  for (const content of gitignoreContents) {
    if (content && typeof content === 'string') {
      const lines = content.split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#'));
      if (lines.length) {
        try {
          ig.add(lines);
        } catch { }
      }
    }
  }

  return {
    isIgnored: (path) => {
      // Normalize slashes
      const cleanPath = path.replace(/^[\\/]+/, '').replace(/\\/g, '/');
      const filename = cleanPath.split('/').pop();

      // Enforce strict security skips (.env, keys)
      if (SENSITIVE_PATTERNS.some(p => {
        if (p.startsWith('*.')) return filename.endsWith(p.slice(1));
        return filename === p;
      })) {
        return { ignored: true, reason: 'sensitive security file (.env/keys)' };
      }

      if (ig.ignores(cleanPath)) {
        return { ignored: true, reason: '.gitignore match' };
      }
      return { ignored: false };
    }
  };
}

// ── 6. Multi-Archive Recursive Extraction (ZIP, up to 3 levels) ──────
export async function extractZipArchive(
  arrayBuffer,
  currentDepth = 1,
  totalStats = { totalBytes: 0, fileCount: 0 }
) {
  if (currentDepth > SAFETY_LIMITS.MAX_ARCHIVE_RECURSION) {
    return { files: [], skipped: [{ path: 'nested-archive', reason: 'Maximum archive recursion depth (3) reached' }] };
  }

  const zip = await JSZip.loadAsync(arrayBuffer);
  const extractedFiles = [];
  const skippedFiles = [];

  for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) continue;

    // Check file count limit
    if (totalStats.fileCount >= SAFETY_LIMITS.MAX_FILES_COUNT) {
      skippedFiles.push({ path: relativePath, reason: `Exceeded max files count (${SAFETY_LIMITS.MAX_FILES_COUNT})` });
      break;
    }

    const uint8 = await zipEntry.async('uint8array');

    // Zip bomb detection
    totalStats.totalBytes += uint8.length;
    if (totalStats.totalBytes > SAFETY_LIMITS.MAX_TOTAL_UNCOMPRESSED) {
      skippedFiles.push({ path: relativePath, reason: 'Zip-bomb protection: uncompressed limit (200MB) exceeded' });
      break;
    }

    // Check if inner file is another zip archive
    const magic = detectMagicBytes(uint8);
    const isInnerZip = magic === 'zip_family' && relativePath.toLowerCase().endsWith('.zip');

    if (isInnerZip && currentDepth < SAFETY_LIMITS.MAX_ARCHIVE_RECURSION) {
      const nested = await extractZipArchive(uint8.buffer, currentDepth + 1, totalStats);
      for (const nf of nested.files) {
        extractedFiles.push({
          ...nf,
          path: `${relativePath}/${nf.path}`
        });
      }
      skippedFiles.push(...nested.skipped.map(s => ({ ...s, path: `${relativePath}/${s.path}` })));
    } else {
      totalStats.fileCount++;
      extractedFiles.push({
        path: relativePath,
        name: relativePath.split('/').pop(),
        size: uint8.length,
        uint8,
        isFromArchive: true
      });
    }
  }

  return { files: extractedFiles, skipped: skippedFiles };
}

// ── 7. Master Ingestion Pipeline ────────────────────────────────────
/**
 * Ingest Raw Browser Files (from Drag & Drop, File Input, or Folder Drop)
 * @param {File[]|FileList} fileList
 * @param {Function} onProgress
 * @returns {Promise<Object>} Workspace state with fileTree, index, skipped files
 */
export async function ingestWorkspaceFiles(fileList, onProgress = null) {
  const filesArray = Array.from(fileList || []);
  if (!filesArray.length) {
    return { files: [], tree: [], skipped: [], summary: 'No files provided' };
  }

  const rawEntries = [];
  const skipped = [];
  const totalStats = { totalBytes: 0, fileCount: 0 };
  const gitignoreContents = [];

  if (onProgress) onProgress({ status: 'reading', message: 'Reading uploaded files...' });

  // 1. Initial Pass: Read buffers and collect .gitignore files
  for (const file of filesArray) {
    const fullPath = file.webkitRelativePath || file.name;

    // Check individual archive limit
    if (file.size > SAFETY_LIMITS.MAX_ARCHIVE_BYTES) {
      skipped.push({ path: fullPath, reason: `File exceeds 100MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB)` });
      continue;
    }

    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    const magic = detectMagicBytes(uint8);
    const isZip = magic === 'zip_family' && (file.name.endsWith('.zip') || (file.type && file.type.includes('zip')));

    if (isZip) {
      if (onProgress) onProgress({ status: 'extracting', message: `Extracting archive: ${file.name}...` });
      try {
        const extracted = await extractZipArchive(arrayBuffer, 1, totalStats);
        rawEntries.push(...extracted.files.map(f => ({ ...f, isFromArchive: true })));
        skipped.push(...extracted.skipped);
      } catch (err) {
        skipped.push({ path: fullPath, reason: `Archive extraction failed: ${err.message}` });
      }
    } else {
      rawEntries.push({
        path: fullPath,
        name: file.name,
        size: file.size,
        uint8,
        isDirectUpload: true
      });
    }
  }

  // 2. Discover .gitignore files ONLY from archive extractions
  for (const entry of rawEntries) {
    if (entry.name === '.gitignore' && entry.isFromArchive) {
      try {
        const text = new TextDecoder('utf-8').decode(entry.uint8);
        gitignoreContents.push(text);
      } catch { }
    }
  }

  // 3. Create .gitignore filter
  const filter = createIgnoreFilter(gitignoreContents);

  // 4. Filter and Extract Content
  const processedFiles = [];

  for (let i = 0; i < rawEntries.length; i++) {
    const entry = rawEntries[i];
    const path = entry.path.replace(/\\/g, '/');

    // Check .gitignore & security filters ONLY for files extracted from an archive
    if (entry.isFromArchive) {
      const filterResult = filter.isIgnored(path);
      if (filterResult.ignored) {
        skipped.push({ path, reason: filterResult.reason });
        continue;
      }
    }

    // Classify file type
    const kind = classifyFileKind(entry.name, entry.uint8);

    // If it's an archive inside an archive that wasn't extracted
    if (entry.isFromArchive && (kind === 'rar' || kind === '7z')) {
      skipped.push({ path, reason: `Unsupported archive (${kind})` });
      continue;
    }

    // Archive file size guard: skip excessive single files inside an archive
    if (entry.isFromArchive && entry.size > SAFETY_LIMITS.MAX_SINGLE_FILE_BYTES) {
      skipped.push({ path, reason: `File exceeds 2MB limit (${(entry.size / 1024 / 1024).toFixed(1)} MB)` });
      continue;
    }

    if (onProgress) {
      onProgress({
        status: 'processing',
        message: `Processing (${i + 1}/${rawEntries.length}): ${entry.name}`,
        current: i + 1,
        total: rawEntries.length
      });
    }

    let extractedText = '';

    try {
      if (kind === 'text') {
        if (entry.size > SAFETY_LIMITS.MAX_SINGLE_FILE_BYTES) {
          const sliceBytes = entry.uint8.slice(0, SAFETY_LIMITS.MAX_SINGLE_FILE_BYTES);
          extractedText = new TextDecoder('utf-8', { fatal: false }).decode(sliceBytes) +
            `\n\n[Note: File is ${(entry.size / (1024 * 1024)).toFixed(1)} MB. Devnexes AI indexed the first 2 MB for fast processing.]`;
        } else {
          extractedText = new TextDecoder('utf-8', { fatal: false }).decode(entry.uint8);
        }
      } else if (kind === 'binary') {
        extractedText = inspectBinaryFile(entry.name, entry.uint8, entry.size);
      } else if (kind === 'docx') {
        extractedText = await extractDocxText(entry.uint8.buffer);
      } else if (kind === 'xlsx') {
        extractedText = extractXlsxText(entry.uint8.buffer);
      } else if (kind === 'pptx') {
        extractedText = await extractPptxText(entry.uint8.buffer);
      } else if (kind === 'pdf') {
        extractedText = await extractPdfText(entry.uint8.buffer);
      } else if (kind === 'image') {
        extractedText = `[Image Attached: ${entry.name} (${Math.round(entry.size / 1024)} KB)]`;
      } else {
        extractedText = inspectBinaryFile(entry.name, entry.uint8, entry.size);
      }
    } catch (err) {
      if (entry.isDirectUpload) {
        extractedText = `[File Attached: ${entry.name} (${Math.round(entry.size / 1024)} KB)]\n(Raw extraction warning: ${err.message})`;
      } else {
        skipped.push({ path, reason: `Extraction error: ${err.message}` });
        continue;
      }
    }

    // Prepare line count & character count
    const lineCount = extractedText ? extractedText.split('\n').length : 0;
    const charCount = extractedText ? extractedText.length : 0;

    processedFiles.push({
      id: `f_${Date.now()}_${i}`,
      path,
      name: entry.name,
      size: entry.size,
      kind,
      lineCount,
      charCount,
      content: extractedText,
      snippet: extractedText ? extractedText.slice(0, 150).replace(/\s+/g, ' ').trim() : ''
    });
  }

  // 5. Generate Compact Tree for Chatbot Token Efficiency
  const treeSummary = processedFiles.map(f => `${f.path} (${f.kind}, ${Math.round(f.size / 1024)} KB, ${f.lineCount} lines)`).join('\n');

  if (onProgress) onProgress({ status: 'done', message: `Indexed ${processedFiles.length} files successfully.` });

  return {
    files: processedFiles,
    treeText: treeSummary,
    skipped,
    stats: {
      totalIndexed: processedFiles.length,
      totalSkipped: skipped.length,
      totalBytes: processedFiles.reduce((acc, f) => acc + f.size, 0)
    }
  };
}

// ── 8. Read-Only On-Demand Query Engine (Chatbot Protection) ────────
/**
 * Creates a sandboxed reader object for the chatbot.
 * Strictly adheres to rule 6: "Sirf padho aur batao, edit nahi".
 */
export function createWorkspaceReader(indexedFiles = []) {
  const fileMap = new Map();
  for (const f of indexedFiles) {
    fileMap.set(f.path.toLowerCase(), f);
  }

  return {
    /**
     * List all indexed files in tree format
     */
    listFiles: () => {
      return indexedFiles.map(f => ({
        path: f.path,
        size: f.size,
        kind: f.kind,
        lineCount: f.lineCount
      }));
    },

    /**
     * Read a specific chunk of a file to avoid blowing the Groq 8000 TPM limit
     * @param {string} targetPath - Relative file path
     * @param {number} offset - Starting character offset (default: 0)
     * @param {number} length - Number of characters to read (default: CHUNK_CHAR_SIZE)
     */
    readFile: (targetPath, offset = 0, length = SAFETY_LIMITS.CHUNK_CHAR_SIZE) => {
      const cleanPath = (targetPath || '').replace(/^[\\/]+/, '').toLowerCase();
      const file = fileMap.get(cleanPath);

      if (!file) {
        // Try fuzzy basename match
        const found = indexedFiles.find(f => f.name.toLowerCase() === cleanPath || f.path.toLowerCase().endsWith(cleanPath));
        if (!found) {
          return { error: `File not found: "${targetPath}". Call list_files() to see available paths.` };
        }
        const chunk = found.content.slice(offset, offset + length);
        return {
          path: found.path,
          totalChars: found.charCount,
          offset,
          length: chunk.length,
          hasMore: offset + length < found.charCount,
          content: chunk
        };
      }

      const chunk = file.content.slice(offset, offset + length);
      return {
        path: file.path,
        totalChars: file.charCount,
        offset,
        length: chunk.length,
        hasMore: offset + length < file.charCount,
        content: chunk
      };
    },

    /**
     * Search text across all indexed files
     * @param {string} query
     * @param {number} maxResults
     */
    searchText: (query, maxResults = 10) => {
      if (!query || !query.trim()) return [];
      const q = query.toLowerCase();
      const results = [];

      for (const f of indexedFiles) {
        if (!f.content) continue;
        const lines = f.content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.toLowerCase().includes(q)) {
            results.push({
              path: f.path,
              lineNumber: i + 1,
              match: line.trim().slice(0, 200)
            });
            if (results.length >= maxResults) return results;
          }
        }
      }
      return results;
    }
  };
}
