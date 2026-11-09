import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Copy, 
  Check, 
  FileCode, 
  Download, 
  X, 
  Code2, 
  Eye, 
  Maximize2,
  History,
  RotateCcw,
  Sparkles,
  LayoutTemplate,
  ChevronDown
} from 'lucide-react';
import CanvasLivePreview from './CanvasLivePreview';
import { splitUnifiedCode, SANDBOX_TEMPLATES } from '../utils/canvasCodeUtils';

/**
 * Devnexes AI Enhanced Code Canvas & Live Interactive Workbench
 * Features:
 * 1. Multi-mode tabs (Code view & Live Interactive Preview)
 * 2. Responsive Device Switcher (Desktop 100%, Tablet 768px, Mobile 375px)
 * 3. Visual Element Inspector (Inspect & Click-to-Edit like v0 / Lovable)
 * 4. Canvas Version History (v1, v2, v3... with 1-click rollback)
 * 5. Multi-file Separated Tabs Mode (HTML / CSS / JS split view)
 * 6. React 18 + Tailwind Sandbox Templates & Execution
 */
export default function IdeCodePanel({ 
  isOpen, 
  onClose, 
  code, 
  title, 
  language, 
  onOpenPreview,
  onSendMessage,
  onCodeChange
}) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('code'); // 'code' | 'preview'
  const [activeCodeSubTab, setActiveCodeSubTab] = useState('all'); // 'all' | 'html' | 'css' | 'js'
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  const [showTemplatesDropdown, setShowTemplatesDropdown] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const editorRef = useRef(null);

  // Clean raw code: remove markdown code fence tags
  const cleanCode = useMemo(() => {
    return (code || '')
      .replace(/^```[a-z0-9_]*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();
  }, [code]);

  // Version History State (Persisted in localStorage)
  const [historyVersions, setHistoryVersions] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('devnexes_canvas_history');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  // Track and save code snapshots to Version History
  useEffect(() => {
    if (!cleanCode || cleanCode.length < 15) return;

    setHistoryVersions(prev => {
      const last = prev[prev.length - 1];
      if (last && last.code === cleanCode) return prev;

      const newVersion = {
        id: `ver_${Date.now()}`,
        versionNumber: prev.length + 1,
        code: cleanCode,
        title: title || `Version ${prev.length + 1}`,
        language: language || 'html',
        timestamp: Date.now(),
        lineCount: cleanCode.split('\n').length
      };

      const updated = [...prev, newVersion].slice(-25); // retain last 25 revisions
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('devnexes_canvas_history', JSON.stringify(updated));
        }
      } catch {}
      return updated;
    });
  }, [cleanCode, title, language]);

  // Rollback to specific version
  const handleRollback = (ver) => {
    if (!ver || !ver.code) return;
    if (onCodeChange) {
      onCodeChange(ver.code, ver.title, ver.language || 'html');
    }
    setShowHistoryDropdown(false);
    showToast(`Restored to Version v${ver.versionNumber}`);
  };

  // Helper toast notification
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Split code into virtual HTML / CSS / JS tabs
  const codeTabs = useMemo(() => {
    return splitUnifiedCode(cleanCode, language);
  }, [cleanCode, language]);

  // Current display code based on active sub tab
  const activeDisplayCode = useMemo(() => {
    if (!codeTabs.hasTabs || activeCodeSubTab === 'all') return cleanCode;
    if (activeCodeSubTab === 'html') return codeTabs.html || cleanCode;
    if (activeCodeSubTab === 'css') return codeTabs.css || '/* No custom <style> rules extracted */';
    if (activeCodeSubTab === 'js') return codeTabs.js || '// No custom <script> code extracted';
    return cleanCode;
  }, [codeTabs, activeCodeSubTab, cleanCode]);

  // Auto-scroll to bottom live as LLM streams code tokens in real-time
  useEffect(() => {
    if (editorRef.current && activeTab === 'code') {
      editorRef.current.scrollTop = editorRef.current.scrollHeight;
    }
  }, [cleanCode, activeTab]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!activeDisplayCode) return;
    navigator.clipboard.writeText(activeDisplayCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!activeDisplayCode) return;
    let downloadFileName = fileName;
    if (activeCodeSubTab === 'css') downloadFileName = 'style.css';
    else if (activeCodeSubTab === 'js') downloadFileName = 'script.js';
    else if (activeCodeSubTab === 'html') downloadFileName = 'index.html';

    const blob = new Blob([activeDisplayCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = downloadFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleLoadTemplate = (tpl) => {
    if (!tpl || !onCodeChange) return;
    onCodeChange(tpl.code, tpl.title, tpl.language);
    setShowTemplatesDropdown(false);
    showToast(`Loaded ${tpl.title} Template`);
  };

  const langTag = (language || 'html').toLowerCase();
  const isWebPreviewable = 
    langTag === 'html' || 
    langTag === 'htm' || 
    langTag === 'jsx' || 
    langTag === 'tsx' || 
    langTag === 'react' || 
    (cleanCode && (cleanCode.includes('<!DOCTYPE') || cleanCode.includes('<html') || cleanCode.includes('import React')));

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

  const lines = activeDisplayCode ? activeDisplayCode.split('\n') : [];
  const lineCount = lines.length;
  const byteSize = new Blob([activeDisplayCode]).size;
  const formattedSize = byteSize > 1024 ? `${(byteSize / 1024).toFixed(1)} KB` : `${byteSize} B`;

  const currentVersionNumber = historyVersions.length > 0 ? historyVersions.length : 1;

  return (
    <div className="fixed inset-0 z-50 lg:relative lg:inset-auto lg:z-20 flex-1 min-w-0 h-full bg-[#f8fafc] dark:bg-[#0c101b] border-l border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden select-none transition-all duration-150 animate-fade-in shadow-2xl lg:shadow-none font-sans">
      
      {/* ── Top Bar / Tab Strip with Mirror Effect ─────────────────────────────────── */}
      <div className="relative h-11 sm:h-12 px-2.5 sm:px-4 bg-[#f1f5f9]/90 dark:bg-[#080a0f]/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 overflow-visible z-30">
        
        {/* Mirror Shimmer Highlight Edge */}
        <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-blue-500/30 dark:via-blue-400/25 to-transparent pointer-events-none" />
        
        {/* Left: File Pill, View Mode Switcher, & Version History Dropdown */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 truncate pr-2">
          
          {/* Active File Pill */}
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-[#0f1422] border border-slate-200/90 dark:border-slate-700/70 text-[11px] sm:text-xs font-mono text-slate-800 dark:text-slate-100 shadow-2xs truncate">
            <FileCode size={13} className="text-[#0066FF] shrink-0" />
            <span className="font-semibold truncate max-w-[110px] sm:max-w-[160px]">{fileName}</span>
            <span className="text-[9.5px] px-1 py-0.2 rounded bg-blue-50 dark:bg-blue-950/80 text-[#0066FF] dark:text-blue-400 font-bold uppercase font-sans shrink-0">
              {langTag}
            </span>
          </div>

          {/* Mode Switcher: Code vs Live Interactive Preview */}
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

          {/* Version History Button & Dropdown (Rollback / Time Travel) */}
          <div className="relative">
            <button
              onClick={() => {
                setShowHistoryDropdown(prev => !prev);
                setShowTemplatesDropdown(false);
              }}
              className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-white dark:bg-[#0f1422] hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-mono transition-all shadow-2xs cursor-pointer"
              title="Canvas Version History & Rollback"
            >
              <History size={12} className="text-indigo-500 shrink-0" />
              <span className="font-bold text-indigo-600 dark:text-indigo-400">v{currentVersionNumber}</span>
              <ChevronDown size={11} className="text-slate-400 shrink-0" />
            </button>

            {/* Version History Dropdown Menu */}
            {showHistoryDropdown && (
              <div className="absolute left-0 mt-1.5 w-64 bg-white dark:bg-[#0f1422] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl py-2 z-50 animate-fade-in font-sans">
                <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100 flex items-center space-x-1.5">
                    <History size={12} className="text-indigo-500" />
                    <span>Canvas Revisions</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {historyVersions.length} {historyVersions.length === 1 ? 'version' : 'versions'}
                  </span>
                </div>

                <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                  {historyVersions.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400">
                      No previous revisions yet.
                    </div>
                  ) : (
                    historyVersions.slice().reverse().map((ver, idx) => {
                      const isCurrent = ver.code === cleanCode;
                      const timeStr = new Date(ver.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      return (
                        <div
                          key={ver.id || idx}
                          onClick={() => handleRollback(ver)}
                          className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                            isCurrent
                              ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div className="flex items-center space-x-2 truncate">
                            <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-indigo-100/70 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-bold shrink-0">
                              v{ver.versionNumber}
                            </span>
                            <div className="truncate">
                              <p className="text-[11.5px] truncate max-w-[120px]">{ver.title || `Snapshot v${ver.versionNumber}`}</p>
                              <span className="text-[10px] text-slate-400 font-mono">{timeStr} • {ver.lineCount} lines</span>
                            </div>
                          </div>

                          {isCurrent ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
                              Active
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center space-x-0.5 shrink-0"
                            >
                              <RotateCcw size={10} />
                              <span>Rollback</span>
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sandbox Templates Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowTemplatesDropdown(prev => !prev);
                setShowHistoryDropdown(false);
              }}
              className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-white dark:bg-[#0f1422] hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[11px] transition-all shadow-2xs cursor-pointer"
              title="Load Starter Sandbox Template"
            >
              <LayoutTemplate size={12} className="text-teal-500 shrink-0" />
              <span className="hidden md:inline font-medium">Templates</span>
              <ChevronDown size={11} className="text-slate-400 shrink-0" />
            </button>

            {/* Templates Menu */}
            {showTemplatesDropdown && (
              <div className="absolute left-0 mt-1.5 w-72 bg-white dark:bg-[#0f1422] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl py-2 z-50 animate-fade-in font-sans">
                <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100 flex items-center space-x-1.5">
                    <Sparkles size={12} className="text-teal-500" />
                    <span>Sandbox Starter Templates</span>
                  </span>
                </div>

                <div className="p-1 space-y-1">
                  {SANDBOX_TEMPLATES.map((tpl) => (
                    <div
                      key={tpl.id}
                      onClick={() => handleLoadTemplate(tpl)}
                      className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{tpl.title}</span>
                        <span className="text-[9.5px] uppercase font-mono px-1 py-0.2 rounded bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 font-bold">
                          {tpl.language}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">{tpl.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

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

      {/* ── Sub Toolbar for Multi-File Separated Tabs (HTML / CSS / JS) ── */}
      {activeTab === 'code' && codeTabs.hasTabs && (
        <div className="h-8 px-3 bg-slate-100/90 dark:bg-[#07090e] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono shrink-0 select-none">
          <div className="flex items-center space-x-1">
            <span className="text-[10px] text-slate-400 font-sans uppercase tracking-wider font-semibold mr-1">
              File Views:
            </span>

            <button
              onClick={() => setActiveCodeSubTab('all')}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                activeCodeSubTab === 'all'
                  ? 'bg-white dark:bg-slate-800 text-[#0066FF] dark:text-blue-400 font-bold shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All-in-One ({fileName})
            </button>

            <button
              onClick={() => setActiveCodeSubTab('html')}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                activeCodeSubTab === 'html'
                  ? 'bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 font-bold shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              index.html
            </button>

            <button
              onClick={() => setActiveCodeSubTab('css')}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                activeCodeSubTab === 'css'
                  ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 font-bold shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              style.css {codeTabs.css ? '' : '(empty)'}
            </button>

            <button
              onClick={() => setActiveCodeSubTab('js')}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                activeCodeSubTab === 'js'
                  ? 'bg-white dark:bg-slate-800 text-yellow-600 dark:text-yellow-400 font-bold shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              script.js {codeTabs.js ? '' : '(empty)'}
            </button>
          </div>

          <span className="text-[10px] text-slate-400 hidden sm:inline">
            Virtual Multi-File Mode
          </span>
        </div>
      )}

      {/* ── Main Workbench Body ──────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden flex flex-col">

        {/* Tab 1: Code View with Syntax Lines */}
        {activeTab === 'code' && (
          <div 
            ref={editorRef}
            className="flex-1 bg-white dark:bg-[#07090e] text-slate-800 dark:text-slate-200 overflow-y-auto p-3 sm:p-4 font-mono text-[11.5px] sm:text-[12px] leading-relaxed custom-scrollbar scroll-smooth"
          >
            {activeDisplayCode ? (
              <div className="flex space-x-3 min-h-full">
                {/* Line Numbers Gutter */}
                <div className="shrink-0 select-none text-slate-400 dark:text-slate-600 text-right pr-2.5 border-r border-slate-100 dark:border-slate-800/80 text-[10.5px] sm:text-[11px] leading-relaxed font-mono">
                  {lines.map((_, idx) => (
                    <div key={idx} className="h-[19px] sm:h-[20px]">{idx + 1}</div>
                  ))}
                </div>

                {/* Code Body */}
                <div className="flex-1 overflow-x-auto text-slate-800 dark:text-slate-100 font-mono">
                  <pre className="whitespace-pre font-mono leading-relaxed">{activeDisplayCode}</pre>
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

        {/* Tab 2: Live HTML / React Interactive Preview with Responsive Switcher & Inspector */}
        {activeTab === 'preview' && isWebPreviewable && (
          <CanvasLivePreview
            code={cleanCode}
            language={language}
            title={title}
            onSendMessage={onSendMessage}
            onOpenFullscreen={() => onOpenPreview?.(cleanCode, title)}
          />
        )}

      </div>

      {/* ── Toast Notification Pill ──────────────────────────────── */}
      {toastMessage && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 px-3 py-1.5 rounded-full bg-slate-900/90 text-white text-xs font-medium shadow-xl border border-slate-700 animate-fade-in flex items-center space-x-1.5">
          <Check size={12} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Bottom Status Bar ───────────────────────────────────── */}
      <div className="h-6 sm:h-7 px-3 bg-[#f1f5f9] dark:bg-[#080a0f] border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[10px] sm:text-[10.5px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
        <div className="flex items-center space-x-2.5">
          <span className="flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Ready</span>
          </span>
          <span>{lineCount} lines</span>
          <span>{formattedSize}</span>
          <span className="text-indigo-500 font-semibold">Rev v{currentVersionNumber}</span>
        </div>

        <div className="flex items-center space-x-2.5">
          <span className="uppercase">{langTag}</span>
          <span className="hidden sm:inline">UTF-8</span>
        </div>
      </div>

    </div>
  );
}
