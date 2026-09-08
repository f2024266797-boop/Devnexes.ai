import React, { useState, useRef, useEffect, memo } from 'react';
import { ArrowUp, Sparkles, Check, HelpCircle, ArrowRight, Image as ImageIcon, Paperclip, X } from 'lucide-react';

function ChatInput({ onSendMessage, isLoading, agentTraceMode, onToggleAgentTraceMode, isDarkMode, activeClarification }) {
  const [text, setText] = useState('');
  const [attachedImage, setAttachedImage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [text]);

  const handleProcessFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setAttachedImage({
        url: e.target.result,
        name: file.name || 'Screenshot',
        size: file.size ? `${Math.round(file.size / 1024)} KB` : ''
      });
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleProcessFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          handleProcessFile(blob);
          break;
        }
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleProcessFile(file);
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const cleanText = text.trim();
    if ((!cleanText && !attachedImage) || isLoading) return;

    const finalPrompt = cleanText || 'Please analyze this screenshot / image in full detail.';
    const finalImage = attachedImage ? attachedImage.url : null;

    onSendMessage(finalPrompt, finalImage);
    setText('');
    setAttachedImage(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e) => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canSend = (text.trim().length > 0 || !!attachedImage) && !isLoading;

  return (
    <div className="px-3 sm:px-6 md:px-8 pb-3.5 sm:pb-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1 sm:pt-1.5 w-full max-w-3xl mx-auto transition-all shrink-0">

      {/* Hidden file input for screenshot / image upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        className="hidden"
      />

      {/* Attached Clarification / Quick Options Dock Above Chatbar */}
      {activeClarification && activeClarification.options && activeClarification.options.length > 0 && (
        <div className="mb-2.5 p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-white/95 dark:bg-[#0f1424]/95 border border-blue-200/90 dark:border-blue-900/70 shadow-sm animate-step-reveal backdrop-blur-md">
          <div className="flex items-start space-x-2 mb-2">
            <div className="w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-[#0066FF] dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
              <HelpCircle size={12} />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white leading-snug break-words">
                {activeClarification.question || 'Please select an option or write your custom request:'}
              </p>
              <p className="text-[10.5px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Click an option below or type your custom instruction:
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-1.5">
            {activeClarification.options.map((opt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSendMessage(opt)}
                className={`w-full text-left p-2 sm:p-2.5 rounded-lg sm:rounded-xl text-[11.5px] sm:text-xs font-medium border transition-all cursor-pointer flex items-center justify-between group active:scale-[0.99] ${
                  isDarkMode
                    ? 'bg-[#141a2e] hover:bg-[#1a233d] border-slate-700/80 text-slate-200 hover:text-white hover:border-blue-500'
                    : 'bg-slate-50 hover:bg-blue-50/80 border-slate-200/90 text-slate-800 hover:text-[#0066FF] hover:border-blue-300 shadow-2xs'
                }`}
              >
                <div className="flex items-start space-x-2 min-w-0 pr-2">
                  <span className="w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-md text-[10px] sm:text-[10.5px] font-mono font-bold flex items-center justify-center bg-blue-100 dark:bg-blue-950 text-[#0066FF] dark:text-blue-400 shrink-0 mt-0.5">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="leading-snug break-words">{opt}</span>
                </div>
                <ArrowRight size={12} className="text-slate-400 group-hover:text-[#0066FF] group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            ))}

            {/* Option D: Custom Recommendation / Write-in */}
            <button
              type="button"
              onClick={() => {
                if (textareaRef.current) {
                  textareaRef.current.focus();
                }
              }}
              className={`w-full text-left p-2 sm:p-2.5 rounded-lg sm:rounded-xl text-[11.5px] sm:text-xs font-medium border border-dashed transition-all cursor-pointer flex items-center justify-between group ${
                isDarkMode
                  ? 'bg-blue-950/20 hover:bg-blue-950/40 border-blue-500/40 text-blue-300 hover:text-blue-200'
                  : 'bg-blue-50/40 hover:bg-blue-50 border-blue-300 text-blue-700 hover:text-[#0066FF]'
              }`}
            >
              <div className="flex items-center space-x-2 min-w-0 pr-2">
                <span className="w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-md text-[10px] sm:text-[10.5px] font-mono font-bold flex items-center justify-center bg-blue-100 dark:bg-blue-950 text-[#0066FF] dark:text-blue-400 shrink-0">
                  {String.fromCharCode(65 + activeClarification.options.length)}
                </span>
                <span className="leading-snug truncate">
                  Custom Recommendation (Type in chatbox below)...
                </span>
              </div>
              <ArrowRight size={12} className="text-blue-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
            </button>
          </div>
        </div>
      )}

      {/* Main input container with rich hover & focus glow */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`group relative flex flex-col rounded-2xl sm:rounded-3xl border transition-all duration-300 ease-out backdrop-blur-md ${
          isDragging ? 'ring-4 ring-blue-500 border-blue-500 bg-blue-50/20' : ''
        } ${
          isDarkMode
            ? 'bg-[#0f1322]/98 border-slate-700/80 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5)] hover:border-blue-500/80 focus-within:border-[#0066FF] focus-within:ring-4 focus-within:ring-[#0066FF]/20'
            : 'bg-white/98 border-slate-300/90 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.08)] hover:border-blue-400/80 focus-within:border-[#0066FF] focus-within:ring-4 focus-within:ring-[#0066FF]/15'
        }`}
      >

        {/* Attached Image / Screenshot Preview Pill */}
        {attachedImage && (
          <div className="mx-3 sm:mx-4 mt-2.5 p-1.5 pl-2 pr-2.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-2 max-w-sm animate-smooth-expand">
            <div className="flex items-center space-x-2 min-w-0">
              <img
                src={attachedImage.url}
                alt="Attached preview"
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg object-cover shrink-0 border border-slate-300 dark:border-slate-600 bg-white"
              />
              <div className="min-w-0 truncate">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate leading-tight">
                  {attachedImage.name}
                </p>
                {attachedImage.size && (
                  <span className="text-[10px] text-slate-400 font-mono">{attachedImage.size}</span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAttachedImage(null)}
              className="w-5 h-5 rounded-full bg-slate-200 hover:bg-rose-100 dark:bg-slate-700 dark:hover:bg-rose-950/80 text-slate-500 hover:text-rose-500 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title="Remove image"
            >
              <X size={11} />
            </button>
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={attachedImage ? "Add an instruction (e.g. 'explain this error', 'convert to React', etc.)..." : "Ask anything or paste/upload a screenshot..."}
          rows={1}
          disabled={isLoading}
          className={`w-full bg-transparent border-0 focus:outline-none px-3.5 sm:px-5 pt-3 sm:pt-3.5 pb-1 text-[13px] sm:text-base leading-relaxed resize-none no-scrollbar min-h-[44px] sm:min-h-[52px] ${
            isDarkMode
              ? 'text-slate-100 placeholder-slate-500'
              : 'text-slate-900 placeholder-slate-400'
          }`}
          style={{ maxHeight: '180px' }}
        />

        {/* Bottom toolbar */}
        <div className="flex items-center justify-between px-3 sm:px-4 pb-2.5 sm:pb-3 pt-0.5">

          {/* Left toolbar items: Image Upload & AI Reasoning mode toggle */}
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            {/* Image / Screenshot Upload Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`flex items-center space-x-1 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-medium transition-all duration-200 border cursor-pointer shrink-0 ${
                attachedImage
                  ? 'bg-blue-100 dark:bg-blue-950/80 border-blue-400 text-[#0066FF] dark:text-blue-300 shadow-2xs'
                  : isDarkMode
                    ? 'border-slate-700/80 bg-slate-850 text-slate-300 hover:text-slate-100 hover:border-slate-600 hover:bg-slate-800'
                    : 'border-slate-200/90 bg-slate-50 text-slate-600 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-100'
              }`}
              title="Upload image or screenshot (or paste via Ctrl+V)"
            >
              <ImageIcon size={13} className={attachedImage ? 'text-[#0066FF]' : 'text-slate-500 dark:text-slate-400'} />
              <span>{attachedImage ? 'Attached' : 'Attach Image'}</span>
            </button>

            {/* AI Reasoning mode toggle */}
            <button
              type="button"
              onClick={onToggleAgentTraceMode}
              className={`group/btn flex items-center space-x-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-medium transition-all duration-200 border cursor-pointer shrink-0 ${
                agentTraceMode
                  ? isDarkMode
                    ? 'bg-blue-950/80 border-blue-600 text-blue-300 shadow-xs hover:bg-blue-900/60'
                    : 'bg-blue-50 border-blue-300 text-blue-600 shadow-xs hover:bg-blue-100/80'
                  : isDarkMode
                    ? 'border-slate-700/80 bg-slate-850 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                    : 'border-slate-200/90 bg-slate-50 text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
              title={agentTraceMode ? 'AI Reasoning Active' : 'Enable AI Reasoning'}
            >
              <img 
                src="/devnexes-logo.png" 
                className={`w-3.5 h-3.5 object-contain transition-transform duration-200 ${agentTraceMode ? 'scale-105' : 'grayscale opacity-70 group-hover/btn:grayscale-0 group-hover/btn:opacity-100'}`} 
                alt="" 
              />
              <span>{agentTraceMode ? 'AI Reasoning' : 'Standard'}</span>
            </button>
          </div>

          {/* Right: Send button */}
          <button
            onClick={handleSubmit}
            disabled={!canSend}
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer shrink-0 ${
              canSend
                ? 'bg-gradient-to-tr from-[#0052cc] to-[#0077ff] hover:from-[#0066FF] hover:to-[#2b8aff] text-white shadow-md shadow-blue-500/30 hover:scale-105 active:scale-95'
                : isDarkMode
                  ? 'bg-slate-800/80 text-slate-600 cursor-not-allowed'
                  : 'bg-slate-100 text-slate-300 cursor-not-allowed'
            }`}
            title="Send message"
          >
            <ArrowUp size={15} strokeWidth={canSend ? 2.5 : 2} />
          </button>
        </div>
      </div>

      {/* Subtle bottom hint */}
      <p className={`text-center text-[10.5px] sm:text-[11px] mt-1 sm:mt-1.5 font-normal transition-colors ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
        <span className="hidden sm:inline">Press <span className="font-medium">Enter</span> to send · <span className="font-medium">Ctrl+V</span> to paste screenshot · <span className="font-medium">Shift+Enter</span> for newline</span>
        <span className="sm:hidden text-[10px]">Powered by Devnexes AI</span>
      </p>
    </div>
  );
}

export default memo(ChatInput);
