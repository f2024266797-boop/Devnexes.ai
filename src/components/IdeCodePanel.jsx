import React, { useState, useRef, useEffect } from 'react';
import { 
  Copy, 
  Check, 
  FileCode, 
  Download, 
  X, 
  Code2, 
  Eye, 
  Maximize2
} from 'lucide-react';

/**
 * Devnexes AI Enhanced Code Canvas & Document Workbench
 * Feature-rich IDE panel with multi-mode tabs (Code / Live Preview),
 * real-time line counters, file export/download, syntax gutter, and status bar.
 */
export default function IdeCodePanel({ 
  isOpen, 
  onClose, 
  code, 
  title, 
  language, 
  onOpenPreview 
}) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('code'); // 'code' | 'preview'
  const editorRef = useRef(null);

  // Clean raw code: remove markdown code fence tags (e.g. ```cpp ... ```) for pure source display
  const cleanCode = (code || '')
    .replace(/^```[a-z0-9_]*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();

  // Auto-scroll to bottom live as LLM streams code tokens in real-time
  useEffect(() => {
    if (editorRef.current && activeTab === 'code') {
      editorRef.current.scrollTop = editorRef.current.scrollHeight;
    }
  }, [cleanCode, activeTab]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!cleanCode) return;
    navigator.clipboard.writeText(cleanCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!cleanCode) return;
    const blob = new Blob([cleanCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const langTag = (language || 'code').toLowerCase();
  const isWebPreviewable = langTag === 'html' || langTag === 'htm' || (cleanCode && (cleanCode.includes('<!DOCTYPE') || cleanCode.includes('<html')));

  const extMap = { 
    cpp: '.cpp', 
    python: '.py', 
    javascript: '.js', 
    typescript: '.ts',
    jsx: '.jsx',
    tsx: '.tsx',
    html: '.html', 
    css: '.css', 
    java: '.java', 
    sql: '.sql',
    json: '.json',
    markdown: '.md'
  };
  const fileExt = extMap[langTag] || `.${langTag}`;
  const fileName = (title || 'main_canvas').toLowerCase().replace(/[^a-z0-9]/g, '_') + fileExt;

  const lines = cleanCode ? cleanCode.split('\n') : [];
  const lineCount = lines.length;
  const byteSize = new Blob([cleanCode]).size;
  const formattedSize = byteSize > 1024 ? `${(byteSize / 1024).toFixed(1)} KB` : `${byteSize} B`;

  return (
    <div className="fixed inset-0 z-50 lg:relative lg:inset-auto lg:z-20 lg:w-1/2 xl:w-7/12 flex-1 h-full bg-[#f8fafc] dark:bg-[#0c101b] border-l border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden select-none transition-all duration-300 animate-fade-in shadow-2xl lg:shadow-none font-sans">
      
      {/* ── Top Bar / Tab Strip ─────────────────────────────────── */}
      <div className="h-11 sm:h-12 px-2.5 sm:px-4 bg-[#f1f5f9] dark:bg-[#080a0f] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
        
        {/* Left: File Tab & View Switcher */}
        <div className="flex items-center space-x-1 sm:space-x-2 truncate pr-2">
          
          {/* Active File Pill */}
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-[#0f1422] border border-slate-200/90 dark:border-slate-700/70 text-[11px] sm:text-xs font-mono text-slate-800 dark:text-slate-100 shadow-2xs truncate">
            <FileCode size={13} className="text-[#0066FF] shrink-0" />
            <span className="font-semibold truncate max-w-[110px] sm:max-w-[180px]">{fileName}</span>
            <span className="text-[9.5px] px-1 py-0.2 rounded bg-blue-50 dark:bg-blue-950/80 text-[#0066FF] dark:text-blue-400 font-bold uppercase font-sans shrink-0">
              {langTag}
            </span>
          </div>

          {/* Code vs Live Preview Mode Switcher (if HTML/Web) */}
          {isWebPreviewable && (
            <div className="flex items-center bg-slate-200/70 dark:bg-slate-800/70 p-0.5 rounded-lg text-[11px] sm:text-xs font-sans">
              <button
                onClick={() => setActiveTab('code')}
                className={`flex items-center space-x-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md transition-all cursor-pointer ${
                  activeTab === 'code'
                    ? 'bg-white dark:bg-slate-900 text-[#0066FF] dark:text-blue-400 font-semibold shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Code2 size={11} />
                <span className="hidden sm:inline">Code</span>
              </button>
              <button
                onClick={() => setActiveTab('preview')}
                className={`flex items-center space-x-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md transition-all cursor-pointer ${
                  activeTab === 'preview'
                    ? 'bg-white dark:bg-slate-900 text-[#0066FF] dark:text-blue-400 font-semibold shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Eye size={11} />
                <span className="hidden sm:inline">Preview</span>
              </button>
            </div>
          )}
        </div>

        {/* Right: Actions Toolbar */}
        <div className="flex items-center space-x-1 shrink-0">
          
          {/* Fullscreen Live Preview Modal Trigger */}
          {isWebPreviewable && onOpenPreview && (
            <button
              onClick={() => onOpenPreview(cleanCode, title)}
              className="p-1 sm:px-2 sm:py-0.5 rounded-md bg-[#0066FF] hover:bg-blue-700 active:scale-95 text-white text-[11px] font-medium transition-all shadow-xs flex items-center space-x-1 cursor-pointer"
              title="Open Fullscreen Preview"
            >
              <Maximize2 size={12} />
              <span className="hidden md:inline">Fullscreen</span>
            </button>
          )}

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="p-1 sm:px-2 sm:py-0.5 rounded-md bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-medium transition-all border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center space-x-1 cursor-pointer"
            title="Copy source code"
          >
            {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
            <span className="hidden md:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {/* Download Button */}
          <button
            onClick={handleDownload}
            disabled={!cleanCode}
            className="p-1 sm:px-2 sm:py-0.5 rounded-md bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-medium transition-all border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center space-x-1 cursor-pointer disabled:opacity-50"
            title="Download file"
          >
            <Download size={12} />
            <span className="hidden md:inline">Save</span>
          </button>

          {/* Close Workbench Button */}
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close Canvas Workbench"
          >
            <X size={15} />
          </button>
        </div>

      </div>

      {/* ── Main Workbench Body ──────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden flex flex-col">

        {/* Tab 1: Code View */}
        {activeTab === 'code' && (
          <div 
            ref={editorRef}
            className="flex-1 bg-white dark:bg-[#07090e] text-slate-800 dark:text-slate-200 overflow-y-auto p-3 sm:p-4 font-mono text-[11.5px] sm:text-[12px] leading-relaxed custom-scrollbar scroll-smooth"
          >
            {cleanCode ? (
              <div className="flex space-x-3 min-h-full">
                {/* Line Numbers Gutter */}
                <div className="shrink-0 select-none text-slate-400 dark:text-slate-600 text-right pr-2.5 border-r border-slate-100 dark:border-slate-800/80 text-[10.5px] sm:text-[11px] leading-relaxed font-mono">
                  {lines.map((_, idx) => (
                    <div key={idx} className="h-[19px] sm:h-[20px]">{idx + 1}</div>
                  ))}
                </div>

                {/* Code Body */}
                <div className="flex-1 overflow-x-auto text-slate-800 dark:text-slate-100 font-mono">
                  <pre className="whitespace-pre font-mono leading-relaxed">{cleanCode}</pre>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 space-y-2.5 pt-12 font-sans">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-[#0066FF]">
                  <Code2 size={20} />
                </div>
                <h3 className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">Code Canvas Workspace</h3>
                <p className="text-[11px] sm:text-xs text-slate-500 max-w-xs leading-normal">
                  Ask Devnexes AI to create web apps, UI components, scripts, or algorithms. The generated code will appear here live.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Live HTML Preview */}
        {activeTab === 'preview' && isWebPreviewable && (
          <div className="flex-1 bg-white dark:bg-[#12151f] flex flex-col overflow-hidden">
            <iframe
              srcDoc={cleanCode}
              title="Live Code Preview"
              sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
              className="w-full flex-1 border-0 bg-white"
            />
          </div>
        )}

      </div>

      {/* ── Bottom Status Bar ───────────────────────────────────── */}
      <div className="h-6 sm:h-7 px-3 bg-[#f1f5f9] dark:bg-[#080a0f] border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[10px] sm:text-[10.5px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
        <div className="flex items-center space-x-2.5">
          <span className="flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Ready</span>
          </span>
          <span>{lineCount} lines</span>
          <span>{formattedSize}</span>
        </div>

        <div className="flex items-center space-x-2.5">
          <span className="uppercase">{langTag}</span>
          <span className="hidden sm:inline">UTF-8</span>
        </div>
      </div>

    </div>
  );
}
