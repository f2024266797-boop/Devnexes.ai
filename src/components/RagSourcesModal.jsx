import React, { useState } from 'react';
import {
  BookOpen,
  X,
  FileCode,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  Layers,
  Sparkles
} from 'lucide-react';

export default function RagSourcesModal({ isOpen, onClose, sources = [] }) {
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [activeTab, setActiveTab] = useState(0);

  if (!isOpen || !Array.isArray(sources) || sources.length === 0) return null;

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const activeSource = sources[activeTab] || sources[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-neutral-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-neutral-900/50">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center shrink-0">
              <BookOpen size={17} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center space-x-2 truncate">
                <span>RAG Grounding Sources</span>
                <span className="px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-emerald-100/70 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                  {sources.length} chunks retrieved
                </span>
              </h2>
              <p className="text-[11.5px] text-slate-500 dark:text-neutral-400 truncate">
                Hybrid BM25 + Semantic Cosine Vector search matched these exact code & document passages
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Source Selector Tabs */}
        <div className="px-5 py-2.5 border-b border-slate-100 dark:border-neutral-800/80 bg-slate-50/30 dark:bg-neutral-950/20 flex items-center space-x-2 overflow-x-auto custom-scrollbar">
          {sources.map((s, idx) => (
            <button
              key={s.id || idx}
              onClick={() => setActiveTab(idx)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 flex items-center space-x-1.5 cursor-pointer ${
                activeTab === idx
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'bg-white dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-700 border border-slate-200/80 dark:border-neutral-700/60'
              }`}
            >
              <FileCode size={13} className={activeTab === idx ? 'text-white' : 'text-emerald-500'} />
              <span className="truncate max-w-[140px] sm:max-w-[200px]">{s.fileName || s.filePath}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeTab === idx ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-neutral-900 text-slate-500 dark:text-neutral-400'
              }`}>
                {s.relevancePercent || 90}%
              </span>
            </button>
          ))}
        </div>

        {/* Active Source Details */}
        {activeSource && (
          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-4">
            {/* Meta Row */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 dark:bg-neutral-800/50 border border-slate-200/70 dark:border-neutral-800">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono font-medium text-slate-800 dark:text-slate-200 truncate">
                    {activeSource.filePath}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-200/80 dark:bg-neutral-700 text-slate-700 dark:text-neutral-300">
                    Lines {activeSource.lineStart}–{activeSource.lineEnd}
                  </span>
                </div>
                {activeSource.heading && activeSource.heading !== activeSource.fileName && (
                  <p className="text-[11px] text-slate-500 dark:text-neutral-400">
                    Scope: <span className="font-semibold text-slate-700 dark:text-slate-300">{activeSource.heading}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                  <Sparkles size={11} className="text-emerald-500" />
                  <span>{activeSource.relevancePercent || 90}% Match</span>
                </span>

                <button
                  onClick={() => handleCopy(activeSource.content, activeTab)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 border border-slate-200 dark:border-neutral-700 hover:bg-slate-50 dark:hover:bg-neutral-750 transition-colors flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                >
                  {copiedIdx === activeTab ? (
                    <>
                      <Check size={12} className="text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>Copy Chunk</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Code / Content Excerpt */}
            <div className="relative rounded-xl border border-slate-200/80 dark:border-neutral-800 bg-slate-900 text-slate-100 overflow-hidden font-mono text-xs shadow-inner">
              <div className="px-3.5 py-2 border-b border-neutral-800 bg-neutral-950/80 flex items-center justify-between text-[11px] text-neutral-400">
                <span className="font-mono">{activeSource.fileName}</span>
                <span className="text-[10px]">{activeSource.charCount} chars · ~{activeSource.tokenEstimate || 150} tokens</span>
              </div>
              <div className="p-4 overflow-x-auto max-h-[380px] custom-scrollbar leading-relaxed whitespace-pre font-mono">
                {activeSource.content}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-neutral-800/80 bg-slate-50/40 dark:bg-neutral-900/40 flex items-center justify-between text-xs text-slate-500 dark:text-neutral-400">
          <div className="flex items-center space-x-2">
            <Layers size={13} className="text-emerald-500" />
            <span>Retrieved via Devnexes Hybrid RAG (Reciprocal Rank Fusion k=60)</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-200/80 dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 hover:bg-slate-300/80 dark:hover:bg-neutral-700 font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
