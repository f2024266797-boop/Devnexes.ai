import React, { useState, useRef, useEffect, memo } from 'react';
import { 
  Globe, 
  Code2, 
  Brain, 
  Sparkles, 
  HelpCircle, 
  ArrowRight, 
  X, 
  ChevronDown, 
  Check, 
  ArrowUp 
} from 'lucide-react';
import { AVAILABLE_MODELS } from '../services/groqService';

const SLASH_COMMANDS = [
  {
    id: 'google',
    tag: '/google',
    aliases: ['/google', '/search'],
    name: 'Google Search',
    description: 'Live real-time web search grounding',
    icon: Globe,
    action: 'google'
  },
  {
    id: 'canvas',
    tag: '/canvas',
    aliases: ['/canvas', '/code'],
    name: 'Canvas Code',
    description: 'Build complete interactive code into Code Canvas',
    icon: Code2,
    action: 'canvas'
  },
  {
    id: 'think',
    tag: '/think',
    aliases: ['/think', '/deep'],
    name: 'Deep Think',
    description: 'Autonomous multi-stage graph reasoning pipeline',
    icon: Brain,
    action: 'think'
  },
  {
    id: 'fast',
    tag: '/fast',
    aliases: ['/fast'],
    name: 'Fast Chat',
    description: 'Instant direct high-speed conversational response',
    icon: Sparkles,
    action: 'fast'
  }
];

function ChatInput({
  onSendMessage,
  isLoading,
  agentTraceMode,
  onToggleAgentTraceMode,
  isDarkMode,
  activeClarification,
  selectedModel,
  onSelectModel,
  isWebSearchActive,
  onToggleWebSearch,
  isCanvasCodeActive,
  onToggleCanvasCode
}) {
  const [text, setText] = useState('');
  const [attachedImage, setAttachedImage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isSlashMenuForced, setIsSlashMenuForced] = useState(false);
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const modelDropdownRef = useRef(null);
  const slashMenuRef = useRef(null);

  // Universal & instant slash command detection: matches / anywhere where user is typing a command token
  const lastSlashIdx = text.lastIndexOf('/');
  const isTypingSlash = lastSlashIdx !== -1 && !text.slice(lastSlashIdx + 1).includes(' ');
  const slashQuery = isTypingSlash ? text.slice(lastSlashIdx + 1).toLowerCase() : '';
  const isSlashActive = isSlashMenuForced || isTypingSlash;

  const filteredSlashCommands = isSlashActive
    ? (slashQuery 
        ? SLASH_COMMANDS.filter(cmd => 
            cmd.tag.toLowerCase().includes(slashQuery) || 
            cmd.name.toLowerCase().includes(slashQuery) || 
            cmd.id.includes(slashQuery) ||
            cmd.aliases.some(a => a.toLowerCase().includes(slashQuery))
          )
        : SLASH_COMMANDS)
    : [];

  useEffect(() => {
    setSelectedSlashIndex(0);
  }, [slashQuery, isSlashActive]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const targetHeight = Math.min(Math.max(textareaRef.current.scrollHeight, 64), 240);
      textareaRef.current.style.height = `${targetHeight}px`;
    }
  }, [text]);

  // Close slash menu on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (slashMenuRef.current && !slashMenuRef.current.contains(e.target)) {
        setIsSlashMenuForced(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close model dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target)) {
        setIsModelDropdownOpen(false);
      }
    }
    if (isModelDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isModelDropdownOpen]);

  const handleApplySlashCommand = (cmd) => {
    if (!cmd) return;
    setIsSlashMenuForced(false);

    // Toggle filter badges directly for the user
    if (cmd.action === 'google' && onToggleWebSearch && !isWebSearchActive) onToggleWebSearch();
    if (cmd.action === 'canvas' && onToggleCanvasCode && !isCanvasCodeActive) onToggleCanvasCode();
    if (cmd.action === 'think' && onToggleAgentTraceMode && !agentTraceMode) onToggleAgentTraceMode();
    if (cmd.action === 'fast' && onToggleAgentTraceMode && agentTraceMode) onToggleAgentTraceMode();

    // Replace the slash token with the explicit command tag in the input
    setText(prev => {
      const idx = prev.lastIndexOf('/');
      if (idx !== -1) {
        return `${prev.slice(0, idx)}${cmd.tag} `.trimStart();
      }
      return `${prev} ${cmd.tag} `.trimStart();
    });

    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

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
    setIsSlashMenuForced(false);
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

    // If Slash Command dropdown is open, handle arrow keys and Enter
    if (isSlashActive && filteredSlashCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSlashIndex(prev => (prev + 1) % filteredSlashCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSlashIndex(prev => (prev - 1 + filteredSlashCommands.length) % filteredSlashCommands.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleApplySlashCommand(filteredSlashCommands[selectedSlashIndex] || filteredSlashCommands[0]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsSlashMenuForced(false);
        setText(prev => prev.replace(/(?:^|\s)\/[a-zA-Z0-9_-]*$/, '').trimEnd());
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canSend = (text.trim().length > 0 || !!attachedImage) && !isLoading;
  const currentModelObj = AVAILABLE_MODELS.find(m => m.id === selectedModel) || AVAILABLE_MODELS[0];

  return (
    <div className="px-3 sm:px-6 md:px-8 pb-3.5 sm:pb-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1 sm:pt-1.5 w-full max-w-3xl mx-auto transition-all shrink-0 relative z-30">

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
        <div className="mb-2.5 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-white/95 dark:bg-[#0f1424]/95 border border-blue-200/90 dark:border-blue-900/70 shadow-sm animate-step-reveal backdrop-blur-md">
          <div className="flex items-start space-x-2.5 mb-2.5">
            <div className="w-5 h-5 sm:w-5.5 sm:h-5.5 rounded-full bg-blue-100 dark:bg-blue-950 text-[#0066FF] dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
              <HelpCircle size={13} />
            </div>
            <div>
              <p className="text-[13px] sm:text-[14.5px] font-semibold text-slate-900 dark:text-white leading-snug break-words">
                {activeClarification.question || 'Please select an option or write your custom request:'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {activeClarification.options.map((opt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSendMessage(opt)}
                className={`w-full text-left p-2.5 sm:p-3 rounded-lg sm:rounded-xl text-[12.5px] sm:text-[13.5px] font-medium border transition-all cursor-pointer flex items-center justify-between group active:scale-[0.99] ${
                  isDarkMode
                    ? 'bg-[#141a2e] hover:bg-[#1a233d] border-slate-700/80 text-slate-200 hover:text-white hover:border-blue-500'
                    : 'bg-slate-50 hover:bg-blue-50/80 border-slate-200/90 text-slate-800 hover:text-[#0066FF] hover:border-blue-300 shadow-2xs'
                }`}
              >
                <div className="flex items-start space-x-2.5 min-w-0 pr-2">
                  <span className="w-5 h-5 sm:w-5.5 sm:h-5.5 rounded-md text-[11px] sm:text-xs font-mono font-bold flex items-center justify-center bg-blue-100 dark:bg-blue-950 text-[#0066FF] dark:text-blue-400 shrink-0 mt-0.5">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="leading-snug break-words">{opt}</span>
                </div>
                <ArrowRight size={13} className="text-slate-400 group-hover:text-[#0066FF] group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main input container with unique Devnexes glassmorphic mirror design */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`group relative flex flex-col rounded-2xl sm:rounded-[24px] border transition-all duration-300 ease-out backdrop-blur-2xl ${
          isDragging ? 'ring-2 ring-[#0066FF] border-[#0066FF]' : ''
        } ${
          isDarkMode
            ? 'bg-[#0d101d]/90 border-slate-700/60 shadow-[0_8px_32px_rgba(0,0,0,0.55)] hover:border-slate-600/80 focus-within:border-[#0066FF]/70 focus-within:ring-2 focus-within:ring-[#0066FF]/20'
            : 'bg-white/90 border-slate-200/90 shadow-[0_8px_30px_rgba(0,102,255,0.06)] hover:border-slate-300 focus-within:border-[#0066FF]/60 focus-within:ring-2 focus-within:ring-[#0066FF]/12'
        }`}
      >
        {/* Floating Slash Commands Menu - Anchored directly over the input card */}
        {isSlashActive && filteredSlashCommands.length > 0 && (
          <div 
            ref={slashMenuRef}
            onMouseDown={(e) => e.stopPropagation()}
            className={`absolute bottom-[calc(100%+10px)] left-2 sm:left-4 w-[300px] sm:w-[350px] max-w-[calc(100vw-24px)] rounded-2xl border p-1.5 shadow-2xl z-50 animate-fade-in backdrop-blur-2xl ${
              isDarkMode 
                ? 'bg-[#0d101d]/98 border-slate-700/90 text-slate-200 shadow-[0_20px_50px_rgba(0,0,0,0.95)] ring-1 ring-white/5' 
                : 'bg-white/98 border-slate-200 text-slate-800 shadow-[0_20px_50px_rgba(0,102,255,0.18)] ring-1 ring-black/5'
            }`}
          >
            <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
              {filteredSlashCommands.map((cmd, cIdx) => {
                const Icon = cmd.icon;
                const isSelected = cIdx === selectedSlashIndex;

                return (
                  <button
                    key={cmd.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleApplySlashCommand(cmd);
                    }}
                    onMouseEnter={() => setSelectedSlashIndex(cIdx)}
                    className={`w-full text-left p-2 rounded-xl text-xs transition-all duration-150 flex items-center space-x-2.5 cursor-pointer group ${
                      isSelected
                        ? 'bg-blue-50/90 dark:bg-blue-950/80 border border-[#0066FF]/40 text-[#0066FF] dark:text-blue-300 font-medium shadow-xs'
                        : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-transparent'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      isSelected 
                        ? 'bg-blue-100 dark:bg-blue-900 text-[#0066FF] dark:text-blue-300' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'
                    }`}>
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="font-semibold text-[13px] leading-tight truncate">{cmd.name}</span>
                        <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded-md shrink-0 ${
                          isSelected 
                            ? 'bg-blue-200/60 dark:bg-blue-900/60 text-[#0066FF] dark:text-blue-300 font-bold' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        }`}>
                          {cmd.tag}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate leading-tight mt-0.5">
                        {cmd.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Mirror Shimmer Highlight Edge */}
        <div className="absolute inset-x-0 top-0 h-[1.5px] rounded-t-3xl bg-gradient-to-r from-transparent via-white/80 dark:via-blue-400/40 to-transparent pointer-events-none z-10" />

        {/* Attached Image Preview Pill */}
        {attachedImage && (
          <div className="mx-3.5 sm:mx-4 mt-2.5 p-1.5 pl-2 pr-2.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-2 max-w-sm animate-smooth-expand">
            <div className="flex items-center space-x-2 min-w-0">
              <img
                src={attachedImage.url}
                alt="Attached preview"
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg object-cover shrink-0 border border-slate-300 dark:border-slate-600 bg-white"
              />
              <div className="min-w-0 truncate">
                <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 truncate leading-tight">
                  {attachedImage.name}
                </p>
                {attachedImage.size && (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    {attachedImage.size}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAttachedImage(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
              title="Remove image"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* Textarea — Perfectly proportioned vertically for comfortable typing */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Message Devnexes AI..."
          rows={2}
          className={`w-full px-4 sm:px-6 pt-3.5 sm:pt-4 pb-2 bg-transparent resize-none border-0 focus:outline-none text-[15px] sm:text-[16px] leading-relaxed custom-scrollbar min-h-[64px] sm:min-h-[72px] max-h-56 font-sans ${
            isDarkMode
              ? 'text-slate-100 placeholder:text-slate-500'
              : 'text-slate-900 placeholder:text-slate-400'
          }`}
        />

        {/* Active Filter Badges Bar (Inside Chatbar) */}
        {(isWebSearchActive || isCanvasCodeActive) && (
          <div className="flex flex-wrap items-center gap-1.5 px-3.5 sm:px-4 pb-2 select-none animate-fade-in">
            {isWebSearchActive && (
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-950/70 border border-blue-300 dark:border-blue-800 text-[#0066FF] dark:text-blue-300">
                <Globe size={12} />
                <span>Google Search</span>
                {onToggleWebSearch && (
                  <button 
                    type="button" 
                    onClick={onToggleWebSearch} 
                    className="hover:bg-blue-200/70 dark:hover:bg-blue-900 rounded p-0.5 ml-0.5 cursor-pointer"
                    title="Remove Google Search filter"
                  >
                    <X size={10} />
                  </button>
                )}
              </span>
            )}
            {isCanvasCodeActive && (
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-300 dark:border-indigo-800 text-indigo-600 dark:text-indigo-300">
                <Code2 size={12} />
                <span>Canvas Code</span>
                {onToggleCanvasCode && (
                  <button 
                    type="button" 
                    onClick={onToggleCanvasCode} 
                    className="hover:bg-indigo-200/70 dark:hover:bg-indigo-900 rounded p-0.5 ml-0.5 cursor-pointer"
                    title="Remove Canvas Code add-in"
                  >
                    <X size={10} />
                  </button>
                )}
              </span>
            )}
          </div>
        )}

        {/* Bottom toolbar */}
        <div className="flex items-center justify-between px-3 sm:px-4 pb-2.5 pt-1">

          {/* Left: Plus (+) Attach Button & Mode Toggle */}
          <div className="flex items-center space-x-2">
            {/* Transparent Plus (+) Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`w-7.5 h-7.5 flex items-center justify-center transition-colors bg-transparent border-0 cursor-pointer shrink-0 select-none text-2xl font-light leading-none ${
                attachedImage
                  ? 'text-[#0066FF] dark:text-blue-400 font-bold'
                  : isDarkMode
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Attach image or screenshot"
            >
              <span className="mb-0.5">+</span>
            </button>

            {/* Mode Toggle Button: Refined modern button with clean micro-icon */}
            <button
              type="button"
              onClick={onToggleAgentTraceMode}
              className={`h-7.5 sm:h-8 px-3 rounded-xl text-xs sm:text-[13px] font-medium transition-all duration-200 border cursor-pointer select-none flex items-center space-x-1.5 ${
                agentTraceMode
                  ? isDarkMode
                    ? 'bg-blue-950/60 border-blue-500/80 text-blue-300 font-semibold shadow-xs'
                    : 'bg-blue-50 border-blue-300 text-[#0066FF] font-semibold shadow-2xs'
                  : isDarkMode
                    ? 'border-slate-800/90 bg-[#121626] text-slate-300 hover:text-white hover:border-slate-700 hover:bg-[#161c30]'
                    : 'border-slate-200/90 bg-slate-100/90 text-slate-700 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-200/70'
              }`}
              title="Click to toggle between Fast Chat and Deep Think"
            >
              {agentTraceMode ? (
                <Brain size={13.5} className="text-[#0066FF] dark:text-blue-400 shrink-0" />
              ) : (
                <Sparkles size={13.5} className="text-[#0066FF] dark:text-blue-400 shrink-0" />
              )}
              <span>{agentTraceMode ? 'Deep Think' : 'Fast Chat'}</span>
            </button>
          </div>

          {/* Right: Model Selector & Send Button */}
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            {/* Model Selector Button */}
            {onSelectModel && (
              <div className="relative" ref={modelDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                  className={`h-7.5 sm:h-8 px-2.5 sm:px-3 rounded-lg sm:rounded-xl text-xs sm:text-[13px] font-medium transition-all duration-200 border cursor-pointer select-none flex items-center space-x-1.5 ${
                    isDarkMode
                      ? 'border-slate-800/90 bg-[#121626] text-slate-300 hover:text-white hover:border-slate-700 hover:bg-[#161c30]'
                      : 'border-slate-200/90 bg-slate-100/90 text-slate-700 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-200/70'
                  }`}
                  title="Switch Model"
                >
                  <span className="truncate max-w-[120px] sm:max-w-none">{currentModelObj.name}</span>
                  <ChevronDown size={12} className={`opacity-50 shrink-0 transition-transform duration-200 ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown menu - opens upwards so it is always 100% visible and never clipped */}
                {isModelDropdownOpen && (
                  <div className={`absolute bottom-full right-0 mb-2 w-56 rounded-xl sm:rounded-2xl border p-1.5 shadow-2xl z-50 animate-fade-in backdrop-blur-2xl ${
                    isDarkMode
                      ? 'bg-[#0d101d]/98 border-slate-700/80 text-slate-200 shadow-[0_12px_40px_rgba(0,0,0,0.8)]'
                      : 'bg-white/98 border-slate-200/90 text-slate-800 shadow-[0_12px_40px_rgba(0,0,0,0.15)]'
                  }`}>
                    {AVAILABLE_MODELS.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          onSelectModel(m.id);
                          setIsModelDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-[13px] font-medium transition-colors flex items-center justify-between cursor-pointer ${
                          selectedModel === m.id
                            ? 'bg-blue-50 dark:bg-blue-950/70 text-[#0066FF] dark:text-blue-400 font-semibold'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <span className="truncate">{m.name}</span>
                        {selectedModel === m.id && (
                          <Check size={14} className="text-[#0066FF] dark:text-blue-400 shrink-0 ml-1" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Send Button */}
            <button
              onClick={handleSubmit}
              disabled={!canSend}
              className={`w-7.5 h-7.5 sm:w-8.5 sm:h-8.5 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer shrink-0 ${
                canSend
                  ? 'bg-gradient-to-tr from-[#0052cc] to-[#0066FF] hover:from-[#0066FF] hover:to-[#2b8aff] text-white shadow-md shadow-blue-500/25 hover:scale-105 active:scale-95'
                  : isDarkMode
                    ? 'bg-slate-800/60 text-slate-600 cursor-not-allowed'
                    : 'bg-slate-100 text-slate-300 cursor-not-allowed'
              }`}
              title="Send message"
            >
              <ArrowUp size={15} strokeWidth={canSend ? 2.5 : 2} />
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

export default memo(ChatInput);
