import React, { memo } from 'react';
import { 
  Plus, 
  MessageSquare, 
  Key, 
  Cpu, 
  Trash2, 
  Sun, 
  Moon, 
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown
} from 'lucide-react';
import { AVAILABLE_MODELS } from '../services/groqService';

function Sidebar({
  conversations,
  activeId,
  onSelectConv,
  onNewChat,
  onDeleteConv,
  selectedModel,
  onSelectModel,
  hasApiKey,
  onOpenApiKeyModal,
  isDarkMode,
  onToggleTheme,
  isCollapsed,
  onToggleCollapse
}) {
  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {!isCollapsed && (
        <div
          onClick={onToggleCollapse}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden animate-fade-in"
        />
      )}

      <aside 
        className={`fixed md:relative inset-y-0 left-0 z-50 shrink-0 border-r border-slate-200/90 dark:border-slate-800/90 bg-[#f8fafc] dark:bg-[#0a0c14] flex flex-col h-full transition-all duration-300 ease-in-out select-none font-sans shadow-xl md:shadow-none ${
          isCollapsed ? '-translate-x-full md:translate-x-0 md:w-16' : 'translate-x-0 w-72 sm:w-80 md:w-72'
        }`}
      >
      {/* Devnexes AI Header */}
      <div className="h-14 px-3 border-b border-slate-200/90 dark:border-slate-800/90 flex items-center justify-between">
        {!isCollapsed ? (
          <>
            <div className="flex items-center space-x-2.5 animate-fade-in min-w-0">
              <img 
                src="/devnexes-logo.png" 
                alt="Devnexes AI Logo" 
                className="w-7 h-7 object-contain animate-logo-float shrink-0"
              />
              <div className="truncate">
                <h1 className="font-bold text-sm text-slate-900 dark:text-white leading-none tracking-tight truncate">
                  Devnexes AI
                </h1>
                <p className="text-[10px] text-[#0066FF] dark:text-blue-400 font-medium mt-0.5 tracking-wide">
                  AI Assistant
                </p>
              </div>
            </div>
            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              title="Collapse Sidebar"
            >
              <PanelLeftClose size={17} />
            </button>
          </>
        ) : (
          <div className="w-full flex items-center justify-center">
            <button
              onClick={onToggleCollapse}
              className="p-2 rounded-xl text-slate-400 hover:text-[#0066FF] dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition-all cursor-pointer group"
              title="Expand Sidebar"
            >
              <PanelLeftOpen size={18} className="group-hover:scale-110 transition-transform" />
            </button>
          </div>
        )}
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <button
          onClick={onNewChat}
          className={`w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-xl bg-[#0066FF] hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold shadow-2xs transition-all cursor-pointer ${
            isCollapsed ? 'px-0' : ''
          }`}
          title="New Chat"
        >
          <Plus size={15} />
          {!isCollapsed && <span>New Chat</span>}
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1 custom-scrollbar">
        {conversations.map((conv) => {
          const isActive = conv.id === activeId;
          return (
            <div
              key={conv.id}
              onClick={() => onSelectConv(conv.id)}
              className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-all ${
                isActive 
                  ? 'bg-white dark:bg-slate-800/90 text-[#0066FF] dark:text-blue-400 font-semibold border border-blue-200/80 dark:border-blue-900/60 shadow-2xs' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/40'
              }`}
              title={conv.title}
            >
              <div className="flex items-center space-x-2 truncate">
                <MessageSquare size={13} className={isActive ? "text-[#0066FF]" : "text-slate-400"} />
                {!isCollapsed && (
                  <span className="truncate max-w-[170px]">{conv.title || 'New Chat'}</span>
                )}
              </div>

              {!isCollapsed && conversations.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteConv(conv.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-opacity"
                  title="Delete chat"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Model Selector & Footer Settings (Unified 1-Way Style) */}
      <div className="p-3 border-t border-slate-200/90 dark:border-slate-800/90 space-y-1">
        
        {/* AI Model Selector */}
        <div 
          className={`relative flex items-center justify-between px-3 py-2 rounded-xl text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${
            isCollapsed ? 'justify-center px-0' : ''
          }`}
        >
          <div className="flex items-center space-x-2.5 truncate pr-2">
            <Cpu size={14} className="text-[#0066FF] shrink-0" />
            {!isCollapsed && (
              <span className="truncate font-medium text-slate-800 dark:text-slate-200 text-xs">
                {AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name || selectedModel}
              </span>
            )}
          </div>
          {!isCollapsed && <ChevronDown size={13} className="text-slate-400 shrink-0" />}

          {!isCollapsed && (
            <select
              value={selectedModel}
              onChange={(e) => onSelectModel(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              title="Select AI Model"
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* API Key Status Item */}
        <button
          onClick={onOpenApiKeyModal}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${
            isCollapsed ? 'justify-center px-0' : ''
          }`}
          title="API Key Settings"
        >
          <div className="flex items-center space-x-2.5">
            {hasApiKey ? (
              <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
            ) : (
              <Key size={14} className="text-blue-500 shrink-0" />
            )}
            {!isCollapsed && (
              <span className="font-medium text-slate-800 dark:text-slate-200 text-xs">
                {hasApiKey ? 'API Key Active' : 'Configure API Key'}
              </span>
            )}
          </div>
          {!isCollapsed && (
            <span className={`w-2 h-2 rounded-full ${hasApiKey ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
          )}
        </button>

        {/* Theme Toggle Item */}
        <button
          onClick={onToggleTheme}
          className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${
            isCollapsed ? 'justify-center px-0' : ''
          }`}
          title="Toggle Theme"
        >
          {isDarkMode ? <Sun size={14} className="text-amber-400 shrink-0" /> : <Moon size={14} className="text-slate-500 shrink-0" />}
          {!isCollapsed && <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>

      </div>

    </aside>
    </>
  );
}

export default memo(Sidebar);
