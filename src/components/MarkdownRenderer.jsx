import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, ExternalLink } from 'lucide-react';

function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);
  const [wrapCode, setWrapCode] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-[#f8fafc] dark:bg-[#0d0f15] shadow-2xs overflow-hidden font-mono text-[11px] sm:text-[11.5px] w-full max-w-full min-w-0 box-border">
      <div className="flex items-center justify-between px-2.5 sm:px-3 py-1 bg-slate-100/90 dark:bg-[#090a0e] border-b border-slate-200 dark:border-slate-800 text-[10px] sm:text-[10.5px] shrink-0">
        <span className="text-[#0066FF] dark:text-blue-400 font-bold uppercase tracking-wider font-sans text-[10px] sm:text-[10.5px]">
          {language || 'code'}
        </span>
        <div className="flex items-center space-x-1 font-sans">
          <button
            onClick={() => setWrapCode(prev => !prev)}
            className={`px-1.5 py-0.5 rounded text-[10px] transition-colors cursor-pointer ${
              wrapCode 
                ? 'bg-blue-100 dark:bg-blue-950/80 text-[#0066FF] dark:text-blue-400 font-medium' 
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
            title={wrapCode ? "Disable Word Wrap" : "Enable Word Wrap"}
          >
            {wrapCode ? 'Wrap: On' : 'Wrap: Off'}
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center space-x-1 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer text-[10px] sm:text-[10.5px]"
          >
            {copied ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      <div 
        className="p-2.5 sm:p-3 overflow-x-auto w-full max-w-full min-w-0 text-slate-800 dark:text-slate-200 leading-relaxed custom-scrollbar font-mono"
        style={{ overscrollBehaviorX: 'contain', touchAction: 'pan-x pan-y' }}
      >
        <pre className={`font-mono block w-full max-w-full ${wrapCode ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'}`}>
          {code}
        </pre>
      </div>
    </div>
  );
}

export default function MarkdownRenderer({ content }) {
  if (!content) return null;

  return (
    <div className="markdown-body font-sans text-[13px] sm:text-[13.5px] leading-relaxed text-slate-800 dark:text-slate-200 space-y-1 w-full max-w-full min-w-0 overflow-hidden">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="font-lustria text-[14.5px] sm:text-[15px] font-bold text-slate-900 dark:text-white mt-2.5 mb-1 pb-0.5 border-b border-slate-200/80 dark:border-slate-800 flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0066FF] inline-block shrink-0"></span>
              <span>{children}</span>
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-lustria text-[13.5px] sm:text-[14px] font-bold text-slate-900 dark:text-white mt-2 mb-0.5 flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0066FF] inline-block shrink-0"></span>
              <span>{children}</span>
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-lustria text-[12.5px] sm:text-[13px] font-bold text-slate-800 dark:text-slate-200 mt-1.5 mb-0.5">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed my-0.5 sm:my-1">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="space-y-0.5 sm:space-y-1 my-1 pl-1">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-0.5 sm:space-y-1 my-1 text-slate-700 dark:text-slate-300">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="flex items-start space-x-1.5 text-slate-700 dark:text-slate-300">
              <span className="text-[#0066FF] font-bold mt-0.5 select-none shrink-0 text-[10px] sm:text-xs">•</span>
              <span className="flex-1 min-w-0">{children}</span>
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
              <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[11px] sm:text-[11.5px] font-mono border border-slate-200 dark:border-slate-700/80 font-medium">
                {children}
              </code>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="my-1 pl-2.5 py-0.5 border-l-2 border-[#0066FF] bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 rounded-r text-[12px] italic">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs max-w-full bg-white dark:bg-[#0c0f17]">
              <table className="w-full text-[11.5px] sm:text-xs text-left text-slate-700 dark:text-slate-300 border-collapse">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-50 dark:bg-slate-900/90 text-slate-900 dark:text-white font-semibold border-b border-slate-200 dark:border-slate-800">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-1.5 text-[10.5px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 whitespace-nowrap bg-slate-100/70 dark:bg-slate-800/70">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-[11.5px] sm:text-[12px] leading-relaxed border-t border-slate-200/60 dark:border-slate-800/60 align-top">{children}</td>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-[#0066FF] font-semibold hover:underline inline-flex items-center space-x-0.5"
            >
              <span>{children}</span>
              <ExternalLink size={9} className="shrink-0" />
            </a>
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
