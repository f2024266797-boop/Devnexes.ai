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
  Columns
} from 'lucide-react';

// ── Recursive helper to safely convert literal <br> strings into React <br /> tags ──
function parseBreaks(node) {
  if (node == null) return null;
  if (typeof node === 'string') {
    if (!/<br\s*\/?>/i.test(node)) return node;
    const parts = node.split(/<br\s*\/?>/gi);
    return parts.map((part, i) => (
      <React.Fragment key={i}>
        {i > 0 && <br />}
        {part}
      </React.Fragment>
    ));
  }
  if (Array.isArray(node)) {
    return node.map((child, idx) => (
      <React.Fragment key={idx}>{parseBreaks(child)}</React.Fragment>
    ));
  }
  if (React.isValidElement(node) && node.props && node.props.children) {
    return React.cloneElement(node, {
      children: parseBreaks(node.props.children)
    });
  }
  return node;
}

function CodeBlock({ language, code, onOpenIdePanel }) {
  const [copied, setCopied] = useState(false);
  const [wrapCode, setWrapCode] = useState(false);
  const lineCount = (code || '').split('\n').length;
  const isLongCode = lineCount > 15;
  const [isExpandedInChat, setIsExpandedInChat] = useState(!isLongCode);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const langTag = (language || 'code').toLowerCase();

  return (
    <div className="relative my-3 sm:my-4 rounded-xl border border-neutral-200/90 dark:border-neutral-800 bg-[#f8fafc] dark:bg-[#0c0e14] shadow-xs overflow-hidden font-mono text-[13px] w-full max-w-full min-w-0 box-border">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-3.5 sm:px-4 py-2 bg-neutral-100/80 dark:bg-[#090b10] border-b border-neutral-200/80 dark:border-neutral-800 text-xs shrink-0 select-none">
        <div className="flex items-center space-x-2">
          <Terminal size={12.5} className="text-neutral-500 dark:text-neutral-400 shrink-0" />
          <span className="text-neutral-700 dark:text-neutral-300 font-semibold uppercase tracking-wider font-sans text-[11px]">
            {langTag}
          </span>
          <span className="text-neutral-400 dark:text-neutral-500 font-sans text-[11px]">
            • {lineCount} lines
          </span>
        </div>

        <div className="flex items-center space-x-1 sm:space-x-1.5 font-sans">
          {onOpenIdePanel && (
            <button
              type="button"
              onClick={() => onOpenIdePanel(code, `${(language || 'code').toUpperCase()} Snippet`, language)}
              className="flex items-center space-x-1 px-1.5 sm:px-2 py-0.5 rounded text-[11px] font-medium text-[#0066FF] dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors cursor-pointer"
              title="Open in Code Canvas Side Bar"
            >
              <Columns size={12} className="shrink-0" />
              <span className="hidden sm:inline">Side Bar</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setWrapCode(prev => !prev)}
            className={`px-1.5 sm:px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${wrapCode
                ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100'
                : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800'
              }`}
            title={wrapCode ? "Disable Word Wrap" : "Enable Word Wrap"}
          >
            <span className="hidden sm:inline">{wrapCode ? 'Wrap: On' : 'Wrap: Off'}</span>
            <span className="sm:hidden">{wrapCode ? 'Wrap' : 'No Wrap'}</span>
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center space-x-1 px-2 sm:px-2.5 py-0.5 rounded text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 transition-colors cursor-pointer text-xs font-medium"
          >
            {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Code Content */}
      <div
        className="p-3.5 sm:p-4 overflow-x-auto w-full max-w-full min-w-0 text-neutral-800 dark:text-neutral-200 leading-relaxed custom-scrollbar font-mono text-[12.5px] sm:text-[13px] relative"
        style={{ overscrollBehaviorX: 'contain', touchAction: 'pan-x pan-y' }}
      >
        {isLongCode && !isExpandedInChat ? (
          <div>
            <pre className={`font-mono block w-full max-w-full ${wrapCode ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'} max-h-[160px] overflow-hidden opacity-75`}>
              {code.split('\n').slice(0, 8).join('\n')}
            </pre>
            <div className="absolute inset-x-0 bottom-0 pt-10 pb-3.5 bg-gradient-to-t from-[#f8fafc] via-[#f8fafc]/95 dark:from-[#0c0e14] dark:via-[#0c0e14]/95 to-transparent flex flex-wrap items-center justify-center gap-2 select-none">
              {onOpenIdePanel && (
                <button
                  type="button"
                  onClick={() => onOpenIdePanel(code, `${(language || 'code').toUpperCase()} Code`, language)}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#0066FF] hover:bg-blue-600 text-white text-xs font-medium shadow-xs transition-all cursor-pointer active:scale-95"
                >
                  <Columns size={12.5} />
                  <span>Open in Side Bar ({lineCount} lines)</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsExpandedInChat(true)}
                className="px-2.5 py-1.5 rounded-lg text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/70 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                Expand in chat
              </button>
            </div>
          </div>
        ) : (
          <div>
            <pre className={`font-mono block w-full max-w-full ${wrapCode ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'}`}>
              {code}
            </pre>
            {isLongCode && (
              <div className="mt-2 pt-2 border-t border-neutral-200/60 dark:border-neutral-800 flex items-center justify-between text-[11px] text-neutral-500 select-none">
                <span>{lineCount} lines</span>
                <button
                  type="button"
                  onClick={() => setIsExpandedInChat(false)}
                  className="hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer underline"
                >
                  Collapse snippet
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CalloutBox({ type = 'note', children }) {
  const configs = {
    note: {
      border: 'border-blue-500/30 dark:border-blue-500/40',
      bg: 'bg-blue-50/50 dark:bg-blue-950/20',
      text: 'text-blue-950 dark:text-blue-200',
      icon: <Info size={15} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />,
      label: 'Note'
    },
    tip: {
      border: 'border-emerald-500/30 dark:border-emerald-500/40',
      bg: 'bg-emerald-50/50 dark:bg-emerald-950/20',
      text: 'text-emerald-950 dark:text-emerald-200',
      icon: <Lightbulb size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />,
      label: 'Tip'
    },
    warning: {
      border: 'border-amber-500/30 dark:border-amber-500/40',
      bg: 'bg-amber-50/50 dark:bg-amber-950/20',
      text: 'text-amber-950 dark:text-amber-200',
      icon: <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />,
      label: 'Warning'
    },
    important: {
      border: 'border-indigo-500/30 dark:border-indigo-500/40',
      bg: 'bg-indigo-50/50 dark:bg-indigo-950/20',
      text: 'text-indigo-950 dark:text-indigo-200',
      icon: <CheckCircle2 size={15} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />,
      label: 'Important'
    },
    caution: {
      border: 'border-rose-500/30 dark:border-rose-500/40',
      bg: 'bg-rose-50/50 dark:bg-rose-950/20',
      text: 'text-rose-950 dark:text-rose-200',
      icon: <ShieldAlert size={15} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />,
      label: 'Caution'
    }
  };

  const cfg = configs[type.toLowerCase()] || configs.note;

  return (
    <div className={`my-3 p-3.5 sm:p-4 rounded-xl border ${cfg.border} ${cfg.bg} flex items-start space-x-3 transition-all shadow-2xs`}>
      {cfg.icon}
      <div className={`flex-1 min-w-0 text-[13.5px] sm:text-[14px] leading-relaxed ${cfg.text}`}>
        {parseBreaks(children)}
      </div>
    </div>
  );
}

// ── Helper to sanitize raw markdown text for clean layout and link presentation ──
function sanitizeMarkdownContent(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let text = raw;

  // 1. Fix nested markdown link artifacts like [text]( [text](https://url) ) or [url]( [url](url) )
  text = text.replace(/\[([^\]]+)\]\(\s*\[[^\]]*\]\((https?:\/\/[^\s)]+)\)\s*\)/g, '[$1]($2)');
  text = text.replace(/\[(https?:\/\/[^\]\s]+)\]\(\s*(?:\[[^\]]*\]\()?(https?:\/\/[^\s)]+)\)?\s*\)/g, '[$1]($2)');

  // 2. Fix spaces inside markdown links like [text]( https://url ) -> [text](https://url)
  text = text.replace(/\[([^\]]+)\]\(\s*(https?:\/\/[^\s)]+)\s*\)/g, '[$1]($2)');

  // 3. Shorten raw URL link text to domain name if link text is just the full URL:
  // e.g. [https://portfoilio-beige-rho.vercel.app](https://portfoilio-beige-rho.vercel.app) -> [portfoilio-beige-rho.vercel.app](https://portfoilio-beige-rho.vercel.app)
  text = text.replace(/\[https?:\/\/([^/\]]+)[^\]]*\]\((https?:\/\/[^\s)]+)\)/g, '[$1]($2)');

  // 4. Remove awkward whitespace inside parentheses before/after code, identifiers or words:
  // e.g. "( `url` )" -> "(`url`)" or "( portfoilio-beige-rho )" -> "(portfoilio-beige-rho)"
  text = text.replace(/\(\s+`([^`]+)`\s+\)/g, '(`$1`)');
  text = text.replace(/\(\s+([a-zA-Z0-9._-]+)\s+\)/g, '($1)');

  return text;
}

function MarkdownRenderer({ content, onOpenIdePanel }) {
  if (!content) return null;

  const cleanContent = sanitizeMarkdownContent(content);

  return (
    <div className="markdown-body font-sans text-[16.5px] sm:text-[17px] leading-[1.78] text-neutral-950 dark:text-neutral-100 space-y-3 w-full max-w-full min-w-0 font-normal">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="font-sans text-[23px] sm:text-[25px] font-semibold tracking-tight text-neutral-950 dark:text-white mt-6 mb-3 pb-2 border-b border-neutral-200/80 dark:border-neutral-800">
              {parseBreaks(children)}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-sans text-[20px] sm:text-[22px] font-semibold tracking-tight text-neutral-950 dark:text-white mt-5 mb-2.5">
              {parseBreaks(children)}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-sans text-[17.5px] sm:text-[18.5px] font-semibold tracking-tight text-neutral-950 dark:text-white mt-4 mb-2">
              {parseBreaks(children)}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="font-sans text-[16px] sm:text-[16.5px] font-semibold tracking-tight text-neutral-950 dark:text-neutral-200 mt-3 mb-1.5">
              {parseBreaks(children)}
            </h4>
          ),
          p: ({ children }) => (
            <p className="text-neutral-950 dark:text-neutral-100 leading-[1.78] my-2.5 font-normal">
              {parseBreaks(children)}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-outside space-y-2 my-3 pl-5 sm:pl-6 text-neutral-950 dark:text-neutral-100 marker:text-neutral-500 font-normal">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside space-y-2 my-3 pl-5 sm:pl-6 text-neutral-950 dark:text-neutral-100 marker:text-neutral-500 font-normal">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-neutral-950 dark:text-neutral-100 leading-[1.72] font-normal">
              {parseBreaks(children)}
            </li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-neutral-950 dark:text-white">
              {children}
            </strong>
          ),
          code: ({ inline, className, children }) => {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');

            if (!inline && match) {
              return <CodeBlock language={match[1]} code={codeString} onOpenIdePanel={onOpenIdePanel} />;
            } else if (!inline && codeString.includes('\n')) {
              return <CodeBlock language="text" code={codeString} onOpenIdePanel={onOpenIdePanel} />;
            }

            return (
              <code className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-[12.5px] sm:text-[13px] font-mono border border-neutral-200/80 dark:border-neutral-700/80 font-normal">
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
              <blockquote className="my-3 pl-3.5 py-1 border-l-2 border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 italic text-[14.5px] leading-relaxed">
                {parseBreaks(children)}
              </blockquote>
            );
          },
          table: ({ children }) => (
            <div className="my-3.5 sm:my-4 overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xs max-w-full bg-white dark:bg-[#0d1017]">
              <table className="w-full text-[13.5px] sm:text-[14px] text-left text-neutral-700 dark:text-neutral-300 border-collapse">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-neutral-100/80 dark:bg-neutral-850 text-neutral-900 dark:text-neutral-100 font-semibold border-b border-neutral-200 dark:border-neutral-800">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-neutral-200/70 dark:divide-neutral-800/70">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40 transition-colors">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 whitespace-nowrap bg-neutral-100/80 dark:bg-neutral-850">
              {parseBreaks(children)}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-3 text-[13.5px] sm:text-[14px] leading-relaxed align-top">
              {parseBreaks(children)}
            </td>
          ),
          hr: () => (
            <hr className="my-4 border-0 h-[1px] bg-neutral-200 dark:bg-neutral-800" />
          ),
          img: ({ src, alt }) => {
            if (!src) return null;
            return (
              <span className="my-3 block max-w-full rounded-xl overflow-hidden border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40 p-2 text-center shadow-2xs">
                <img
                  src={src}
                  alt={alt || 'Visual Reference'}
                  className="max-h-72 w-auto max-w-full rounded-lg object-contain mx-auto shadow-2xs"
                  loading="lazy"
                />
                {alt && (
                  <span className="block text-[11px] text-neutral-500 dark:text-neutral-400 mt-1.5 font-sans">
                    {alt}
                  </span>
                )}
              </span>
            );
          },
          a: ({ href, children }) => {
            let domain = '';
            let faviconUrl = null;
            try {
              if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
                const u = new URL(href);
                domain = u.hostname.replace(/^www\./i, '');
                if (domain && domain.length > 2 && domain !== 'localhost') {
                  faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
                }
              }
            } catch { }

            // Strip redundant protocol prefixes if child text is a raw URL
            let label = children;
            if (typeof children === 'string') {
              label = children.replace(/^https?:\/\//i, '').replace(/\/$/, '');
            }

            return (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 my-0.5 rounded-lg bg-blue-50/90 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 text-[#0066FF] dark:text-blue-400 font-medium text-[13.5px] sm:text-[14px] border border-blue-200/70 dark:border-blue-800/50 transition-all hover:scale-[1.01] active:scale-95 shadow-2xs group/link align-baseline no-underline"
              >
                {faviconUrl && (
                  <span className="inline-flex items-center justify-center shrink-0 w-3.5 h-3.5 align-middle select-none">
                    <img
                      src={faviconUrl}
                      alt=""
                      loading="lazy"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      className="w-3.5 h-3.5 rounded-xs object-contain shrink-0"
                    />
                  </span>
                )}
                <span className="truncate max-w-[320px] sm:max-w-md">{typeof label === 'string' ? label : parseBreaks(children)}</span>
                <ExternalLink size={11} className="shrink-0 opacity-70 group-hover/link:opacity-100 transition-opacity ml-0.5" />
              </a>
            );
          }
        }}
      >
        {cleanContent}
      </ReactMarkdown>
    </div>
  );
}

export default React.memo(MarkdownRenderer);
