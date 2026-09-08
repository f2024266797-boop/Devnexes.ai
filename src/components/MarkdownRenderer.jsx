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
    <div className="relative my-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-[#f8fafc] dark:bg-[#0d0f15] shadow-2xs overflow-hidden font-mono text-[11.5px] w-full max-w-full min-w-0 box-border">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100/90 dark:bg-[#090a0e] border-b border-slate-200 dark:border-slate-800 text-[10.5px] shrink-0">
        <span className="text-[#0066FF] dark:text-blue-400 font-bold uppercase tracking-wider font-sans text-[11px]">
          {language || 'code'}
        </span>
        <div className="flex items-center space-x-1 font-sans">
          <button
            onClick={() => setWrapCode(prev => !prev)}
            className={`px-2 py-0.5 rounded text-[10.5px] transition-colors cursor-pointer ${
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
            className="flex items-center space-x-1 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      <div 
        className="p-3 overflow-x-auto w-full max-w-full min-w-0 text-slate-800 dark:text-slate-200 leading-relaxed custom-scrollbar font-mono"
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
    <div className="markdown-body font-sans text-[14px] sm:text-[14.5px] leading-relaxed text-slate-800 dark:text-slate-200 space-y-1.5 w-full max-w-full min-w-0 overflow-hidden">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="font-lustria text-base font-bold text-slate-900 dark:text-white mt-3 mb-1.5 pb-1 border-b border-slate-200 dark:border-slate-800 flex items-center space-x-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0066FF] inline-block"></span>
              <span>{children}</span>
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-lustria text-[14.5px] font-bold text-slate-900 dark:text-white mt-2.5 mb-1 flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0066FF] inline-block"></span>
              <span>{children}</span>
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-lustria text-[13.5px] font-bold text-slate-800 dark:text-slate-200 mt-2 mb-1">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-slate-700 dark:text-slate-300 leading-normal my-1">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="space-y-1 my-1.5 pl-1.5">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1 my-1.5 text-slate-700 dark:text-slate-300">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="flex items-start space-x-1.5 text-slate-700 dark:text-slate-300">
              <span className="text-[#0066FF] font-bold mt-0.5 select-none shrink-0 text-xs">•</span>
              <span className="flex-1">{children}</span>
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
              <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[11.5px] font-mono border border-slate-200 dark:border-slate-700/80 font-medium">
                {children}
              </code>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="my-1.5 pl-2.5 py-1 border-l-2 border-[#0066FF] bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 rounded-r text-xs italic">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-2.5 overflow-x-auto rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-2xs max-w-full bg-white dark:bg-[#0c0f17]">
              <table className="w-full text-xs text-left text-slate-700 dark:text-slate-300 border-collapse">
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
            <th className="px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 whitespace-nowrap bg-slate-100/70 dark:bg-slate-800/70">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-3.5 py-2.5 text-[12px] leading-relaxed border-t border-slate-200/60 dark:border-slate-800/60 align-top">{children}</td>
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
