import React, { useState } from 'react';
import { X, Play, Code, Copy, Check } from 'lucide-react';
import CanvasLivePreview from './CanvasLivePreview';

export default function ArtifactModal({ isOpen, onClose, code, title, onSendMessage }) {
  const [activeTab, setActiveTab] = useState('preview'); // 'preview' | 'code'
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const cleanCode = (code || '')
    .replace(/^```[a-zA-Z]*\n?/, '')
    .replace(/```$/, '')
    .trim();

  const handleCopy = () => {
    navigator.clipboard.writeText(cleanCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-slate-900/60 backdrop-blur-md animate-fade-in font-sans">
      <div className="bg-white dark:bg-[#0c101b] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-[#f1f5f9] dark:bg-[#080a0f]">
          <div className="flex items-center space-x-3 truncate">
            <div className="w-7 h-7 rounded-lg bg-[#0066FF] text-white flex items-center justify-center text-xs font-bold font-mono">
              HTML
            </div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate max-w-xs sm:max-w-md">
              {title || 'Artifact Fullscreen Studio'}
            </h3>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center bg-slate-200/70 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-sans">
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1 rounded-md flex items-center space-x-1 font-semibold transition-colors cursor-pointer ${
                  activeTab === 'preview'
                    ? 'bg-white dark:bg-[#12151e] text-[#0066FF] dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Play size={12} fill="currentColor" />
                <span>Live Demo</span>
              </button>
              <button
                onClick={() => setActiveTab('code')}
                className={`px-3 py-1 rounded-md flex items-center space-x-1 font-semibold transition-colors cursor-pointer ${
                  activeTab === 'code'
                    ? 'bg-white dark:bg-[#12151e] text-[#0066FF] dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Code size={12} />
                <span>Code</span>
              </button>
            </div>

            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Copy Code"
            >
              {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 bg-white dark:bg-slate-950 overflow-hidden relative flex flex-col">
          {activeTab === 'preview' ? (
            <CanvasLivePreview
              code={cleanCode}
              language="html"
              title={title}
              onSendMessage={onSendMessage}
            />
          ) : (
            <div className="w-full h-full p-4 overflow-auto font-mono text-xs text-slate-800 dark:text-slate-200 bg-[#f8fafc] dark:bg-[#090b10] custom-scrollbar">
              <pre className="whitespace-pre">{cleanCode}</pre>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
