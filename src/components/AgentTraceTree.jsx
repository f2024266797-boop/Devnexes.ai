import React, { useState, useEffect, useRef, memo, useMemo } from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import FollowUpActionCard from './FollowUpActionCard';
import {
  Globe,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Play,
  Code2,
  Search,
  ExternalLink,
  ArrowUpRight,
  ShieldAlert,
  Eye,
  Terminal,
  RefreshCw,
  Sparkles,
  Download,
  Maximize2,
  Compass,
  LayoutGrid,
  Palette,
  Layers,
  Workflow,
  CheckCircle2
} from 'lucide-react';

// ── Safe Favicon with Fallback Icon ─────────────────────────────
function FaviconIcon({ src, domain }) {
  const [hasError, setHasError] = useState(false);
  const resolvedSrc = src || (domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32` : null);

  if (!resolvedSrc || hasError) {
    return <Globe size={11} className="text-neutral-400 dark:text-neutral-500 mr-1.5 shrink-0" />;
  }
  return (
    <img
      src={resolvedSrc}
      alt=""
      className="w-3.5 h-3.5 rounded mr-1.5 shrink-0 object-contain align-middle inline-block"
      onError={() => setHasError(true)}
      loading="lazy"
    />
  );
}

// ── Strip markdown fences ────────────────────────────────────────
function cleanCodeContent(code) {
  if (!code) return '';
  return code
    .replace(/^```[a-zA-Z0-9_-]*\n?/m, '')
    .replace(/\n?```\s*$/m, '')
    .trim();
}

// ── Auto-scroll streaming code viewer (Used only on deliberate Peek) ──
function StreamingCodeBox({ code, language: _language, wrapCode = false }) {
  const boxRef = useRef(null);

  useEffect(() => {
    if (boxRef.current) {
      boxRef.current.scrollTop = boxRef.current.scrollHeight;
    }
  }, [code]);

  const lines = code.split('\n');

  return (
    <div
      ref={boxRef}
      className="overflow-y-auto max-h-60 custom-scrollbar scroll-smooth w-full max-w-full min-w-0"
    >
      <div className="flex p-2.5 font-mono text-[11px] leading-relaxed w-full max-w-full min-w-0 overflow-hidden">
        <div className="shrink-0 select-none text-right pr-2 text-neutral-400/60 dark:text-neutral-600 font-mono text-[10px]" style={{ minWidth: '1.5rem' }}>
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <div className="flex-1 overflow-x-auto min-w-0 max-w-full">
          <pre className={`text-neutral-800 dark:text-neutral-200 font-mono block w-full ${wrapCode ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'}`}>{code}</pre>
        </div>
      </div>
    </div>
  );
}

// ── Sleek Minimalist Terminal Widget ─────────────────────────────
function ProfessionalTerminalWidget({ content, isExecuting: _isExecuting }) {
  const [copiedCmd, setCopiedCmd] = useState(null);

  const cleanText = (content || '')
    .replace(/^```[a-zA-Z0-9_-]*\n?/m, '')
    .replace(/\n?```\s*$/m, '')
    .trim();

  const handleCopySingle = (cmd, id) => {
    navigator.clipboard.writeText(cmd.trim());
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 1800);
  };

  const handleCopyAll = () => {
    const executableOnly = cleanText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#') && !l.startsWith('//'))
      .join(' && ');
    navigator.clipboard.writeText(executableOnly || cleanText);
    setCopiedCmd('all');
    setTimeout(() => setCopiedCmd(null), 1800);
  };

  if (!cleanText) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-[#0d1117] text-neutral-200 overflow-hidden font-mono text-xs">
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#080b0f] border-b border-neutral-800/80 select-none">
          <div className="flex items-center space-x-2 text-neutral-400">
            <Terminal size={12} />
            <span className="text-[11px] font-mono">Terminal</span>
          </div>
          <span className="text-[10px] text-neutral-500 animate-pulse">Running commands...</span>
        </div>
        <div className="p-3 text-[11.5px] text-neutral-500 font-mono">
          <span>&gt; Generating CLI instructions...</span>
        </div>
      </div>
    );
  }

  const lines = cleanText.split('\n');

  return (
    <div className="rounded-xl border border-neutral-800 bg-[#0d1117] text-neutral-100 overflow-hidden font-mono text-xs shadow-xs">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#080b0f] border-b border-neutral-800/80 select-none">
        <div className="flex items-center space-x-2 text-neutral-400">
          <div className="w-2 h-2 rounded-full bg-emerald-500/80" />
          <span className="text-[11px] font-mono text-neutral-300">Terminal • CLI</span>
        </div>
        <button
          onClick={handleCopyAll}
          className="flex items-center space-x-1 px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10.5px] font-sans font-medium transition-colors cursor-pointer"
          title="Copy sequence"
        >
          {copiedCmd === 'all' ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
          <span>{copiedCmd === 'all' ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      <div className="p-2.5 sm:p-3 space-y-1.5 overflow-x-auto max-h-56 custom-scrollbar text-[11.5px] leading-relaxed">
        {lines.map((line, lIdx) => {
          const trimmed = line.trim();
          if (!trimmed) return null;

          const isComment = trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith('rem ');
          if (isComment) {
            const commentText = trimmed.replace(/^[#\x2frem\s]+/, '');
            return (
              <div key={lIdx} className="pt-1 first:pt-0 text-[11px] font-sans text-neutral-400 select-none">
                # {commentText}
              </div>
            );
          }

          const isCopied = copiedCmd === lIdx;

          return (
            <div
              key={lIdx}
              className="group flex items-center justify-between gap-2 p-1.5 rounded bg-[#131822] border border-neutral-800/80 hover:border-neutral-700 transition-colors"
            >
              <div className="flex items-center space-x-2 min-w-0 flex-1 overflow-x-auto custom-scrollbar">
                <span className="text-neutral-500 font-bold select-none shrink-0 text-[10.5px]">&gt;</span>
                <code className="text-emerald-400 font-mono text-[11.5px] whitespace-pre font-medium">
                  {trimmed}
                </code>
              </div>
              <button
                onClick={() => handleCopySingle(trimmed, lIdx)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-medium shrink-0 transition-colors cursor-pointer ${isCopied
                  ? 'bg-emerald-950 text-emerald-300'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white'
                  }`}
                title="Copy command"
              >
                {isCopied ? <Check size={9} className="text-emerald-400" /> : <Copy size={9} />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Universal Intelligent Architectural Blueprint Widget ───────────
function ArchitecturalBlueprintWidget({ content, stepName, isExecuting: _isExecuting, onOpenIdePanel }) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('blueprint'); // 'blueprint' | 'document'

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content).catch(() => { });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cleanContent = useMemo(() => {
    if (!content || typeof content !== 'string') return '';
    return content
      .replace(/(?:The architecture mandates a single 'code' node executed by Google Gemini to generate the raw C\+\+ syntax|The architecture mandates a single 'code' node executed by Google Gemini|executed by Google Gemini|mandates a single 'code' node)/gi, 'Structured compilation target pipeline')
      .trim();
  }, [content]);

  // Universal Architecture & Specification Parser (Multi-Domain: Systems, C++, Web, Python, Research)
  const parsed = useMemo(() => {
    if (!cleanContent) return null;

    const sections = [];
    const metaTokens = [];
    let currentSection = null;

    const lines = cleanContent.split('\n');

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // Detect Headings (# / ## / ### or bold headers like **Header:**)
      const isHeader = line.startsWith('#') || (/^\*\*[^*:]+:\*\*/.test(line) && line.length < 60);

      if (isHeader) {
        const headerTitle = line
          .replace(/^#+\s*/, '')
          .replace(/^\*\*/, '')
          .replace(/:\*\*$/, '')
          .replace(/\*\*$/, '')
          .trim();

        const lower = headerTitle.toLowerCase();

        let category = 'architecture';
        let badge = 'ARCHITECTURE';

        if (/invariants?|constraints?|rules?|guardrails?|standards?|safety|boundary/i.test(lower)) {
          category = 'constraints';
          badge = 'INVARIANTS';
        } else if (/execution|pipeline|phases?|steps?|milestones?|verification|testing|interaction|features?|state/i.test(lower)) {
          category = 'execution';
          badge = 'EXECUTION';
        } else if (/design|theme|palette|styling|tokens?|typography/i.test(lower)) {
          category = 'styling';
          badge = 'DESIGN';
        } else if (/layout|hierarchy|wireframe|structure|components?|modules?/i.test(lower)) {
          category = 'layout';
          badge = 'HIERARCHY';
        }

        currentSection = {
          title: headerTitle,
          category,
          badge,
          items: []
        };
        sections.push(currentSection);
      } else if (currentSection) {
        // Bullet points or key-values
        const clean = line.replace(/^[-*•\d.)]\s*/, '').trim();
        if (clean.length > 1) {
          // Check if key-value: e.g. "Language: C++20" or "Diagnostic Threshold: 100"
          const kvMatch = /^([A-Za-z0-9\s/&_-]{3,28}):\s*(.+)$/.exec(clean);
          if (kvMatch && kvMatch[1].length < 28) {
            currentSection.items.push({
              isKV: true,
              key: kvMatch[1].trim(),
              value: kvMatch[2].trim()
            });
            if (metaTokens.length < 4 && !clean.includes('http') && kvMatch[2].length < 35) {
              metaTokens.push({ label: kvMatch[1].trim(), val: kvMatch[2].trim() });
            }
          } else {
            currentSection.items.push({
              isKV: false,
              text: clean
            });
          }
        }
      } else {
        // Preamble or text before first header
        const clean = line.replace(/^[-*•\d.)]\s*/, '').trim();
        if (clean.length > 2) {
          if (!sections.some(s => s.category === 'summary')) {
            sections.unshift({
              title: 'Technical Objective & Approach',
              category: 'summary',
              badge: 'OBJECTIVE',
              items: [{ isKV: false, text: clean }]
            });
          } else {
            sections[0].items.push({ isKV: false, text: clean });
          }
        }
      }
    }

    const totalItems = sections.reduce((acc, s) => acc + s.items.length, 0);
    return totalItems >= 1 ? { sections, metaTokens } : null;
  }, [cleanContent]);

  if (!cleanContent) return null;

  return (
    <div className="mt-2.5 rounded-2xl border border-neutral-200/90 dark:border-neutral-800 bg-white/95 dark:bg-[#0c0e15]/95 shadow-sm p-3.5 sm:p-4 space-y-3 font-sans transition-all">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200/70 dark:border-neutral-800/80 pb-2.5">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/80 text-[#0066FF] dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200/60 dark:border-blue-800/60 shadow-2xs">
            <Compass size={13} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <span className="text-xs sm:text-[13px] font-semibold text-neutral-900 dark:text-white truncate">
                {toFriendlyStepName(stepName || 'Technical Architecture & Blueprint')}
              </span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-blue-100 dark:bg-blue-900/60 text-[#0066FF] dark:text-blue-300 uppercase tracking-wider">
                BLUEPRINT
              </span>
            </div>
          </div>
        </div>

        {/* View Toggle + Copy Action */}
        <div className="flex items-center space-x-1.5 shrink-0 select-none">
          {parsed && (
            <div className="flex items-center p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-850 border border-neutral-200/80 dark:border-neutral-800 text-[10.5px]">
              <button
                type="button"
                onClick={() => setActiveTab('blueprint')}
                className={`px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer ${activeTab === 'blueprint'
                  ? 'bg-white dark:bg-neutral-800 text-[#0066FF] dark:text-blue-400 shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
                  }`}
              >
                Structured
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('document')}
                className={`px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer ${activeTab === 'document'
                  ? 'bg-white dark:bg-neutral-800 text-[#0066FF] dark:text-blue-400 shadow-2xs'
                  : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
                  }`}
              >
                Specification
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 bg-neutral-100 hover:bg-neutral-200/70 dark:bg-neutral-850 dark:hover:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-800 transition-colors cursor-pointer text-[11px] font-medium"
            title="Copy technical blueprint"
          >
            {copied ? (
              <>
                <Check size={11} className="text-emerald-500" />
                <span className="text-emerald-500 font-semibold">Copied</span>
              </>
            ) : (
              <>
                <Copy size={11} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Meta Technical Tokens Strip (if extracted) */}
      {parsed?.metaTokens && parsed.metaTokens.length > 0 && activeTab === 'blueprint' && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5 pb-0.5">
          {parsed.metaTokens.map((token, tIdx) => (
            <div
              key={tIdx}
              className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-neutral-100/90 dark:bg-neutral-850 border border-neutral-200/70 dark:border-neutral-800 text-[10.5px] font-mono text-neutral-700 dark:text-neutral-300 shadow-2xs"
            >
              <span className="text-neutral-400 dark:text-neutral-500">{token.label}:</span>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">{token.val}</span>
            </div>
          ))}
        </div>
      )}

      {/* Structured Blueprint View */}
      {parsed && activeTab === 'blueprint' ? (
        <div className="space-y-2.5 pt-0.5">
          {parsed.sections.map((section, sIdx) => {
            const Icon =
              section.category === 'constraints' ? ShieldAlert :
                section.category === 'execution' ? Workflow :
                  section.category === 'styling' ? Palette :
                    section.category === 'layout' ? LayoutGrid : Layers;

            return (
              <div
                key={sIdx}
                className="rounded-xl border border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-900/30 p-2.5 sm:p-3 space-y-2 transition-colors hover:border-neutral-300 dark:hover:border-neutral-700"
              >
                {/* Section Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-2 min-w-0">
                    <Icon size={12.5} className="text-[#0066FF] dark:text-blue-400 shrink-0" />
                    <span className="text-[11.5px] sm:text-[12px] font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                      {section.title}
                    </span>
                  </div>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-medium bg-neutral-200/70 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 shrink-0 uppercase tracking-wider">
                    {section.badge}
                  </span>
                </div>

                {/* Items Grid / List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] sm:text-[11.5px] leading-relaxed">
                  {section.items.map((item, iIdx) => (
                    <div
                      key={iIdx}
                      className={`flex items-start space-x-2 p-2 rounded-lg bg-white/90 dark:bg-[#121622]/90 border border-neutral-200/70 dark:border-neutral-800/80 text-neutral-800 dark:text-neutral-200 shadow-2xs ${item.isKV ? 'col-span-1' : (section.items.length === 1 ? 'col-span-1 sm:col-span-2' : '')
                        }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0066FF] dark:bg-blue-400 shrink-0 mt-1.5" />
                      <div className="min-w-0 flex-1">
                        {item.isKV ? (
                          <>
                            <span className="font-semibold text-neutral-900 dark:text-white mr-1.5">
                              {item.key}:
                            </span>
                            <span className="text-neutral-700 dark:text-neutral-300 font-medium">
                              {item.value}
                            </span>
                          </>
                        ) : (
                          <span className="text-neutral-700 dark:text-neutral-300 font-medium">
                            {item.text}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Validation Banner */}
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-[11px] font-medium select-none">
            <CheckCircle2 size={12.5} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Architectural blueprint verified • Formulated for execution</span>
          </div>
        </div>
      ) : (
        /* Document / Raw Markdown View */
        <div className="pt-1 text-[12.5px] sm:text-[13px] leading-relaxed text-neutral-800 dark:text-neutral-200 font-sans">
          <MarkdownRenderer content={cleanContent} onOpenIdePanel={onOpenIdePanel} />
        </div>
      )}
    </div>
  );
}

// ── Clean Tree Vertex Circle (Zero Box, Native to Tree Spine) ────
function TreeNodeVertex({ status, stageNumber }) {
  if (status === 'running') {
    return (
      <div className="w-5 h-5 rounded-full bg-white dark:bg-[#080b12] border-1.5 border-neutral-400 dark:border-neutral-500 flex items-center justify-center shrink-0 z-10 shadow-2xs">
        <RefreshCw size={9} className="text-neutral-600 dark:text-neutral-300 animate-spin" />
      </div>
    );
  }
  if (status === 'completed') {
    return (
      <div className="w-5 h-5 rounded-full bg-white dark:bg-[#080b12] border border-neutral-300 dark:border-neutral-700 flex items-center justify-center shrink-0 z-10 shadow-2xs">
        <Check size={10} strokeWidth={2.5} className="text-emerald-600 dark:text-emerald-400" />
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="w-5 h-5 rounded-full bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 text-rose-500 flex items-center justify-center shrink-0 z-10 shadow-2xs">
        <span className="text-[10px] font-mono font-bold leading-none">!</span>
      </div>
    );
  }
  // Pending
  return (
    <div className="w-5 h-5 rounded-full bg-neutral-100 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center shrink-0 z-10 text-[9.5px] font-mono text-neutral-400">
      {stageNumber || <div className="w-1 h-1 rounded-full bg-neutral-400 dark:bg-neutral-600" />}
    </div>
  );
}

// ── Detects Urdu, Roman Urdu, or Hindi in user prompt ───────────
function detectIsUrduOrHindi(text = '') {
  if (!text || typeof text !== 'string') return false;
  return /\b(kya|ha|hai|hain|karo|kardo|banao|bana|mujhe|tum|aap|ap|ka|ki|ke|ko|se|me|mein|ye|yeh|wo|woh|kripya|chahiye|dikhao|dikhayein|kuch|aur|par|pe|ik|ek|nahi|nhi|theek|sahi|porflio|tasveer|btao|batayein|kese|kaise|kyun|kab|kahan|kon|kaun|kis|kisko|kitna|kitni|mera|meri|mere)\b/i.test(text);
}

// ── Transforms complex technical jargon into simple, user-friendly language ──
function toFriendlyStepName(name, type, isUrdu = false) {
  if (!name || typeof name !== 'string') {
    if (type === 'code' || type === 'artifact') return isUrdu ? 'Canvas me website/code banana' : 'Build code in Canvas';
    if (type === 'search' || type === 'tool_search') return isUrdu ? 'Internet par search' : 'Search web';
    if (type === 'vision') return isUrdu ? 'Image check karna' : 'Analyze image';
    if (type === 'image') return isUrdu ? 'Image generate karna' : 'Generate image';
    if (type === 'cmd' || type === 'terminal') return isUrdu ? 'Commands setup karna' : 'Setup & run commands';
    return isUrdu ? 'Layout aur design ka plan' : 'Plan layout & design';
  }

  let text = name.trim();
  text = text.replace(/^(?:Stage\s*\d+[:.-]?|\d+[.:])\s*/i, '');
  const lower = text.toLowerCase();

  if (isUrdu) {
    if (type === 'code' || type === 'artifact' || lower.includes('code') || lower.includes('canvas') || lower.includes('implementation')) {
      if (lower.includes('fix') || lower.includes('update') || lower.includes('modification') || lower.includes('incremental')) {
        return 'Canvas me code update karna';
      }
      return 'Canvas me website/code banana';
    }
    if (type === 'search' || lower.includes('search') || lower.includes('grounding') || lower.includes('extraction')) {
      return 'Internet par search karna';
    }
    if (type === 'vision' || lower.includes('vision') || lower.includes('ocr')) {
      return 'Image check karna';
    }
    if (type === 'image' || lower.includes('image') || lower.includes('synthesis')) {
      return 'Image generate karna';
    }
    if (type === 'cmd' || lower.includes('cli') || lower.includes('cmd') || lower.includes('runner')) {
      return 'Commands setup karna';
    }
    if (lower.includes('architecture') || lower.includes('spec') || lower.includes('blueprint') || lower.includes('plan')) {
      return 'Layout aur design ka plan';
    }
    return 'Analysis aur planning';
  }

  // English friendly mappings
  const directMappings = {
    'portfolio architecture & component blueprint': 'Plan layout & structure',
    'system architecture & schema blueprint': 'Plan layout & design',
    'system architecture specification': 'Plan layout & design',
    'architecture & layout blueprint': 'Plan layout & structure',
    'architecture & component blueprint': 'Plan layout & structure',
    'architecture blueprint': 'Plan layout & design',
    'architecture specification': 'Plan layout & design',
    'component blueprint': 'Plan layout & structure',
    'system architecture': 'Plan layout & design',
    'code modification & integration spec': 'Plan code update',
    'incremental code implementation': 'Update code in Canvas',
    'verified facts synthesis & architecture blueprint': 'Review facts & plan layout',
    'factual verification & ground-truth synthesis': 'Review verified facts',
    'root cause & fix diagnostic': 'Find error & plan fix',
    'responsive portfolio implementation': 'Build portfolio website',
    'modern ui/ux canvas implementation': 'Build modern UI in Canvas',
    'executive portfolio canvas implementation': 'Build portfolio in Canvas',
    'production web canvas implementation': 'Build website in Canvas',
    'production canvas implementation': 'Build code in Canvas',
    'full code implementation': 'Write application code',
    'corrected code implementation': 'Fix and update code',
    'local setup & dev server cli runner': 'Setup & run commands',
    'real-time web search & fact finding': 'Search web for facts',
    'real-time web grounding': 'Search web for information',
    'ground-truth entity & linkedin data extraction': 'Search web for verified facts',
    'search web for verified facts': 'Search web for verified facts',
    'visual inspection & ocr analysis': 'Analyze image & text',
    'visual inspection & ocr': 'Analyze image & text',
    'visual composition & style engineering': 'Design image prompt',
    'image synthesis': 'Generate image',
    'cognitive strategy & execution blueprint': 'Plan & Approach'
  };

  if (directMappings[lower]) {
    return directMappings[lower];
  }

  // Generalized user-friendly replacements
  let clean = text
    .replace(/\bCognitive Strategy & Execution Blueprint\b/gi, 'Plan & Approach')
    .replace(/\bCognitive Strategy\b/gi, 'Plan')
    .replace(/\bExecution Blueprint\b/gi, 'Plan')
    .replace(/\bPortfolio Architecture & Component Blueprint\b/gi, 'Plan layout & structure')
    .replace(/\bArchitecture & Component Blueprint\b/gi, 'Plan layout & structure')
    .replace(/\bArchitecture & Layout Blueprint\b/gi, 'Plan layout & structure')
    .replace(/\bArchitecture Blueprint\b/gi, 'Plan layout & design')
    .replace(/\bArchitecture Specification\b/gi, 'Plan layout & design')
    .replace(/\bComponent Blueprint\b/gi, 'Plan layout')
    .replace(/\bSystem Architecture\b/gi, 'Plan layout & design')
    .replace(/\bArchitecture\b/gi, 'Plan')
    .replace(/\bBlueprint\b/gi, 'Plan')
    .replace(/\bSpecification\b/gi, 'Plan')
    .replace(/\bIncremental Code Implementation\b/gi, 'Update code in Canvas')
    .replace(/\bCanvas Implementation\b/gi, 'Build in Canvas')
    .replace(/\bCode Implementation\b/gi, 'Build code')
    .replace(/\bImplementation\b/gi, 'Build')
    .replace(/\bFix Diagnostic\b/gi, 'plan fix')
    .replace(/\bDiagnostic\b/gi, 'Check')
    .replace(/\bSynthesis\b/gi, 'Summary')
    .replace(/\bGrounding\b/gi, 'Search')
    .replace(/\bCLI Runner\b/gi, 'commands')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (clean.length > 0) {
    clean = clean.charAt(0).toUpperCase() + clean.slice(1);
  }

  return clean || text;
}

function toFriendlyTypeBadge(type, lang) {
  if (type === 'code' || type === 'artifact') return lang ? lang.toUpperCase() : 'CODE';
  if (type === 'search' || type === 'tool_search') return 'SEARCH';
  if (type === 'cmd' || type === 'terminal') return 'COMMANDS';
  if (type === 'vision') return 'IMAGE';
  if (type === 'image') return 'IMAGE';
  if (type === 'architecture' || type === 'analysis' || type === 'synthesis') return 'PLAN';
  return 'STEP';
}

// ── Direct Image Downloader without Leaving the Page ────────────
async function handleDownloadImage(url, prompt = 'image') {
  if (!url) return;
  const slug = prompt.slice(0, 30).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const filename = `devnexes-${slug || 'image'}-${Date.now()}.png`;

  try {
    if (url.startsWith('data:')) {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, '_blank');
  }
}

const SD_DIFFUSION_PHASES = [
  { text: 'Composing visual scene and layout...', pct: 25 },
  { text: 'Rendering realistic textures and lighting...', pct: 50 },
  { text: 'Enhancing fine anatomical and surface details...', pct: 75 },
  { text: 'Applying cinematic depth and color balance...', pct: 90 },
  { text: 'Finalizing high-resolution image...', pct: 96 }
];

// ── Captivating Latent Synthesis Loading Canvas ─────
function StableDiffusionGeneratingCanvas({ promptText }) {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [progress, setProgress] = useState(25);

  useEffect(() => {
    const timer = setInterval(() => {
      setPhaseIndex(prev => {
        const next = (prev + 1) % SD_DIFFUSION_PHASES.length;
        setProgress(SD_DIFFUSION_PHASES[next].pct);
        return next;
      });
    }, 2200);

    return () => clearInterval(timer);
  }, []);

  const currentPhase = SD_DIFFUSION_PHASES[phaseIndex] || SD_DIFFUSION_PHASES[0];

  return (
    <div className="relative w-full aspect-square sm:aspect-[16/10] max-h-[440px] rounded-2xl overflow-hidden bg-[#090b14] border border-neutral-800 shadow-[0_12px_40px_rgba(0,0,0,0.3)] flex flex-col items-center justify-between p-5 sm:p-7 select-none">
      {/* Background Radial Aura Glows */}
      <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-blue-600/15 blur-3xl pointer-events-none animate-diffusion-glow" />
      <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-purple-600/20 blur-3xl pointer-events-none animate-diffusion-glow" style={{ animationDelay: '1.5s' }} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.08),transparent_70%)] pointer-events-none" />

      {/* Sweeping Shimmer Beam across Latent Canvas */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="w-full h-24 bg-gradient-to-b from-transparent via-cyan-400/10 to-transparent animate-diffusion-scan" />
      </div>

      {/* Subtle Latent Grid Texture */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
          backgroundSize: '24px 24px'
        }}
      />

      {/* Top Status Strip — Clean & Minimalist */}
      <div className="relative z-10 w-full flex items-center justify-between">
        <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-slate-900/80 border border-white/10 text-slate-300 text-[11px] font-sans tracking-wide backdrop-blur-md shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
          <span>Generating visual...</span>
        </div>
        <span className="text-[11px] font-mono text-slate-400 bg-black/40 px-2 py-0.5 rounded-md border border-white/5 backdrop-blur-xs">
          High Resolution
        </span>
      </div>

      {/* Centerpiece: Neural Diffusion Aperture */}
      <div className="relative z-10 my-auto flex flex-col items-center justify-center space-y-4">
        <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center">
          {/* Outermost slow rotating ring */}
          <div className="absolute inset-0 rounded-full border border-dashed border-indigo-400/30 animate-spin-slow" />

          {/* Middle counter-rotating gradient ring */}
          <div className="absolute inset-2 sm:inset-2.5 rounded-full border-2 border-t-purple-400 border-r-transparent border-b-cyan-400 border-l-transparent animate-spin-reverse opacity-80" />

          {/* Ambient Core Halo */}
          <div className="absolute inset-4 rounded-full bg-gradient-to-tr from-indigo-600/30 via-purple-600/30 to-cyan-500/20 blur-md animate-pulse" />

          {/* Inner Glowing Core */}
          <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-slate-900 to-indigo-950 border border-white/20 shadow-[0_0_20px_rgba(99,102,241,0.4)] flex items-center justify-center text-white">
            <Sparkles size={20} className="animate-pulse text-indigo-300" />
          </div>
        </div>

        {/* Dynamic Phase Ticker */}
        <div className="text-center space-y-1 max-w-sm px-4">
          <p className="text-[13px] sm:text-[14px] font-medium text-slate-100 tracking-tight transition-all duration-300">
            {currentPhase.text}
          </p>
        </div>
      </div>

      {/* Bottom Progress Bar */}
      <div className="relative z-10 w-full space-y-2 max-w-md">
        <div className="relative w-full h-1.5 rounded-full bg-slate-800/80 overflow-hidden border border-white/5">
          <div
            className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {promptText && (
          <div className="flex items-center justify-between text-[11px] px-1 text-slate-400 font-sans">
            <span className="truncate max-w-[85%] text-slate-300">
              &ldquo;{promptText}&rdquo;
            </span>
            <span className="font-mono text-slate-400 shrink-0">{progress}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Premium Stable Diffusion Image Card with Ambient Glow & Modern Controls ──
function StableDiffusionImageCard({
  imageObj = {},
  promptText = '',
  isImageGenerating = false,
  imageNode = null,
  onOpenImageModal = null,
  isUrdu = false
}) {
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const isImageReady = Boolean(imageObj?.url && !isImageGenerating);
  const isError = imageNode?.status === 'error';
  const width = imageObj.width || 1024;
  const height = imageObj.height || 1024;
  const _aspectRatioLabel = width === height ? '1:1 Square' : width > height ? 'Landscape' : 'Portrait';

  const handleCopyPrompt = (e) => {
    e?.stopPropagation();
    if (!promptText) return;
    navigator.clipboard.writeText(promptText);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  return (
    <div className="mt-3.5 rounded-2xl border border-neutral-200/90 dark:border-neutral-800 bg-white/95 dark:bg-[#111422] p-3.5 sm:p-4.5 shadow-sm space-y-3.5 font-sans animate-step-reveal select-none">
      {/* ── Top Header Bar (Clean, Minimalist, No Engine Bragging) ── */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-neutral-200/60 dark:border-neutral-800/70">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border border-neutral-200/80 dark:border-neutral-700/80 flex items-center justify-center shrink-0 shadow-2xs">
            <Sparkles size={14} className={isImageGenerating ? "animate-pulse text-indigo-500" : "text-neutral-600 dark:text-neutral-300"} />
          </div>
          <div className="flex items-center space-x-2 min-w-0">
            <span className="text-[14px] sm:text-[14.5px] font-semibold text-neutral-900 dark:text-neutral-100 truncate">
              {isImageGenerating
                ? (isUrdu ? 'Visual render ho rahi hai...' : 'Generating image...')
                : (imageObj.isOfficialBrand ? `${imageObj.brandName || 'Brand'} Logo` : 'Image')}
            </span>
            {imageObj.isOfficialBrand && imageObj.domain && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 shrink-0">
                {imageObj.domain}
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons Top Right */}
        {isImageReady && (
          <div className="flex items-center space-x-1.5 shrink-0" onClick={e => e.stopPropagation()}>
            {promptText && (
              <button
                type="button"
                onClick={handleCopyPrompt}
                className="px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-950 dark:hover:text-white bg-neutral-100 hover:bg-neutral-200/80 dark:bg-neutral-800/80 dark:hover:bg-neutral-700 border border-neutral-200/70 dark:border-neutral-700/60 transition-all cursor-pointer flex items-center space-x-1.5"
                title="Copy prompt"
              >
                {copiedPrompt ? <Check size={12} className="text-emerald-500 stroke-[2.5]" /> : <Copy size={12} />}
                <span>{copiedPrompt ? 'Copied' : 'Copy Prompt'}</span>
              </button>
            )}

            {onOpenImageModal && (
              <button
                type="button"
                onClick={() => onOpenImageModal(imageObj.url)}
                className="p-1.5 rounded-lg text-neutral-600 hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-white bg-neutral-100 hover:bg-neutral-200/80 dark:bg-neutral-800/80 dark:hover:bg-neutral-700 border border-neutral-200/70 dark:border-neutral-700/60 transition-colors cursor-pointer"
                title="Full Screen Zoom"
              >
                <Maximize2 size={13} />
              </button>
            )}

            <button
              type="button"
              onClick={() => handleDownloadImage(imageObj.url, promptText)}
              className="px-3 py-1.5 rounded-lg text-[11.5px] font-medium bg-neutral-950 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:hover:bg-white dark:text-neutral-950 transition-all cursor-pointer flex items-center space-x-1.5 shadow-2xs hover:scale-[1.01]"
              title="Download Image"
            >
              <Download size={12} />
              <span>Download</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Visual Display Stage (Zero Solid Black Letterbox Bars!) ── */}
      {isImageGenerating ? (
        <StableDiffusionGeneratingCanvas promptText={promptText} />
      ) : isError ? (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 space-y-2 animate-fade-in">
          <div className="flex items-center space-x-2">
            <Sparkles size={15} className="text-amber-500 shrink-0" />
            <span className="font-semibold text-xs sm:text-[13px]">Image Generation Status</span>
          </div>
          <p className="text-[11.5px] leading-relaxed text-slate-700 dark:text-slate-300">
            {imageNode?.error || 'Please check your connection and try again.'}
          </p>
        </div>
      ) : isImageReady ? (
        <div
          onClick={() => { if (onOpenImageModal) onOpenImageModal(imageObj.url); }}
          className="relative group/img overflow-hidden rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-100/80 dark:bg-neutral-900/40 min-h-[340px] sm:min-h-[440px] flex items-center justify-center cursor-zoom-in shadow-inner transition-all select-none"
          title="Click to open full-screen lightbox"
        >
          {/* Ambient Bokeh Backdrop: fills letterbox space with the image's vibrant ambient glow */}
          <div
            className="absolute inset-0 bg-cover bg-center blur-3xl opacity-35 dark:opacity-50 scale-125 pointer-events-none transition-all duration-700"
            style={{ backgroundImage: `url(${imageObj.url})` }}
          />
          <div className="absolute inset-0 bg-black/5 dark:bg-black/35 pointer-events-none" />

          {/* Centered Main Artwork */}
          <img
            src={imageObj.url}
            alt={promptText || 'Visual Asset'}
            onError={(e) => {
              if (imageObj.fallbackUrl && e.currentTarget.src !== imageObj.fallbackUrl) {
                e.currentTarget.src = imageObj.fallbackUrl;
              }
            }}
            className={`relative z-10 object-contain rounded-xl shadow-2xl transition-transform duration-300 group-hover/img:scale-[1.012] ${imageObj.isOfficialBrand
                ? 'max-h-[200px] sm:max-h-[240px] max-w-[240px] w-auto drop-shadow-md'
                : 'max-h-[580px] w-auto max-w-full drop-shadow-2xl'
              }`}
            loading="lazy"
          />

          {/* Top-Right Glassmorphic Quick Toolbelt (Never covers the center of the subject!) */}
          <div className="absolute top-3 right-3 z-20 flex items-center space-x-1.5 opacity-90 sm:opacity-0 sm:group-hover/img:opacity-100 transition-opacity duration-200 bg-neutral-950/75 backdrop-blur-md p-1 rounded-xl border border-white/20 shadow-xl">
            {onOpenImageModal && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onOpenImageModal(imageObj.url); }}
                className="p-1.5 rounded-lg text-white/90 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
                title="Full Screen Lightbox"
              >
                <Maximize2 size={13} />
              </button>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleDownloadImage(imageObj.url, promptText); }}
              className="p-1.5 rounded-lg text-white/90 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
              title="Download Image"
            >
              <Download size={13} />
            </button>
          </div>

          {/* Bottom-Left Subtle Hover Tag */}
          <div className="absolute bottom-3 left-3 z-20 opacity-0 group-hover/img:opacity-100 transition-opacity duration-200 bg-black/65 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/15 text-[11px] font-medium text-white/90 flex items-center space-x-1.5 pointer-events-none">
            <Maximize2 size={11} className="text-white/80" />
            <span>Click to enlarge</span>
          </div>
        </div>
      ) : null}

      {/* ── Bottom Prompt & Generation Details (Clean & Minimal) ── */}
      {isImageReady && promptText && (
        <div className="p-3 sm:p-3.5 rounded-xl bg-neutral-100/70 dark:bg-neutral-900/60 border border-neutral-200/70 dark:border-neutral-800/70 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-1.5 text-neutral-800 dark:text-neutral-200 text-[12px] font-medium">
              <Sparkles size={12} className="text-indigo-500 shrink-0" />
              <span>Prompt</span>
            </div>
          </div>

          <p className="text-[12px] sm:text-[12.5px] leading-relaxed text-neutral-600 dark:text-neutral-300 italic font-sans select-text">
            &ldquo;{promptText}&rdquo;
          </p>

          {imageObj.originalPrompt && imageObj.originalPrompt.toLowerCase() !== promptText.toLowerCase() && (
            <div className="pt-2 border-t border-neutral-200/60 dark:border-neutral-800/60 text-[11px] text-neutral-500 dark:text-neutral-400">
              <span className="truncate">
                <strong className="font-medium text-neutral-700 dark:text-neutral-300">Request:</strong> &ldquo;{imageObj.originalPrompt}&rdquo;
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Claude-Inspired AgentTraceTree Component with Native Tree (Zero Heavy Boxes) ──
function AgentTraceTree({ traceData, isExecuting, onOpenPreview, onOpenIdePanel, onOpenImageModal, userPrompt, onSendMessage, hasSubsequentFix = false }) {
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState({});
  const [wrapCodeNodes, setWrapCodeNodes] = useState({});
  const [showRawCodeSnippet, setShowRawCodeSnippet] = useState({});
  const [isMinimized, setIsMinimized] = useState(true);

  useEffect(() => {
    if (!isExecuting) {
      setIsMinimized(true);
    }
  }, [isExecuting]);

  const toggleNodeExpand = (index) => {
    setExpandedNodes(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const handleCopyCode = (code, index) => {
    navigator.clipboard.writeText(cleanCodeContent(code));
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (!traceData || !traceData.steps) return null;

  const isUrdu = detectIsUrduOrHindi(userPrompt || traceData.steps.map(s => `${s.task || ''} ${s.name || ''} ${s.content || ''}`).join(' '));
  const pipelineSteps = traceData.steps.filter(s => s.type !== 'response' && s.type !== 'header');
  const responseStep = traceData.steps.find(s => s.type === 'response');
  const executionNodes = pipelineSteps.filter(s => s.type !== 'thinking');
  const codeNode = pipelineSteps.find(s => s.type === 'code' || s.type === 'artifact');
  const imageNode = pipelineSteps.find(s => s.type === 'image' || s.imageResult);
  const hasCodeArtifact = !!(codeNode && codeNode.code);
  const isImageGenerating = Boolean(imageNode && (imageNode.status === 'running' || isExecuting) && !imageNode.imageResult?.url);
  const isImageReady = Boolean(imageNode && imageNode.imageResult?.url);
  const showImageCard = Boolean(imageNode && (isImageGenerating || isImageReady || imageNode.status === 'error'));

  // Currently executing node detection (shows live animated step title instead of static thinking/thought seconds)
  const activeRunningStep = pipelineSteps.find(s => s.status === 'running' || s.isStreaming) ||
    pipelineSteps.find(s => s.status === 'pending');
  const activeRunningTitle = activeRunningStep
    ? toFriendlyStepName(activeRunningStep.name || activeRunningStep.title, activeRunningStep.type, isUrdu)
    : (isUrdu ? 'Execution plan tayyar ho raha hai...' : 'Planning execution steps...');

  const completedCount = executionNodes.filter(s => s.status === 'completed').length;
  const completedLabel = isUrdu
    ? (completedCount > 0 ? (completedCount === 1 ? '1 marhala mukammal' : `${completedCount} marhale mukammal`) : 'Tayyar')
    : (completedCount > 0 ? (completedCount === 1 ? '1 step completed' : `${completedCount} steps completed`) : 'Completed');

  return (
    <div className="font-sans text-neutral-800 dark:text-neutral-200 my-1 w-full max-w-full overflow-hidden">

      {/* ── Active Executing Node Header (Prominent size, crisp contrast & clear disclosure) ── */}
      {isExecuting ? (
        <div className="mb-2 select-none">
          <button
            type="button"
            onClick={() => setIsMinimized(prev => !prev)}
            className="group inline-flex items-center gap-2 py-1.5 px-2.5 rounded-lg text-[16px] sm:text-[17px] hover:bg-neutral-100 dark:hover:bg-neutral-800/60 transition-colors font-sans cursor-pointer select-none"
            title={isMinimized ? "Click to view execution tree" : "Click to collapse tree"}
          >
            <span
              key={activeRunningTitle}
              className="animate-blink-left-to-right font-medium tracking-tight truncate max-w-sm sm:max-w-lg animate-fade-in"
            >
              {pipelineSteps.length === 0
                ? (isUrdu ? 'Execution plan tayyar ho raha hai...' : 'Planning execution steps...')
                : `${activeRunningTitle}...`
              }
            </span>
            <ChevronRight
              size={16}
              className={`text-neutral-500 group-hover:text-neutral-800 dark:text-neutral-400 dark:group-hover:text-neutral-200 transition-transform duration-200 shrink-0 ${!isMinimized ? 'rotate-90' : ''}`}
            />
          </button>
        </div>
      ) : pipelineSteps.length > 0 ? (
        <div className="mb-2 select-none">
          <button
            type="button"
            onClick={() => setIsMinimized(prev => !prev)}
            className="group inline-flex items-center gap-2 py-1.5 px-2.5 rounded-lg text-[16px] sm:text-[17px] font-medium text-neutral-700 hover:text-neutral-950 dark:text-neutral-300 dark:hover:text-white transition-colors font-sans cursor-pointer select-none"
            title={isMinimized ? "Click to view execution tree" : "Click to collapse tree"}
          >
            <Check size={16} className="text-emerald-500 dark:text-emerald-400 shrink-0 stroke-[2.5]" />
            <span className="font-medium tracking-tight">
              {completedLabel}
            </span>
            <ChevronRight
              size={16}
              className={`text-neutral-400 group-hover:text-neutral-700 dark:text-neutral-500 dark:group-hover:text-neutral-200 transition-transform duration-200 shrink-0 ${!isMinimized ? 'rotate-90' : ''}`}
            />
          </button>
        </div>
      ) : null}

      {/* ── Expanded Native Nodes Tree (Zero Heavy Boxes, Pure Line Flow) ───── */}
      {pipelineSteps.length > 0 && (
        <div className={`accordion-grid ${!isMinimized ? 'open mb-3 sm:mb-4' : 'mb-0'}`}>
          <div className="accordion-grid-inner">

            {/* Pure Connected Tree Graph (No card boxes around each step) */}
            <div className="relative pl-7 sm:pl-8 space-y-3 font-sans py-1">

              {/* Vertical Continuous Tree Spine */}
              <div className="absolute left-[9.5px] top-2.5 bottom-2.5 w-[1.5px] bg-neutral-200/90 dark:bg-neutral-800/90" />

              {/* ── Tree Execution Nodes ── */}
              {executionNodes.map((step, idx) => {
                if (isExecuting && step.status === 'pending') return null;

                // By default, every node remains closed/collapsed. User can manually expand any node by clicking.
                const isExpanded = !!expandedNodes[idx];

                const stageNum = idx + 1;

                // ── Refusal Node ──────────────────────────────────
                if (step.type === 'cannot_perform') {
                  return (
                    <div key={idx} className="relative animate-step-reveal">
                      <div className="absolute -left-[27px] sm:-left-[31px] top-0.5">
                        <TreeNodeVertex status="error" stageNumber={stageNum} />
                      </div>
                      <div className="text-xs text-neutral-700 dark:text-neutral-300">
                        <div className="flex items-center space-x-1.5 font-medium text-neutral-800 dark:text-neutral-200">
                          <ShieldAlert size={12} />
                          <span>{step.name || 'Capability Boundary Refusal'}</span>
                        </div>
                        <p className="leading-relaxed mt-1 text-neutral-600 dark:text-neutral-400">{step.content}</p>
                      </div>
                    </div>
                  );
                }

                // ── Code / Artifact Node (Zero Box, Native Line) ──
                if (step.type === 'code' || step.type === 'artifact') {
                  const cleanedCode = cleanCodeContent(step.code);
                  const lineCount = cleanedCode ? cleanedCode.split('\n').length : 0;
                  const isSnippetOpen = !!showRawCodeSnippet[idx];
                  const isWrapped = !!wrapCodeNodes[idx];
                  const isPreviewable = step.language === 'html' || (cleanedCode && (cleanedCode.includes('<!DOCTYPE') || cleanedCode.includes('<html')));

                  return (
                    <div key={idx} className="relative animate-step-reveal py-0.5">
                      {/* Vertex on Tree Spine */}
                      <div className="absolute -left-[27px] sm:-left-[31px] top-0.5">
                        <TreeNodeVertex status={step.status} stageNumber={stageNum} />
                      </div>

                      {/* Clean Single Line on Tree (No box wrapper) */}
                      <div>
                        <div
                          onClick={() => toggleNodeExpand(idx)}
                          className="flex items-center justify-between gap-2 py-0.5 cursor-pointer group select-none min-w-0"
                        >
                          <div className="flex items-center space-x-1.5 sm:space-x-2 min-w-0 flex-1">
                            <Code2 size={13.5} className="text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-800 dark:group-hover:text-neutral-200 shrink-0" />
                            <span className="text-xs sm:text-[12.5px] font-medium text-neutral-800 dark:text-neutral-200 group-hover:text-neutral-950 dark:group-hover:text-white truncate">
                              {stageNum}. {toFriendlyStepName(step.name || step.title, 'code', isUrdu)}
                            </span>
                            <span className="px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-mono text-[9px] uppercase border border-neutral-200 dark:border-neutral-700 shrink-0">
                              {toFriendlyTypeBadge(step.type, step.language)}
                            </span>
                          </div>

                          <div className="flex items-center space-x-1.5 sm:space-x-2 text-[11px] shrink-0" onClick={e => e.stopPropagation()}>
                            {step.status === 'running' ? (
                              <span className="text-neutral-500 animate-pulse text-[10.5px] truncate max-w-[120px] sm:max-w-none">
                                {isUrdu ? 'Gemini code likh raha hai...' : 'Generating code with Gemini...'}
                              </span>
                            ) : (
                              <>
                                <span className="hidden xs:inline-block text-neutral-400 font-mono text-[10.5px]">
                                  {lineCount > 0 ? `${lineCount} lines` : (isUrdu ? 'Tayyar' : 'Ready')}
                                </span>

                                {isPreviewable && onOpenPreview && cleanedCode && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenPreview(cleanedCode, step.title || step.name)}
                                    className="px-2 py-0.5 rounded text-[10.5px] font-medium bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border border-neutral-200/80 dark:border-neutral-700 transition-colors cursor-pointer flex items-center space-x-1"
                                    title="Live Preview"
                                  >
                                    <Play size={8} fill="currentColor" />
                                    <span>Preview</span>
                                  </button>
                                )}

                                {onOpenIdePanel && cleanedCode && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenIdePanel(cleanedCode, step.title || step.name, step.language)}
                                    className="px-2 py-0.5 rounded text-[10.5px] font-medium bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 border border-neutral-200/90 dark:border-neutral-700/90 transition-colors cursor-pointer flex items-center space-x-1 shadow-2xs"
                                    title="Open in Code Canvas"
                                  >
                                    <span className="hidden sm:inline">Open </span><span>Canvas</span>
                                    <ArrowUpRight size={10} strokeWidth={2} className="text-[#0066FF] dark:text-blue-400" />
                                  </button>
                                )}
                              </>
                            )}

                            <span
                              className="p-0.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer"
                              onClick={() => toggleNodeExpand(idx)}
                              title={isExpanded ? "Collapse code inspection" : "Expand code inspection"}
                            >
                              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            </span>
                          </div>
                        </div>

                        {/* Collapsed Peek View (Only if explicitly clicked Peek or Expanded) */}
                        {(isExpanded || isSnippetOpen) && cleanedCode && (
                          <div className="mt-2.5 rounded-xl glass-card overflow-hidden animate-smooth-expand">
                            <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-100/60 dark:bg-neutral-900/60 border-b border-neutral-200/70 dark:border-white/10 text-[10.5px] text-neutral-500">
                              <span className="font-medium flex items-center gap-1.5">
                                <span>Code Inspection</span>
                                {lineCount > 0 && (
                                  <span className="font-mono text-[9.5px] text-neutral-400 font-normal">
                                    ({lineCount} lines)
                                  </span>
                                )}
                              </span>
                              <div className="flex items-center space-x-2">
                                <button
                                  type="button"
                                  onClick={() => setWrapCodeNodes(prev => ({ ...prev, [idx]: !prev[idx] }))}
                                  className="hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer font-sans"
                                >
                                  {isWrapped ? 'Wrap: On' : 'Wrap: Off'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCopyCode(cleanedCode, idx)}
                                  className="hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer flex items-center space-x-1 font-sans"
                                >
                                  {copiedIndex === idx ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
                                  <span>{copiedIndex === idx ? 'Copied' : 'Copy'}</span>
                                </button>
                              </div>
                            </div>
                            <StreamingCodeBox code={cleanedCode} language={step.language} wrapCode={isWrapped} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                // ── Search Node (Web Grounding, Zero Box) ─────────
                if (step.type === 'search' || step.type === 'tool_search') {
                  return (
                    <div key={idx} className="relative animate-step-reveal py-0.5">
                      <div className="absolute -left-[27px] sm:-left-[31px] top-0.5">
                        <TreeNodeVertex status={step.status} stageNumber={stageNum} />
                      </div>

                      <div>
                        <div
                          onClick={() => toggleNodeExpand(idx)}
                          className="flex items-center justify-between gap-x-3 gap-y-1 py-0.5 cursor-pointer group select-none"
                        >
                          <div className="flex items-center space-x-2 min-w-0">
                            <Search size={13.5} className="text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-800 dark:group-hover:text-neutral-200 shrink-0" />
                            <span className="text-xs sm:text-[12.5px] font-medium text-neutral-800 dark:text-neutral-200 group-hover:text-neutral-950 dark:group-hover:text-white truncate">
                              {stageNum}. {toFriendlyStepName(step.name, 'search', isUrdu)}
                            </span>
                            <span className="px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-mono text-[9px] uppercase border border-neutral-200 dark:border-neutral-700 shrink-0">
                              {toFriendlyTypeBadge(step.type)}
                            </span>
                          </div>

                          <div className="flex items-center space-x-2 text-[11px] shrink-0">
                            {step.status === 'running' && (
                              <span className="text-neutral-500 animate-pulse text-[10.5px]">
                                {isUrdu ? 'Internet par search ho raha hai...' : 'Searching web...'}
                              </span>
                            )}
                            {step.status === 'completed' && step.results?.length > 0 && (
                              <span className="text-neutral-400 font-mono text-[10.5px]">
                                {step.results.length} sources
                              </span>
                            )}
                            <span className="p-0.5 text-neutral-400">
                              {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                            </span>
                          </div>
                        </div>

                        {isExpanded && step.results?.length > 0 && (
                          <div className="mt-2.5 p-3 sm:p-3.5 rounded-xl glass-card text-xs">
                            <div className="text-[10px] uppercase font-semibold tracking-wider text-neutral-500 dark:text-neutral-400 mb-2 flex items-center justify-between">
                              <span>Verified Sources ({step.results.length})</span>
                              <span className="font-mono text-[9.5px] text-neutral-400">Live web</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {step.results.map((result, rIdx) => (
                                <a
                                  key={rIdx}
                                  href={result.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="glass-pill inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[11px] hover:border-neutral-400 dark:hover:border-neutral-500 text-neutral-700 dark:text-neutral-300 transition-colors shadow-2xs font-medium"
                                  title={result.title}
                                >
                                  <FaviconIcon src={result.favicon} domain={result.domain} />
                                  <span className="truncate max-w-[160px]">{result.domain || result.title}</span>
                                  <ExternalLink size={10} className="text-neutral-400 shrink-0" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                // ── Terminal / Command Node (Zero Box Header) ─────
                if (step.type === 'cmd' || step.type === 'terminal') {
                  return (
                    <div key={idx} className="relative animate-step-reveal py-0.5">
                      <div className="absolute -left-[27px] sm:-left-[31px] top-0.5">
                        <TreeNodeVertex status={step.status} stageNumber={stageNum} />
                      </div>

                      <div>
                        <div
                          onClick={() => toggleNodeExpand(idx)}
                          className="flex items-center justify-between gap-x-3 gap-y-1 py-0.5 cursor-pointer group select-none"
                        >
                          <div className="flex items-center space-x-2 min-w-0">
                            <Terminal size={13.5} className="text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-800 dark:group-hover:text-neutral-200 shrink-0" />
                            <span className="text-xs sm:text-[12.5px] font-medium text-neutral-800 dark:text-neutral-200 group-hover:text-neutral-950 dark:group-hover:text-white truncate">
                              {stageNum}. {toFriendlyStepName(step.name, 'cmd', isUrdu)}
                            </span>
                            <span className="px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-mono text-[9px] uppercase border border-neutral-200 dark:border-neutral-700 shrink-0">
                              {toFriendlyTypeBadge(step.type)}
                            </span>
                          </div>

                          <div className="flex items-center space-x-2 text-[11px] shrink-0">
                            <span className="text-neutral-400 font-mono text-[10.5px]">Commands</span>
                            <span className="p-0.5 text-neutral-400">
                              {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                            </span>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="mt-2">
                            <ProfessionalTerminalWidget content={step.content} isExecuting={isExecuting && step.status === 'running'} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                // ── Vision Node (Zero Box Header) ─────────────────
                if (step.type === 'vision') {
                  return (
                    <div key={idx} className="relative animate-step-reveal py-0.5">
                      <div className="absolute -left-[27px] sm:-left-[31px] top-0.5">
                        <TreeNodeVertex status={step.status} stageNumber={stageNum} />
                      </div>

                      <div>
                        <div
                          onClick={() => toggleNodeExpand(idx)}
                          className="flex items-center justify-between gap-x-3 gap-y-1 py-0.5 cursor-pointer group select-none"
                        >
                          <div className="flex items-center space-x-2 min-w-0">
                            <Eye size={13.5} className="text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-800 dark:group-hover:text-neutral-200 shrink-0" />
                            <span className="text-xs sm:text-[12.5px] font-medium text-neutral-800 dark:text-neutral-200 group-hover:text-neutral-950 dark:group-hover:text-white truncate">
                              {stageNum}. {toFriendlyStepName(step.name, 'vision', isUrdu)}
                            </span>
                            <span className="px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-mono text-[9px] uppercase border border-neutral-200 dark:border-neutral-700 shrink-0">
                              {toFriendlyTypeBadge(step.type)}
                            </span>
                          </div>

                          <div className="flex items-center space-x-2 text-[11px] shrink-0">
                            {step.status === 'running' && (
                              <span className="text-neutral-500 animate-pulse text-[10.5px]">
                                {isUrdu ? 'Image check ho rahi hai...' : 'Analyzing image...'}
                              </span>
                            )}
                            <span className="p-0.5 text-neutral-400">
                              {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                            </span>
                          </div>
                        </div>

                        {isExpanded && step.content && (
                          <div className="mt-2.5 p-3.5 sm:p-4 rounded-xl glass-card text-[12.5px] sm:text-[13px] leading-relaxed text-neutral-700 dark:text-neutral-300">
                            <MarkdownRenderer content={step.content} onOpenIdePanel={onOpenIdePanel} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                // ── Image Generation Node (Stable Diffusion 1.5) ─
                if (step.type === 'image' || step.imageResult) {
                  const isImageReady = step.status === 'completed' && step.imageResult?.url;
                  const imageObj = step.imageResult || {};
                  const promptText = imageObj.prompt || imageObj.originalPrompt || step.imagePrompt || step.task || '';

                  return (
                    <div key={idx} className="relative animate-step-reveal py-0.5">
                      <div className="absolute -left-[27px] sm:-left-[31px] top-0.5">
                        <TreeNodeVertex status={step.status} stageNumber={stageNum} />
                      </div>

                      <div>
                        {/* Heading Row OUTSIDE the card on the tree line */}
                        <div
                          onClick={() => toggleNodeExpand(idx)}
                          className="flex items-center justify-between gap-x-3 gap-y-1 py-0.5 cursor-pointer group select-none"
                        >
                          <div className="flex items-center space-x-2 min-w-0">
                            <Sparkles size={13.5} className="text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-800 dark:group-hover:text-neutral-200 shrink-0" />
                            <span className="text-xs sm:text-[12.5px] font-medium text-neutral-800 dark:text-neutral-200 group-hover:text-neutral-950 dark:group-hover:text-white truncate">
                              {stageNum}. {toFriendlyStepName(step.name, 'image', isUrdu)}
                            </span>
                            <span className="px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-mono text-[9px] uppercase border border-neutral-200 dark:border-neutral-700 shrink-0">
                              {toFriendlyTypeBadge(step.type)}
                            </span>
                          </div>

                          <div className="flex items-center space-x-2 text-[11px] shrink-0">
                            {step.status === 'running' ? (
                              <span className="text-neutral-500 animate-pulse text-[10.5px]">
                                {isUrdu ? 'Image ban rahi hai...' : 'Creating image...'}
                              </span>
                            ) : isImageReady ? (
                              <span className="text-neutral-400 font-mono text-[10.5px]">
                                {isUrdu ? 'Tayyar' : 'Ready'}
                              </span>
                            ) : null}
                            <span className="p-0.5 text-neutral-400">
                              {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                            </span>
                          </div>
                        </div>

                        {/* Open Content inside Sophisticated Glass Card */}
                        {isExpanded && (
                          <div className="mt-2.5 p-3.5 sm:p-4 rounded-xl glass-card transition-all duration-200 font-sans">
                            {step.status === 'running' && (
                              <StableDiffusionGeneratingCanvas promptText={step.imagePrompt || step.task} />
                            )}

                            {step.status === 'error' && (
                              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 space-y-2 animate-fade-in">
                                <div className="flex items-center space-x-2">
                                  <Sparkles size={15} className="text-amber-500 shrink-0" />
                                  <span className="font-semibold text-xs sm:text-[13px]">Image Generation Status</span>
                                </div>
                                <p className="text-[11.5px] leading-relaxed text-slate-700 dark:text-slate-300">
                                  {step.error || 'Please check your connection and try again.'}
                                </p>
                              </div>
                            )}

                            {isImageReady && (
                              <div className="space-y-3">
                                {/* Image Container with Ambient Bokeh & Quick Actions */}
                                <div className="relative group/img overflow-hidden rounded-xl border border-neutral-200/90 dark:border-neutral-800 flex items-center justify-center bg-neutral-100 dark:bg-neutral-900/50 min-h-[220px]">
                                  {/* Ambient Bokeh Backdrop */}
                                  <div
                                    className="absolute inset-0 bg-cover bg-center blur-2xl opacity-35 dark:opacity-50 scale-125 pointer-events-none"
                                    style={{ backgroundImage: `url(${imageObj.url})` }}
                                  />
                                  <img
                                    src={imageObj.url}
                                    alt={imageObj.originalPrompt || 'Visual Asset'}
                                    onError={(e) => {
                                      if (imageObj.fallbackUrl && e.currentTarget.src !== imageObj.fallbackUrl) {
                                        e.currentTarget.src = imageObj.fallbackUrl;
                                      }
                                    }}
                                    className={`relative z-10 object-contain transition-transform duration-300 group-hover/img:scale-[1.01] cursor-pointer ${imageObj.isOfficialBrand ? 'max-h-[160px] max-w-[200px] w-auto drop-shadow-sm' : 'w-full max-h-[500px]'
                                      }`}
                                    onClick={() => {
                                      if (onOpenImageModal) onOpenImageModal(imageObj.url);
                                    }}
                                    loading="lazy"
                                  />

                                  {/* Hover Overlay Controls */}
                                  <div className="absolute top-2.5 right-2.5 z-20 flex items-center space-x-1.5 opacity-90 sm:opacity-0 sm:group-hover/img:opacity-100 transition-opacity duration-200">
                                    {onOpenImageModal && (
                                      <button
                                        type="button"
                                        onClick={() => onOpenImageModal(imageObj.url)}
                                        className="p-1.5 rounded-lg bg-black/75 hover:bg-black text-white text-xs backdrop-blur-md border border-white/20 transition-all cursor-pointer shadow-sm"
                                        title="Enlarge image"
                                      >
                                        <Maximize2 size={13} />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleDownloadImage(imageObj.url, imageObj.originalPrompt || imageObj.prompt)}
                                      className="p-1.5 rounded-lg bg-black/75 hover:bg-black text-white text-xs backdrop-blur-md border border-white/20 transition-all cursor-pointer shadow-sm"
                                      title="Download full resolution image"
                                    >
                                      <Download size={13} />
                                    </button>
                                  </div>
                                </div>

                                {/* Metadata & Prompt Details */}
                                <div className="pt-1 space-y-2">
                                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="glass-pill px-2 py-0.5 rounded-md font-mono text-[10px] text-neutral-600 dark:text-neutral-400">
                                        1024×1024
                                      </span>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => handleCopyCode(promptText, `prompt-${idx}`)}
                                      className="inline-flex items-center space-x-1 text-[11px] text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors cursor-pointer"
                                    >
                                      {copiedIndex === `prompt-${idx}` ? (
                                        <>
                                          <Check size={11} className="text-emerald-500" />
                                          <span className="text-emerald-500">Prompt copied</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy size={11} />
                                          <span>Copy Prompt</span>
                                        </>
                                      )}
                                    </button>
                                  </div>

                                  {promptText && (
                                    <div className="p-2.5 rounded-lg bg-neutral-100/70 dark:bg-neutral-900/60 border border-neutral-200/70 dark:border-neutral-800/70 text-[11.5px] leading-relaxed text-neutral-600 dark:text-neutral-400 font-sans">
                                      <span className="font-semibold text-neutral-800 dark:text-neutral-200 mr-1.5">Prompt:</span>
                                      {promptText}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                // ── Analysis / Architecture / General Node (Zero Box) ──
                return (
                  <div key={idx} className="relative animate-step-reveal py-0.5">
                    {/* Vertex on Tree Spine */}
                    <div className="absolute -left-[27px] sm:-left-[31px] top-0.5">
                      <TreeNodeVertex status={step.status} stageNumber={stageNum} />
                    </div>

                    {/* Clean Single Line on Tree (No box wrapper) */}
                    <div>
                      <div
                        onClick={() => toggleNodeExpand(idx)}
                        className="flex items-center justify-between gap-x-3 gap-y-1 py-0.5 cursor-pointer group select-none"
                      >
                        <div className="flex items-center space-x-2 min-w-0">
                          <Compass size={13.5} className="text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-800 dark:group-hover:text-neutral-200 shrink-0" />
                          <span className="text-xs sm:text-[12.5px] font-medium text-neutral-800 dark:text-neutral-200 group-hover:text-neutral-950 dark:group-hover:text-white truncate">
                            {stageNum}. {toFriendlyStepName(step.name, 'analysis', isUrdu)}
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-mono text-[9px] uppercase border border-neutral-200 dark:border-neutral-700 shrink-0">
                            {toFriendlyTypeBadge(step.type)}
                          </span>
                        </div>

                        <div className="flex items-center space-x-2 text-[11px] shrink-0">
                          {step.status === 'running' ? (
                            <span className="text-neutral-500 animate-pulse text-[10.5px]">
                              {isUrdu ? 'Plan ban raha hai...' : 'Planning...'}
                            </span>
                          ) : (
                            <span className="text-neutral-400 font-mono text-[10.5px]">
                              {isUrdu ? 'Tayyar' : 'Ready'}
                            </span>
                          )}
                          <span className="p-0.5 text-neutral-400">
                            {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                          </span>
                        </div>
                      </div>

                      {isExpanded && step.content && (
                        <ArchitecturalBlueprintWidget
                          content={step.content}
                          stepName={step.name}
                          isExecuting={isExecuting && step.status === 'running'}
                        />
                      )}
                    </div>
                  </div>
                );
              })}

            </div>
          </div>
        </div>
      )}

      {/* ── Direct Model Response Text ─────────────────────────── */}
      {responseStep && (
        responseStep.content ? (
          <div className="pt-1 text-[16.5px] sm:text-[17px] leading-[1.78] text-neutral-900 dark:text-neutral-100 font-sans">
            <MarkdownRenderer content={responseStep.content} onOpenIdePanel={onOpenIdePanel} />
            <FollowUpActionCard
              assistantText={responseStep.content}
              userPrompt={userPrompt}
              onSendMessage={onSendMessage}
              isExecuting={isExecuting}
              hasCodeArtifact={hasCodeArtifact || hasSubsequentFix}
            />
          </div>
        ) : isExecuting && pipelineSteps.length > 0 && pipelineSteps.every(s => s.status === 'completed') ? (
          <div className="pt-2 flex items-center space-x-2 text-neutral-500 dark:text-neutral-400 animate-pulse text-xs select-none">
            <div className="w-1.5 h-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500 animate-ping" />
            <span>{isUrdu ? 'Jawab likh rahe hain...' : 'Formulating response...'}</span>
          </div>
        ) : null
      )}

      {/* ── Stable Diffusion Image Card (Prominently Rendered on UI with Ambient Bokeh & Pro Controls) ── */}
      {showImageCard && (
        <StableDiffusionImageCard
          imageObj={imageNode.imageResult || {}}
          promptText={imageNode.imageResult?.originalPrompt || imageNode.imageResult?.prompt || imageNode.imagePrompt || imageNode.task || ''}
          isImageGenerating={isImageGenerating}
          imageNode={imageNode}
          onOpenImageModal={onOpenImageModal}
          isUrdu={isUrdu}
        />
      )}

      {/* ── Claude-Inspired Artifact Card (Calm, Premium, High Taste) ── */}
      {!isExecuting && hasCodeArtifact && onOpenIdePanel && (() => {
        const cleanedCode = cleanCodeContent(codeNode.code);
        const isPreviewable = codeNode.language === 'html' || (cleanedCode && (cleanedCode.includes('<!DOCTYPE') || cleanedCode.includes('<html')));
        const lineCount = cleanedCode ? cleanedCode.split('\n').length : 0;
        const langTag = (codeNode.language || 'html').toUpperCase();
        const title = codeNode.title || 'Interactive Application';

        // CHOTA MOTA CODE (<= 15 lines and not interactive HTML canvas):
        // Show directly on the main screen in the chat message, without opening sidebar!
        if (lineCount <= 15 && !isPreviewable) {
          const alreadyInResponse = responseStep?.content && responseStep.content.includes('```');
          if (alreadyInResponse) return null;

          return (
            <div className="mt-3.5 w-full animate-fade-in">
              <MarkdownRenderer
                content={`\`\`\`${codeNode.language || 'code'}\n${cleanedCode}\n\`\`\``}
                onOpenIdePanel={onOpenIdePanel}
              />
            </div>
          );
        }

        return (
          <div
            onClick={() => onOpenIdePanel(cleanedCode, title, codeNode.language)}
            className="mt-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141416] hover:border-neutral-300 dark:hover:border-neutral-700 p-3 sm:p-3.5 transition-all duration-200 cursor-pointer shadow-xs hover:shadow-sm group select-none"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Left: Icon + Title & Metadata */}
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200/80 dark:border-neutral-700 flex items-center justify-center shrink-0 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">
                  <Code2 size={18} strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <h4 className="text-[13.5px] font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-neutral-950 dark:group-hover:text-white truncate">
                      {title}
                    </h4>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium tracking-wide bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 shrink-0">
                      {langTag}
                    </span>
                  </div>
                  <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
                    Interactive artifact {lineCount > 0 ? `• ${lineCount} lines ` : ''}• Click to open in workspace
                  </p>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto" onClick={e => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => handleCopyCode(codeNode.code, 'artifact-card-copy')}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-transparent hover:border-neutral-200 dark:hover:border-neutral-700 transition-colors cursor-pointer"
                  title="Copy code"
                >
                  {copiedIndex === 'artifact-card-copy' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                </button>

                {isPreviewable && onOpenPreview && (
                  <button
                    type="button"
                    onClick={() => onOpenPreview(cleanedCode, title)}
                    className="px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 border border-neutral-200/90 dark:border-neutral-700/90 transition-colors cursor-pointer flex items-center space-x-1.5"
                    title="Live Preview"
                  >
                    <Play size={10} fill="currentColor" />
                    <span>Preview</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onOpenIdePanel(cleanedCode, title, codeNode.language)}
                  className="px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-100 dark:border dark:border-neutral-700 transition-colors cursor-pointer flex items-center space-x-1.5 shadow-xs"
                >
                  <span>Open Canvas</span>
                  <ArrowUpRight size={13} strokeWidth={2} />
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}

export default memo(AgentTraceTree);
