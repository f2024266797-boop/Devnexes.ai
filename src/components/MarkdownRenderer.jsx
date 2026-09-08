import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Copy, 
  Check, 
  ExternalLink, 
  Info, 
  Lightbulb, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert,
  Terminal,
  FileText
} from 'lucide-react';

function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);
  const [wrapCode, setWrapCode] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const langTag = (language || 'code').toLowerCase();

  return (
    <div className="relative my-3 sm:my-4 rounded-xl sm:rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-[#f8fafc] dark:bg-[#0b0e17] shadow-xs overflow-hidden font-mono text-[13px] sm:text-[14px] w-full max-w-full min-w-0 box-border">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-3.5 sm:px-4 py-2 bg-slate-100/90 dark:bg-[#080a11] border-b border-slate-200/90 dark:border-slate-800/90 text-xs shrink-0 select-none">
        <div className="flex items-center space-x-2">
          <Terminal size={13} className="text-[#0066FF] dark:text-blue-400 shrink-0" />
          <span className="text-[#0066FF] dark:text-blue-400 font-bold uppercase tracking-wider font-sans text-[11px] sm:text-xs">
            {langTag}
          </span>
        </div>

        <div className="flex items-center space-x-1.5 font-sans">
          <button
            type="button"
            onClick={() => setWrapCode(prev => !prev)}
            className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
              wrapCode 
                ? 'bg-blue-100 dark:bg-blue-950/80 text-[#0066FF] dark:text-blue-400' 
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
            title={wrapCode ? "Disable Word Wrap" : "Enable Word Wrap"}
          >
            {wrapCode ? 'Wrap: On' : 'Wrap: Off'}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer text-xs font-medium"
          >
            {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Code Content */}
      <div 
        className="p-3.5 sm:p-4.5 overflow-x-auto w-full max-w-full min-w-0 text-slate-800 dark:text-slate-200 leading-relaxed custom-scrollbar font-mono text-[12.5px] sm:text-[13.5px]"
        style={{ overscrollBehaviorX: 'contain', touchAction: 'pan-x pan-y' }}
      >
        <pre className={`font-mono block w-full max-w-full ${wrapCode ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'}`}>
          {code}
        </pre>
      </div>
    </div>
  );
}

function CalloutBox({ type = 'note', children }) {
  const configs = {
    note: {
      border: 'border-blue-500/40 dark:border-blue-500/50',
      bg: 'bg-blue-50/60 dark:bg-blue-950/30',
      text: 'text-blue-900 dark:text-blue-200',
      icon: <Info size={16} className="text-[#0066FF] dark:text-blue-400 shrink-0 mt-0.5" />,
      label: 'Note'
    },
    tip: {
      border: 'border-emerald-500/40 dark:border-emerald-500/50',
      bg: 'bg-emerald-50/60 dark:bg-emerald-950/30',
      text: 'text-emerald-900 dark:text-emerald-200',
      icon: <Lightbulb size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />,
      label: 'Tip'
    },
    warning: {
      border: 'border-amber-500/40 dark:border-amber-500/50',
      bg: 'bg-amber-50/60 dark:bg-amber-950/30',
      text: 'text-amber-900 dark:text-amber-200',
      icon: <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />,
      label: 'Warning'
    },
    important: {
      border: 'border-indigo-500/40 dark:border-indigo-500/50',
      bg: 'bg-indigo-50/60 dark:bg-indigo-950/30',
      text: 'text-indigo-900 dark:text-indigo-200',
      icon: <CheckCircle2 size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />,
      label: 'Important'
    },
    caution: {
      border: 'border-rose-500/40 dark:border-rose-500/50',
      bg: 'bg-rose-50/60 dark:bg-rose-950/30',
      text: 'text-rose-900 dark:text-rose-200',
      icon: <ShieldAlert size={16} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />,
      label: 'Caution'
    }
  };

  const cfg = configs[type.toLowerCase()] || configs.note;

  return (
    <div className={`my-3 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border ${cfg.border} ${cfg.bg} flex items-start space-x-3 transition-all shadow-2xs`}>
      {cfg.icon}
      <div className={`flex-1 min-w-0 text-[13.5px] sm:text-[14.5px] leading-relaxed ${cfg.text}`}>
        {children}
      </div>
    </div>
  );
}

function MarkdownRenderer({ content }) {
  if (!content) return null;

  return (
    <div className="markdown-body font-sans text-[14.5px] sm:text-[15.5px] md:text-[16px] leading-relaxed text-slate-800 dark:text-slate-100 space-y-2 sm:space-y-3 w-full max-w-full min-w-0 overflow-hidden">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="font-lustria text-[19px] sm:text-[22px] font-bold text-slate-900 dark:text-white mt-4 mb-2 pb-1.5 border-b border-slate-200/90 dark:border-slate-800 flex items-center space-x-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0066FF] inline-block shrink-0 shadow-sm"></span>
              <span>{children}</span>
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-lustria text-[17px] sm:text-[19.5px] font-bold text-slate-900 dark:text-white mt-3.5 mb-1.5 flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-[#0066FF] inline-block shrink-0"></span>
              <span>{children}</span>
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-lustria text-[15px] sm:text-[17px] font-bold text-slate-800 dark:text-slate-100 mt-2.5 mb-1">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-slate-700 dark:text-slate-200 leading-relaxed my-1.5 sm:my-2">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="space-y-1.5 sm:space-y-2 my-2 pl-2">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside space-y-1.5 sm:space-y-2 my-2 pl-5 text-slate-700 dark:text-slate-200">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-slate-700 dark:text-slate-200 leading-relaxed">
              {children}
            </li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-slate-900 dark:text-white">
              {children}
            </strong>
          ),
          code: ({ node, inline, className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');

            if (!inline && match) {
              return <CodeBlock language={match[1]} code={codeString} />;
            } else if (!inline && codeString.includes('\n')) {
              return <CodeBlock language="text" code={codeString} />;
            }

            return (
              <code className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[#0066FF] dark:text-blue-300 text-[12.5px] sm:text-[13.5px] font-mono border border-slate-200 dark:border-slate-700/80 font-medium">
                {children}
              </code>
            );
          },
          blockquote: ({ children }) => {
            // Check if blockquote starts with alert identifiers like [!NOTE], [!TIP], etc.
            const rawText = React.Children.toArray(children)
              .map(c => (typeof c === 'string' ? c : c?.props?.children || ''))
              .join(' ');

            if (/^\[!(NOTE|INFO)\]/i.test(rawText)) {
              return <CalloutBox type="note">{children}</CalloutBox>;
            }
            if (/^\[!TIP\]/i.test(rawText)) {
              return <CalloutBox type="tip">{children}</CalloutBox>;
            }
            if (/^\[!WARNING\]/i.test(rawText)) {
              return <CalloutBox type="warning">{children}</CalloutBox>;
            }
            if (/^\[!IMPORTANT\]/i.test(rawText)) {
              return <CalloutBox type="important">{children}</CalloutBox>;
            }
            if (/^\[!CAUTION\]/i.test(rawText)) {
              return <CalloutBox type="caution">{children}</CalloutBox>;
            }

            return (
              <blockquote className="my-2.5 sm:my-3 pl-4 py-1.5 border-l-3 border-[#0066FF] bg-slate-50/90 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 rounded-r-xl text-[14px] sm:text-[15px] italic leading-relaxed">
                {children}
              </blockquote>
            );
          },
          table: ({ children }) => (
            <div className="my-3.5 sm:my-4.5 overflow-x-auto rounded-xl sm:rounded-2xl border border-slate-200/90 dark:border-slate-800/90 shadow-2xs max-w-full bg-white dark:bg-[#0b0e17]">
              <table className="w-full text-[13px] sm:text-[14px] md:text-[14.5px] text-left text-slate-700 dark:text-slate-300 border-collapse">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-100/90 dark:bg-slate-900/90 text-slate-900 dark:text-white font-semibold border-b border-slate-200 dark:border-slate-800">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-colors">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-4.5 py-3 text-[12px] sm:text-[13px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 whitespace-nowrap bg-slate-100/90 dark:bg-slate-800/90">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4.5 py-3 sm:py-3.5 text-[13px] sm:text-[14px] md:text-[14.5px] leading-relaxed align-top">
              {children}
            </td>
          ),
          hr: () => (
            <hr className="my-4 sm:my-5 border-0 h-[1px] bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-700 to-transparent" />
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-[#0066FF] dark:text-blue-400 hover:underline font-medium inline-flex items-center space-x-0.5"
            >
              <span>{children}</span>
              <ExternalLink size={12} className="inline ml-0.5 opacity-70" />
            </a>
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default React.memo(MarkdownRenderer);
