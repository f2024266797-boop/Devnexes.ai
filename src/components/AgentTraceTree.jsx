import React, { useState, useEffect, useRef, memo } from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import {
  Globe,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Play,
  CheckCircle2,
  RefreshCw,
  Code2,
  Brain,
  Search,
  ExternalLink,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  HelpCircle,
  Eye,
  Terminal
} from 'lucide-react';

// ── Safe Favicon with Fallback Icon ─────────────────────────────
function FaviconIcon({ src, domain }) {
  const [hasError, setHasError] = useState(false);
  if (!src || hasError) {
    return <Globe size={13} className="text-slate-400 dark:text-slate-500 mr-2 shrink-0 mt-0.5" />;
  }
  return (
    <img
      src={src}
      alt=""
      className="w-3.5 h-3.5 rounded mt-0.5 mr-2 shrink-0 object-contain"
      onError={() => setHasError(true)}
      loading="lazy"
    />
  );
}

// ── Interactive Clarification / MCQ Card Component ──────────────
function ClarificationCard({ clarification, onSendMessage }) {
  const [selected, setSelected] = useState(null);
  const [customText, setCustomText] = useState('');
  const [isCustomActive, setIsCustomActive] = useState(false);

  if (!clarification || !clarification.options || clarification.options.length === 0) return null;

  const handleSelect = (opt) => {
    setSelected(opt);
    if (onSendMessage) {
      onSendMessage(opt);
    }
  };

  const handleCustomSubmit = (e) => {
    if (e) e.preventDefault();
    if (!customText.trim()) return;
    const finalVal = customText.trim();
    setSelected(finalVal);
    if (onSendMessage) {
      onSendMessage(finalVal);
    }
    setCustomText('');
  };

  const options = clarification.options;
  const customOptionLetter = String.fromCharCode(65 + options.length);

  return (
    <div className="my-2.5 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-50/90 via-indigo-50/30 to-slate-50/90 dark:from-[#0c1224] dark:via-[#0f172a] dark:to-[#080d1a] border border-blue-200/90 dark:border-blue-900/60 shadow-xs animate-step-reveal font-sans">
      <div className="flex items-start space-x-2.5 mb-2.5">
        <div className="w-5 h-5 sm:w-5.5 sm:h-5.5 rounded-full bg-blue-100 dark:bg-blue-950 text-[#0066FF] dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
          <HelpCircle size={13} />
        </div>
        <div>
          <h4 className="text-xs sm:text-[13.5px] font-semibold text-slate-900 dark:text-white leading-tight">
            {clarification.question || 'Please select an option to proceed:'}
          </h4>
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Click any option below or enter your own custom recommendation:
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 mt-2">
        {options.map((opt, oIdx) => {
          const isChosen = selected === opt;
          return (
            <button
              key={oIdx}
              onClick={() => handleSelect(opt)}
              className={`w-full text-left p-2.5 sm:p-3 rounded-lg sm:rounded-xl border transition-all duration-200 flex items-center justify-between group cursor-pointer active:scale-[0.99] ${
                isChosen
                  ? 'bg-blue-100 dark:bg-blue-950 border-[#0066FF] ring-2 ring-blue-500/20 text-[#0066FF] dark:text-blue-300'
                  : 'bg-white hover:bg-blue-50/80 dark:bg-[#111728] dark:hover:bg-[#161f36] border-slate-200/80 hover:border-blue-400 dark:border-slate-800 dark:hover:border-blue-700 shadow-2xs hover:shadow-xs'
              }`}
            >
              <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                <span className={`w-5 h-5 sm:w-5.5 sm:h-5.5 rounded-md sm:rounded-lg text-[11px] sm:text-xs font-mono font-bold flex items-center justify-center shrink-0 ${
                  isChosen
                    ? 'bg-[#0066FF] text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 group-hover:bg-blue-100 dark:group-hover:bg-blue-950 group-hover:text-[#0066FF]'
                }`}>
                  {String.fromCharCode(65 + oIdx)}
                </span>
                <span className="text-xs sm:text-[13px] font-medium text-slate-800 dark:text-slate-200 group-hover:text-[#0066FF] dark:group-hover:text-blue-300 truncate">
                  {opt}
                </span>
              </div>
              <ArrowRight size={13} className="text-slate-400 group-hover:text-[#0066FF] group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
          );
        })}

        {/* Option D: Custom write-in recommendation input */}
        <div className={`p-2.5 sm:p-3 rounded-lg sm:rounded-xl border transition-all duration-200 ${
          isCustomActive 
            ? 'bg-white dark:bg-[#111728] border-[#0066FF] ring-2 ring-blue-500/20 shadow-xs' 
            : 'bg-white/80 dark:bg-[#111728]/80 border-slate-200/80 dark:border-slate-800'
        }`}>
          <div className="flex items-center space-x-2 mb-1.5">
            <span className="w-5 h-5 sm:w-5.5 sm:h-5.5 rounded-md sm:rounded-lg text-[11px] sm:text-xs font-mono font-bold flex items-center justify-center shrink-0 bg-blue-100 dark:bg-blue-950 text-[#0066FF] dark:text-blue-400">
              {customOptionLetter}
            </span>
            <span className="text-xs sm:text-[12.5px] font-medium text-slate-700 dark:text-slate-300 truncate">
              Custom Recommendation / Custom response:
            </span>
          </div>
          <form onSubmit={handleCustomSubmit} className="flex items-center gap-2 mt-1">
            <input
              type="text"
              value={customText}
              onFocus={() => setIsCustomActive(true)}
              onBlur={() => !customText && setIsCustomActive(false)}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Type your own custom requirements or style..."
              className="flex-1 px-3 py-1.5 rounded-lg text-xs sm:text-[13px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#0066FF]"
            />
            <button
              type="submit"
              disabled={!customText.trim()}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-[12.5px] font-semibold flex items-center space-x-1 transition-all cursor-pointer shrink-0 ${
                customText.trim()
                  ? 'bg-[#0066FF] hover:bg-blue-700 active:scale-95 text-white shadow-xs'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              <span>Submit</span>
              <ArrowRight size={12} />
            </button>
          </form>
        </div>

      </div>
    </div>
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

// ── Auto-scroll streaming code viewer ───────────────────────────
function StreamingCodeBox({ code, language, wrapCode = false }) {
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
      className="overflow-y-auto max-h-72 custom-scrollbar scroll-smooth w-full max-w-full min-w-0"
      style={{ overscrollBehaviorX: 'contain', touchAction: 'pan-x pan-y' }}
    >
      <div className="flex p-2.5 sm:p-3 font-mono text-[11px] sm:text-[11.5px] leading-relaxed w-full max-w-full min-w-0 overflow-hidden">
        {/* Line numbers */}
        <div className="shrink-0 select-none text-right pr-2 text-slate-400/60 dark:text-slate-600/80 font-mono text-[10px] sm:text-[10.5px] leading-relaxed" style={{ minWidth: '1.5rem' }}>
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        {/* Code content */}
        <div className="flex-1 overflow-x-auto min-w-0 max-w-full" style={{ overscrollBehaviorX: 'contain', touchAction: 'pan-x pan-y' }}>
          <pre className={`text-slate-800 dark:text-slate-200 font-mono block w-full ${wrapCode ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'}`}>{code}</pre>
        </div>
      </div>
    </div>
  );
}

// ── Professional Interactive Terminal & CLI Runner ───────────────
function ProfessionalTerminalWidget({ content, isExecuting }) {
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
      <div className="rounded-xl sm:rounded-2xl border border-slate-800/90 bg-[#080c16] text-slate-200 overflow-hidden font-mono text-xs shadow-md">
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-3.5 py-2 bg-[#05070e] border-b border-slate-800/80 select-none">
          <div className="flex items-center space-x-2">
            <Terminal size={13} className="text-[#0066FF] shrink-0" />
            <span className="text-[11.5px] font-semibold text-slate-200 font-mono">Terminal • PowerShell</span>
          </div>
          <span className="flex items-center space-x-1.5 text-[10.5px] text-blue-400 font-medium animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
            <span>Generating CLI commands...</span>
          </span>
        </div>
        {/* Terminal Body Skeleton */}
        <div className="p-3.5 space-y-2 text-[12px] bg-[#080c16]">
          <div className="flex items-center space-x-2 text-slate-500">
            <span className="text-[#0066FF] font-bold select-none">PS C:\workspace&gt;</span>
            <span className="w-2 h-4 bg-blue-400/80 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // Parse lines into structured blocks
  const lines = cleanText.split('\n');

  return (
    <div className="rounded-xl sm:rounded-2xl border border-slate-800/90 bg-[#080c16] text-slate-100 overflow-hidden font-mono text-xs shadow-lg">
      {/* Terminal Titlebar */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-[#05070e] border-b border-slate-800/80 select-none">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
          <span className="text-[11.5px] font-semibold text-slate-200 font-mono">PowerShell / Command Prompt</span>
          <span className="text-[10px] text-slate-400 px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 font-sans">
            Windows CLI
          </span>
        </div>
        <button
          onClick={handleCopyAll}
          className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-[#0066FF] dark:text-blue-400 border border-blue-500/30 text-[11px] font-sans font-semibold transition-all cursor-pointer active:scale-95 shadow-2xs"
          title="Copy full sequence to clipboard"
        >
          {copiedCmd === 'all' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
          <span>{copiedCmd === 'all' ? 'Copied Sequence!' : 'Copy Sequence'}</span>
        </button>
      </div>

      {/* Terminal Command Sequence Lines */}
      <div className="p-3 sm:p-3.5 space-y-2 overflow-x-auto max-h-64 custom-scrollbar text-[12px] leading-relaxed">
        {lines.map((line, lIdx) => {
          const trimmed = line.trim();
          if (!trimmed) return null;

          const isComment = trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith('rem ');
          if (isComment) {
            const commentText = trimmed.replace(/^[#\/rem\s]+/, '');
            return (
              <div key={lIdx} className="pt-1.5 first:pt-0 pb-0.5 flex items-center space-x-2 select-none">
                <span className="w-4 h-4 rounded flex items-center justify-center bg-blue-950/70 text-[#0066FF] dark:text-blue-400 text-[10px] font-mono font-bold border border-blue-900/50 shrink-0">
                  {lIdx + 1}
                </span>
                <span className="text-[11.5px] font-sans font-medium text-slate-300">{commentText}</span>
              </div>
            );
          }

          const isCopied = copiedCmd === lIdx;

          return (
            <div
              key={lIdx}
              className="group flex items-center justify-between gap-2 p-2 rounded-lg sm:rounded-xl bg-[#0d1322] border border-slate-800/80 hover:border-blue-500/40 transition-colors shadow-2xs"
            >
              <div className="flex items-center space-x-2 min-w-0 flex-1 overflow-x-auto custom-scrollbar">
                <span className="text-[#0066FF] font-bold select-none shrink-0 text-[11px]">PS &gt;</span>
                <code className="text-emerald-300 font-mono text-[12px] sm:text-[12.5px] whitespace-pre selection:bg-blue-500/40 font-medium">
                  {trimmed}
                </code>
              </div>
              <button
                onClick={() => handleCopySingle(trimmed, lIdx)}
                className={`px-2 py-1 rounded-md text-[10.5px] font-sans font-medium shrink-0 flex items-center space-x-1 transition-all cursor-pointer ${
                  isCopied
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80'
                    : 'bg-slate-800 hover:bg-[#0066FF] text-slate-300 hover:text-white border border-slate-700/60'
                }`}
                title="Copy this single command"
              >
                {isCopied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                <span>{isCopied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Node Status Icon Helper ──────────────────────────────────────
function NodeStatusIcon({ status, type }) {
  if (status === 'running') {
    return (
      <div className="w-4 h-4 sm:w-4.5 sm:h-4.5 rounded-full bg-blue-50 dark:bg-blue-950 border-1.5 sm:border-2 border-[#0066FF] flex items-center justify-center z-10 shadow-xs shadow-blue-500/20">
        <RefreshCw size={8} className="text-[#0066FF] animate-spin" />
      </div>
    );
  }
  if (status === 'completed') {
    return (
      <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 flex items-center justify-center z-10">
        <Check size={8} className="text-slate-600 dark:text-slate-300" strokeWidth={2.5} />
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 flex items-center justify-center z-10">
        <AlertTriangle size={8} className="text-rose-500" />
      </div>
    );
  }
  if (type === 'cannot_perform') {
    return (
      <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-amber-50 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 flex items-center justify-center z-10">
        <ShieldAlert size={8} className="text-amber-500" />
      </div>
    );
  }
  // Pending
  return (
    <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-center z-10">
      <div className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-500" />
    </div>
  );
}

// ── Main AgentTraceTree Component ────────────────────────────────
function AgentTraceTree({ traceData, isExecuting, onOpenPreview, onOpenIdePanel, onSendMessage }) {
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState({});
  const [wrapCodeNodes, setWrapCodeNodes] = useState({});
  const [isMinimized, setIsMinimized] = useState(!isExecuting);
  const [userToggled, setUserToggled] = useState(false);

  useEffect(() => {
    if (isExecuting) {
      setIsMinimized(false);
      setUserToggled(false);
    } else {
      // Auto close / collapse nodes as soon as execution completes
      setIsMinimized(true);
    }
  }, [isExecuting]);

  const handleToggleMinimize = () => {
    setUserToggled(true);
    setIsMinimized(prev => !prev);
  };

  const toggleNodeExpand = (index) => {
    setExpandedNodes(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const handleCopyCode = (code, index) => {
    navigator.clipboard.writeText(cleanCodeContent(code));
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (!traceData || !traceData.steps) return null;

  const pipelineSteps = traceData.steps.filter(s => s.type !== 'response' && s.type !== 'header');
  const responseStep = traceData.steps.find(s => s.type === 'response');
  const codeNode = pipelineSteps.find(s => s.type === 'code' || s.type === 'artifact');
  const clarNode = traceData.steps.find(s => s.type === 'clarification' || s.clarification);
  const hasCodeArtifact = !!(codeNode && codeNode.code);

  return (
    <div className="font-sans text-slate-800 dark:text-slate-200 my-1 w-full max-w-full overflow-hidden">

      {/* ── Active Thinking Indicator Before Graph Arrives ────── */}
      {pipelineSteps.length === 0 && isExecuting && (
        <div className="flex items-center space-x-2 py-1.5 px-0.5 select-none animate-fade-in">
          <div className="relative w-3.5 h-3.5 flex items-center justify-center shrink-0">
            <div className="absolute inset-0 rounded-full bg-blue-400/20 animate-ping" />
            <div className="w-1.5 h-1.5 rounded-full bg-[#0066FF]" />
          </div>
          <span className="text-xs font-medium text-[#0066FF] dark:text-blue-400">
            Thinking & designing execution plan...
          </span>
        </div>
      )}

      {/* ── Pipeline Header Bar ───────────────────────────────── */}
      {pipelineSteps.length > 0 && !clarNode && (
        <div className="mb-2.5 flex items-center justify-between px-1 select-none">
          <button
            onClick={handleToggleMinimize}
            className="flex items-center space-x-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors group cursor-pointer"
          >
            {isExecuting ? (
              <div className="flex items-center space-x-1.5">
                <div className="relative w-3.5 h-3.5 flex items-center justify-center shrink-0">
                  <div className="absolute inset-0 rounded-full bg-blue-400/20 animate-ping" />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#0066FF]" />
                </div>
                <span className="text-[#0066FF] dark:text-blue-400 font-semibold">Thinking & processing steps...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5">
                <Sparkles size={12} className="text-[#0066FF] shrink-0" />
                <span className="font-medium text-slate-600 dark:text-slate-400">
                  Thought process completed ({pipelineSteps.length} {pipelineSteps.length === 1 ? 'step' : 'steps'})
                </span>
                {isMinimized ? <ChevronRight size={11} className="text-slate-400" /> : <ChevronDown size={11} className="text-slate-400" />}
              </div>
            )}
          </button>
        </div>
      )}

      {/* ── Interactive Clarification / MCQ Card ───────────────── */}
      {clarNode && clarNode.clarification && (
        <ClarificationCard clarification={clarNode.clarification} onSendMessage={onSendMessage} />
      )}

      {/* ── Pipeline Steps / Execution Graph ───────────────────── */}
      {pipelineSteps.length > 0 && !clarNode && (
        <div className={`accordion-grid ${!isMinimized ? 'open mb-3 sm:mb-4' : 'mb-0'}`}>
          <div className="accordion-grid-inner">
            <div className="relative space-y-3.5 sm:space-y-4.5 pl-5 sm:pl-7 max-w-full overflow-hidden">
              {/* Vertical tree connector line */}
              <div className="absolute left-[7.5px] sm:left-[9.5px] top-3 bottom-3 w-[1.5px] bg-slate-200/90 dark:bg-slate-800/90" />

              {pipelineSteps.map((step, idx) => {
                // If currently executing, hide nodes that haven't started yet so they appear one by one with fade-up
                if (isExecuting && step.status === 'pending') return null;

                const isExpanded = expandedNodes[idx] !== undefined
                  ? expandedNodes[idx]
                  : (isExecuting && step.status === 'running');
                const revealDelay = { animationDelay: '50ms' };

                // ── 1. CANNOT PERFORM / REFUSAL NODE ──────────────────
                if (step.type === 'cannot_perform') {
                  return (
                    <div key={idx} style={revealDelay} className="relative animate-step-reveal">
                      <div className="absolute -left-[18px] sm:-left-[26px] top-0.5 sm:top-1">
                        <NodeStatusIcon status="error" type="cannot_perform" />
                      </div>
                      <div className="p-3 sm:p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-300 animate-smooth-expand">
                        <div className="flex items-center space-x-1.5 font-semibold mb-1">
                          <ShieldAlert size={13} className="text-amber-600 dark:text-amber-400" />
                          <span>{step.name || 'Capability Boundary Refusal'}</span>
                        </div>
                        <p className="leading-relaxed opacity-95">{step.content}</p>
                      </div>
                    </div>
                  );
                }

                // ── 2. THINKING / ARCHITECTURE NODE ───────────────────
                if (step.type === 'thinking') {
                  return (
                    <div key={idx} style={revealDelay} className="relative animate-step-reveal font-sans">
                      <div className="absolute -left-[18px] sm:-left-[26px] top-0.5 sm:top-1">
                        <NodeStatusIcon status={step.status || 'completed'} type="thinking" />
                      </div>

                      <div>
                        <button
                          onClick={() => toggleNodeExpand(idx)}
                          className="flex items-center space-x-1.5 sm:space-x-2 py-0.5 group cursor-pointer select-none text-left"
                        >
                          <Brain size={13.5} className="text-[#0066FF] dark:text-blue-400 shrink-0" />
                          <span className="text-xs sm:text-[13px] font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">
                            {step.name === 'Dynamic Graph Architecture' ? 'Intelligent Strategy & Execution Plan' : (step.name || 'Execution Plan')}
                          </span>
                          {step.totalPlannedNodes > 0 && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/80 text-[#0066FF] dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/50 font-semibold">
                              {step.totalPlannedNodes} Stages
                            </span>
                          )}
                          <span className="transition-transform duration-300 ease-out inline-flex">
                            {isExpanded ? <ChevronDown size={11} className="text-slate-400" /> : <ChevronRight size={11} className="text-slate-400" />}
                          </span>
                        </button>

                        <div className={`accordion-grid ${isExpanded ? 'open mt-2 sm:mt-2.5 mb-1' : 'mt-0'}`}>
                          <div className="accordion-grid-inner">
                            <div className="space-y-3 text-[12.5px] sm:text-[13.5px] leading-relaxed text-slate-700 dark:text-slate-300 bg-slate-50/90 dark:bg-slate-900/60 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 border border-slate-200/90 dark:border-slate-800 max-h-60 overflow-y-auto custom-scrollbar font-sans shadow-2xs">
                              {step.content && (
                                <p className="leading-relaxed">{step.content}</p>
                              )}
                              
                              {step.executionPlanSummary && (
                                <div className="p-2.5 rounded-xl bg-white dark:bg-[#0c0f18] border border-slate-200/80 dark:border-slate-800/80 shadow-2xs">
                                  <div className="flex items-center space-x-1.5 text-[#0066FF] dark:text-blue-400 font-semibold text-xs mb-1">
                                    <Sparkles size={12} />
                                    <span>Plan Strategy</span>
                                  </div>
                                  <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-[12.5px] leading-relaxed">
                                    {step.executionPlanSummary}
                                  </p>
                                </div>
                              )}

                              {step.doneStateCriteria && (
                                <div className="flex items-start space-x-2 p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/40 text-xs sm:text-[12.5px] text-emerald-900 dark:text-emerald-300">
                                  <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                  <div>
                                    <span className="font-semibold block mb-0.5 text-emerald-800 dark:text-emerald-300">Success Goal</span>
                                    <span>{step.doneStateCriteria}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                // ── 2.5. VISION / SCREENSHOT INSPECTOR NODE ───────────
                if (step.type === 'vision') {
                  return (
                    <div key={idx} style={revealDelay} className="relative animate-step-reveal font-sans">
                      <div className="absolute -left-[18px] sm:-left-[26px] top-0.5 sm:top-1">
                        <NodeStatusIcon status={step.status} type="vision" />
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                          <button
                            onClick={() => toggleNodeExpand(idx)}
                            className="flex items-center space-x-1.5 text-left group cursor-pointer select-none font-sans py-0.5"
                          >
                            <Eye size={13} className="text-[#0066FF] dark:text-blue-400 shrink-0" />
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">
                              {step.name || 'Visual Inspection & OCR'}
                            </span>
                            <span className="transition-transform duration-300 ease-out inline-flex shrink-0">
                              {isExpanded ? <ChevronDown size={10} className="text-slate-400" /> : <ChevronRight size={10} className="text-slate-400" />}
                            </span>
                          </button>

                          {step.status === 'running' && (
                            <span className="text-[10px] text-blue-500 font-medium animate-pulse shrink-0 font-sans">Scanning image...</span>
                          )}
                          {step.status === 'completed' && (
                            <span className="text-[9.5px] text-emerald-600 dark:text-emerald-400 font-medium px-1.5 py-0.2 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-900/40 shrink-0 font-sans">
                              Verified
                            </span>
                          )}
                        </div>

                        <div className={`accordion-grid ${isExpanded ? 'open mt-2 sm:mt-2.5 mb-1' : 'mt-0'}`}>
                          <div className="accordion-grid-inner">
                            <div className="space-y-2.5 bg-slate-50/80 dark:bg-slate-900/50 rounded-xl p-3 sm:p-3.5 border border-slate-200/80 dark:border-slate-800 font-sans shadow-2xs">
                              {step.image && (
                                <div className="relative inline-block rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xs max-w-xs">
                                  <img src={step.image} alt="Uploaded screenshot" className="max-h-40 w-auto object-contain bg-slate-900/10 rounded-lg" />
                                </div>
                              )}

                              {step.content && (
                                <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                                  <MarkdownRenderer content={step.content} />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                // ── 3. SEARCH NODE (TAVILY REAL-TIME SEARCH) ──────────
                if (step.type === 'search' || step.type === 'tool_search') {
                  return (
                    <div key={idx} style={revealDelay} className="relative animate-step-reveal font-sans">
                      <div className="absolute -left-[18px] sm:-left-[26px] top-0.5 sm:top-1">
                        <NodeStatusIcon status={step.status} type="search" />
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                          <button
                            onClick={() => toggleNodeExpand(idx)}
                            className="flex items-center space-x-1.5 text-left group cursor-pointer select-none font-sans py-0.5"
                          >
                            <Search size={13} className="text-[#0066FF] dark:text-blue-400 shrink-0" />
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">
                              {step.name || 'Web Research'}
                            </span>
                            {step.canParallel && (
                              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0 font-sans">
                                Parallel
                              </span>
                            )}
                            <span className="transition-transform duration-300 ease-out inline-flex shrink-0">
                              {isExpanded ? <ChevronDown size={10} className="text-slate-400" /> : <ChevronRight size={10} className="text-slate-400" />}
                            </span>
                          </button>

                          {step.status === 'running' && (
                            <span className="text-[10px] text-blue-500 font-medium animate-pulse shrink-0 font-sans">Searching live...</span>
                          )}
                          {step.status === 'completed' && step.results?.length > 0 && (
                            <span className="text-[9.5px] text-emerald-600 dark:text-emerald-400 font-medium px-1.5 py-0.2 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-900/40 shrink-0 font-sans">
                              {step.results.length} sources
                            </span>
                          )}
                        </div>

                        <div className={`accordion-grid ${isExpanded ? 'open mt-2 sm:mt-2.5 mb-1' : 'mt-0'}`}>
                          <div className="accordion-grid-inner">
                            <div className="space-y-2.5 bg-slate-50/80 dark:bg-slate-900/50 rounded-xl p-3 sm:p-3.5 border border-slate-200/80 dark:border-slate-800 font-sans shadow-2xs">
                              {step.query && (
                                <div className="text-xs px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 inline-flex items-center space-x-1.5 border border-slate-200/60 dark:border-slate-700/60 shadow-2xs font-sans">
                                  <Search size={11} className="text-[#0066FF] dark:text-blue-400 shrink-0" />
                                  <span className="text-slate-500 dark:text-slate-400 font-normal">Query:</span>
                                  <span className="font-medium text-slate-800 dark:text-slate-200">"{step.query}"</span>
                                </div>
                              )}

                              {/* Search Results List */}
                              {step.results?.length > 0 && (
                                <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0c0f17] overflow-hidden shadow-2xs divide-y divide-slate-100 dark:divide-slate-800/60 max-h-56 overflow-y-auto custom-scrollbar font-sans">
                                  {step.results.map((result, rIdx) => {
                                    const cleanSnippet = result.snippet 
                                      ? result.snippet.replace(/#{1,6}\s*/g, '').replace(/\s+/g, ' ').trim()
                                      : '';

                                    return (
                                      <a
                                        key={rIdx}
                                        href={result.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-start px-3 py-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group font-sans"
                                      >
                                        <FaviconIcon src={result.favicon} domain={result.domain} />
                                        <div className="flex-1 min-w-0 pr-1.5">
                                          <div className="flex items-center space-x-1.5 mb-0.5">
                                            <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate font-medium">{result.domain}</span>
                                            {result.source === 'tavily' && (
                                              <span className="text-[9px] px-1 rounded bg-blue-50 dark:bg-blue-950/80 text-[#0066FF] font-semibold">Verified</span>
                                            )}
                                          </div>
                                          <p className="font-medium text-slate-800 dark:text-slate-200 truncate group-hover:text-[#0066FF] transition-colors text-xs leading-snug">
                                            {result.title}
                                          </p>
                                          {cleanSnippet && (
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed font-normal">
                                              {cleanSnippet}
                                            </p>
                                          )}
                                        </div>
                                        <ExternalLink size={11} className="shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 mt-0.5" />
                                      </a>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                // ── 4. CODE GENERATION NODE ───────────────────────────
                if (step.type === 'code' || step.type === 'artifact') {
                  const langTag = (step.language || 'code').toUpperCase();
                  const cleanedCode = cleanCodeContent(step.code);
                  const isPreviewable = step.language === 'html' || (cleanedCode && (cleanedCode.includes('<!DOCTYPE') || cleanedCode.includes('<html')));
                  const lineCount = cleanedCode ? cleanedCode.split('\n').length : 0;

                  const isWrapped = !!wrapCodeNodes[idx];

                  return (
                    <div key={idx} style={revealDelay} className="relative animate-step-reveal font-sans">
                      <div className="absolute -left-[18px] sm:-left-[26px] top-0.5 sm:top-1">
                        <NodeStatusIcon status={step.status} type="code" />
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-x-1.5 gap-y-1 mb-1.5">
                          <div className="flex items-center space-x-1.5 min-w-0 py-0.5">
                            <Code2 size={13} className="text-[#0066FF] dark:text-blue-400 shrink-0" />
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                              {step.name || 'Source Code'}
                            </span>
                            <span className="px-1 py-0.2 rounded bg-blue-50 dark:bg-blue-950/60 text-[#0066FF] dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/60 font-mono text-[9px] font-bold uppercase shrink-0">
                              {langTag}
                            </span>
                            {lineCount > 0 && (
                              <span className="text-[9.5px] text-slate-400 dark:text-slate-500 font-mono shrink-0 hidden xs:inline">{lineCount} lines</span>
                            )}
                          </div>

                          {/* Unified Modern Button Group */}
                          <div className="flex items-center space-x-1 shrink-0">
                            {cleanedCode && (
                              <button
                                onClick={() => setWrapCodeNodes(prev => ({ ...prev, [idx]: !prev[idx] }))}
                                className={`px-1.5 py-0.5 rounded-md text-[10px] sm:text-[10.5px] font-medium transition-all shadow-2xs cursor-pointer border ${
                                  isWrapped
                                    ? 'bg-blue-100 dark:bg-blue-950/80 text-[#0066FF] dark:text-blue-400 border-blue-200 dark:border-blue-800'
                                    : 'bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/60'
                                }`}
                                title={isWrapped ? "Disable Word Wrap" : "Enable Word Wrap"}
                              >
                                <span>{isWrapped ? 'Wrap: On' : 'Wrap: Off'}</span>
                              </button>
                            )}
                            {onOpenIdePanel && cleanedCode && (
                              <button
                                onClick={() => onOpenIdePanel(cleanedCode, step.title || step.name, step.language)}
                                className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-blue-50/80 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 text-[#0066FF] dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40 text-[10px] sm:text-[10.5px] font-medium transition-all shadow-2xs cursor-pointer active:scale-95"
                                title="Open Code Canvas"
                              >
                                <Code2 size={10} />
                                <span>Canvas</span>
                              </button>
                            )}
                            <button
                              onClick={() => handleCopyCode(cleanedCode, idx)}
                              className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/60 text-[10px] sm:text-[10.5px] font-medium transition-all shadow-2xs cursor-pointer active:scale-95"
                              title="Copy Code"
                            >
                              {copiedIndex === idx ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
                              <span>{copiedIndex === idx ? 'Copied' : 'Copy'}</span>
                            </button>
                            {isPreviewable && onOpenPreview && cleanedCode && (
                              <button
                                onClick={() => onOpenPreview(cleanedCode, step.title || step.name)}
                                className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-[#0066FF] hover:bg-blue-700 text-white text-[10px] sm:text-[10.5px] font-medium transition-all shadow-xs cursor-pointer active:scale-95"
                                title="Live Preview"
                              >
                                <Play size={9} fill="currentColor" />
                                <span>Preview</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Code Container */}
                        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 overflow-hidden bg-[#f8fafc] dark:bg-[#090c12] shadow-2xs">
                          {step.status === 'error' ? (
                            <div className="flex items-center space-x-2 px-3 py-2 text-rose-500 text-xs">
                              <AlertTriangle size={12} />
                              <span>Code generation interrupted. Retrying with fallback...</span>
                            </div>
                          ) : (step.code && step.code.trim()) ? (
                            <StreamingCodeBox code={cleanCodeContent(step.code) || step.code} language={step.language} wrapCode={isWrapped} />
                          ) : (
                            <div className="flex items-center space-x-2 px-3 py-2">
                              <RefreshCw size={11} className="text-blue-400 animate-spin" />
                              <span className="text-[10.5px] text-slate-500 dark:text-slate-400">Generating code...</span>
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  );
                }

                // ── 4.5. CMD / TERMINAL RUNNER NODE ───────────────────
                if (step.type === 'cmd' || step.type === 'terminal') {
                  return (
                    <div key={idx} style={revealDelay} className="relative animate-step-reveal font-sans">
                      <div className="absolute -left-[18px] sm:-left-[26px] top-0.5 sm:top-1">
                        <NodeStatusIcon status={step.status} type="cmd" />
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-x-1.5 gap-y-1 mb-1.5">
                          <button
                            onClick={() => toggleNodeExpand(idx)}
                            className="flex items-center space-x-1.5 py-0.5 group cursor-pointer select-none text-left"
                          >
                            <Terminal size={13.5} className="text-[#0066FF] dark:text-blue-400 shrink-0" />
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white truncate">
                              {step.name || 'Terminal Runner & Setup'}
                            </span>
                            <span className="px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-950/80 text-[#0066FF] dark:text-blue-400 font-mono text-[9px] font-bold uppercase shrink-0 border border-blue-200/60 dark:border-blue-800/50">
                              PowerShell
                            </span>
                            <span className="transition-transform duration-300 ease-out inline-flex">
                              {isExpanded ? <ChevronDown size={10} className="text-slate-400" /> : <ChevronRight size={10} className="text-slate-400" />}
                            </span>
                          </button>
                        </div>

                        <div className={`accordion-grid ${isExpanded ? 'open mt-1.5 mb-1' : 'mt-0'}`}>
                          <div className="accordion-grid-inner">
                            <ProfessionalTerminalWidget content={step.content} isExecuting={isExecuting && step.status === 'running'} />
                          </div>
                        </div>

                      </div>
                    </div>
                  );
                }

                // ── 5. SYNTHESIS NODE (COMPACT DELIVERABLE) ─────────
                if (step.type === 'synthesis') {
                  return (
                    <div key={idx} style={revealDelay} className="relative animate-step-reveal font-sans">
                      <div className="absolute -left-[18px] sm:-left-[26px] top-0.5 sm:top-1">
                        <NodeStatusIcon status={step.status} type="synthesis" />
                      </div>
                      <div className="flex items-center space-x-1.5 py-1 max-w-full">
                        <Sparkles size={13} className="text-[#0066FF] dark:text-blue-400 shrink-0" />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                          {step.name || 'Synthesis & Final Deliverable'}
                        </span>
                        {step.status === 'running' && (
                          <span className="text-[9px] text-[#0066FF] dark:text-blue-400 font-medium px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-950 font-mono animate-pulse">
                            Generating...
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }

                // ── 6. ANALYSIS / GENERAL NODE ────────────────────────
                return (
                  <div key={idx} style={revealDelay} className="relative animate-step-reveal font-sans">
                    <div className="absolute -left-[18px] sm:-left-[26px] top-0.5 sm:top-1">
                      <NodeStatusIcon status={step.status} type={step.type} />
                    </div>

                    <div>
                      <button
                        onClick={() => toggleNodeExpand(idx)}
                        className="flex items-center space-x-1.5 mb-1 group cursor-pointer select-none text-left py-0.5"
                      >
                        <Sparkles size={13} className="text-[#0066FF] dark:text-blue-400" />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">
                          {step.name || 'Stage Analysis & Execution'}
                        </span>
                        <span className="transition-transform duration-300 ease-out inline-flex">
                          {isExpanded ? <ChevronDown size={10} className="text-slate-400" /> : <ChevronRight size={10} className="text-slate-400" />}
                        </span>
                      </button>

                      <div className={`accordion-grid ${isExpanded ? 'open mt-2 sm:mt-2.5 mb-1' : 'mt-0'}`}>
                        <div className="accordion-grid-inner">
                          <div className="space-y-2 text-xs leading-relaxed text-slate-700 dark:text-slate-300 bg-slate-50/80 dark:bg-slate-900/50 rounded-xl p-3 sm:p-3.5 border border-slate-200/80 dark:border-slate-800 font-sans shadow-2xs">
                            {step.content && (
                              <MarkdownRenderer content={step.content} />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Final Synthesis & Combined Response ────────────────── */}
      {responseStep && (
        responseStep.content ? (
          <div className="pt-2 animate-step-reveal">
            <div className="text-[14.5px] sm:text-[15.5px] md:text-[16px] leading-relaxed text-slate-800 dark:text-slate-200 font-sans">
              <MarkdownRenderer content={responseStep.content} />
            </div>
          </div>
        ) : isExecuting && pipelineSteps.length > 0 && pipelineSteps.every(s => s.status === 'completed') ? (
          <div className="pt-2.5 flex items-center space-x-2 text-slate-500 dark:text-slate-400 animate-pulse text-xs select-none">
            <Sparkles size={13} className="text-[#0066FF] animate-spin shrink-0" />
            <span className="font-medium text-slate-600 dark:text-slate-300">Generating comprehensive response...</span>
          </div>
        ) : null
      )}

      {/* ── Clean & Minimalist Canvas Artifact Card ────────────────── */}
      {!isExecuting && hasCodeArtifact && onOpenIdePanel && (() => {
        const cleanedCode = cleanCodeContent(codeNode.code);

        return (
          <div 
            onClick={() => onOpenIdePanel(cleanedCode, codeNode.title || 'Code Artifact', codeNode.language)}
            className="mt-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-white dark:bg-[#0e1322] border border-slate-200/90 dark:border-slate-800 hover:border-blue-500/60 dark:hover:border-blue-500/60 shadow-2xs hover:shadow-xs transition-all duration-200 flex items-center justify-between gap-2.5 cursor-pointer group animate-step-reveal select-none"
          >
            <div className="flex items-center space-x-2 min-w-0 truncate">
              <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-950/70 text-[#0066FF] dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-900/40">
                <Code2 size={13} />
              </div>
              <div className="flex items-center space-x-1.5 min-w-0 truncate">
                <span className="text-[11.5px] sm:text-xs font-semibold text-slate-900 dark:text-slate-100 group-hover:text-[#0066FF] dark:group-hover:text-blue-400 transition-colors truncate">
                  {codeNode.title || 'Code Artifact'}
                </span>
                <span className="text-[9.5px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-mono uppercase shrink-0">
                  • {codeNode.language || 'code'}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-1 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyCode(codeNode.code, 'banner-copy');
                }}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Copy code"
              >
                {copiedIndex === 'banner-copy' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
              </button>

              <button
                type="button"
                onClick={() => onOpenIdePanel(cleanedCode, codeNode.title || 'Code Artifact', codeNode.language)}
                className="flex items-center space-x-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md bg-[#0066FF] hover:bg-blue-700 active:scale-95 text-white text-[10.5px] sm:text-[11px] font-medium transition-all shadow-2xs cursor-pointer shrink-0"
              >
                <Code2 size={10} />
                <span>Open Canvas</span>
              </button>
            </div>
          </div>
        );
      })()}

    </div>
  );
}

export default memo(AgentTraceTree);

