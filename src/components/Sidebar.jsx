import React, { useState, memo } from 'react';
import { 
  Plus, 
  MessageSquare, 
  Key, 
  Sun, 
  Moon, 
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  Check,
  Sparkles,
  Trash2
} from 'lucide-react';

function Sidebar({
  conversations,
  activeId,
  onSelectConv,
  onNewChat,
  onDeleteConv,
  hasApiKey,
  onOpenApiKeyModal,
  isDarkMode,
  onToggleTheme,
  isCollapsed,
  onToggleCollapse
}) {
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const handleMobileClose = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768 && !isCollapsed) {
      onToggleCollapse();
    }
  };

  const handleConfirmDelete = (id, e) => {
    e.stopPropagation();
    onDeleteConv(id);
    setConfirmDeleteId(null);
  };

  const handleCancelDelete = (e) => {
    e.stopPropagation();
    setConfirmDeleteId(null);
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {!isCollapsed && (
        <div
          onClick={onToggleCollapse}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 md:hidden animate-fade-in"
        />
      )}

      <aside 
        className={`fixed md:relative inset-y-0 left-0 z-50 shrink-0 border-r border-slate-200/80 dark:border-slate-800/80 bg-[#f8fafc] dark:bg-[#090d1a] flex flex-col h-full transition-all duration-300 ease-in-out select-none font-sans shadow-2xl md:shadow-none ${
          isCollapsed ? '-translate-x-full md:translate-x-0 md:w-16' : 'translate-x-0 w-[255px] sm:w-[265px]'
        }`}
      >
        {/* Header: Devnexes AI Brand */}
        <div className="h-13 px-3.5 flex items-center justify-between shrink-0 border-b border-slate-200/60 dark:border-slate-800/60">
          {!isCollapsed ? (
            <>
              <div className="flex items-center space-x-2.5 animate-fade-in min-w-0">
                <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/80 p-1 flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-900/50">
                  <img 
                    src="/devnexes-logo.png" 
                    alt="Devnexes AI" 
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-[14px] text-slate-900 dark:text-white tracking-tight leading-none truncate">
                    Devnexes AI
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium leading-none mt-1">
                    v2.4 Intelligent Agent
                  </span>
                </div>
              </div>
              <button
                onClick={onToggleCollapse}
                className="w-7.5 h-7.5 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/70 transition-colors cursor-pointer shrink-0"
                title="Collapse Sidebar"
              >
                <PanelLeftClose size={16} />
              </button>
            </>
          ) : (
            <div className="w-full flex items-center justify-center">
              <button
                onClick={onToggleCollapse}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-[#0066FF] dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800/70 transition-all cursor-pointer group"
                title="Expand Sidebar"
              >
                <PanelLeftOpen size={17} className="group-hover:scale-110 transition-transform" />
              </button>
            </div>
          )}
        </div>

        {/* New Chat Button */}
        <div className="p-3 pb-2 shrink-0">
          <button
            onClick={() => {
              onNewChat();
              handleMobileClose();
            }}
            className={`w-full h-9 flex items-center justify-center space-x-2 px-3 rounded-xl bg-gradient-to-r from-[#0066FF] via-[#1a75ff] to-[#0052cc] hover:from-[#0052cc] hover:to-[#0066FF] active:scale-[0.98] text-white text-xs font-semibold shadow-xs shadow-blue-500/20 hover:shadow-md hover:shadow-blue-500/30 transition-all duration-200 cursor-pointer ${
              isCollapsed ? 'px-0' : ''
            }`}
            title="Start New Chat"
          >
            <Plus size={14} strokeWidth={2.5} />
            {!isCollapsed && <span>New Chat</span>}
          </button>
        </div>

        {/* Section Label */}
        {!isCollapsed && (
          <div className="px-3.5 pt-2 pb-1.5 flex items-center justify-between text-[10.5px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider select-none shrink-0">
            <span>Recent Chats</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-200/70 dark:bg-slate-800 text-[9.5px] font-mono font-medium text-slate-500 dark:text-slate-400">
              {conversations.length}
            </span>
          </div>
        )}

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1 custom-scrollbar">
          {conversations.map((conv) => {
            const isActive = conv.id === activeId;
            const isConfirming = confirmDeleteId === conv.id;

            if (isConfirming && !isCollapsed) {
              return (
                <div
                  key={conv.id}
                  className="flex items-center justify-between h-9 px-2.5 rounded-xl text-xs bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 animate-fade-in"
                >
                  <span className="truncate font-medium text-[11.5px]">Delete chat?</span>
                  <div className="flex items-center space-x-1 shrink-0 ml-1">
                    <button
                      onClick={(e) => handleConfirmDelete(conv.id, e)}
                      className="w-5 h-5 flex items-center justify-center rounded-md bg-rose-500 hover:bg-rose-600 text-white cursor-pointer transition-colors"
                      title="Confirm delete"
                    >
                      <Check size={11} strokeWidth={3} />
                    </button>
                    <button
                      onClick={handleCancelDelete}
                      className="w-5 h-5 flex items-center justify-center rounded-md bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 cursor-pointer transition-colors"
                      title="Cancel"
                    >
                      <X size={11} strokeWidth={3} />
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={conv.id}
                onClick={() => {
                  onSelectConv(conv.id);
                  handleMobileClose();
                }}
                className={`group relative flex items-center justify-between h-9 px-2.5 rounded-xl text-xs cursor-pointer transition-all duration-200 ${
                  isActive 
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-[#0066FF] dark:text-blue-300 font-semibold border border-blue-200/80 dark:border-blue-900/60 shadow-2xs' 
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800/50 border border-transparent font-medium'
                }`}
                title={conv.title}
              >
                {isActive && (
                  <div className="absolute left-0 inset-y-1.5 w-1 rounded-r-full bg-[#0066FF] dark:bg-blue-400" />
                )}

                <div className="flex items-center space-x-2 min-w-0 pr-1 pl-0.5">
                  <MessageSquare 
                    size={13} 
                    className={`shrink-0 transition-colors ${
                      isActive 
                        ? 'text-[#0066FF] dark:text-blue-400' 
                        : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                    }`} 
                  />
                  {!isCollapsed && (
                    <span className="truncate text-[12.5px] leading-tight">
                      {conv.title || 'New Chat'}
                    </span>
                  )}
                </div>

                {!isCollapsed && conversations.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteId(conv.id);
                    }}
                    className="w-5.5 h-5.5 flex items-center justify-center rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 opacity-0 group-hover:opacity-100 transition-all shrink-0 cursor-pointer"
                    title="Delete chat"
                  >
                    <Trash2 size={11.5} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Settings */}
        <div className="p-2.5 border-t border-slate-200/60 dark:border-slate-800/60 space-y-1 shrink-0 bg-white/40 dark:bg-[#060914]/40">
          
          {/* API Key Status Item */}
          <button
            onClick={onOpenApiKeyModal}
            className={`w-full h-8.5 flex items-center justify-between px-2.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-800 ${
              isCollapsed ? 'justify-center px-0' : ''
            }`}
            title="API Key Settings"
          >
            <div className="flex items-center space-x-2.5 min-w-0">
              {hasApiKey ? (
                <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
              ) : (
                <Key size={14} className="text-[#0066FF] dark:text-blue-400 shrink-0" />
              )}
              {!isCollapsed && (
                <span className="truncate text-[12px]">
                  {hasApiKey ? 'API Key Configured' : 'Configure API Key'}
                </span>
              )}
            </div>
            {!isCollapsed && (
              <span className={`w-2 h-2 rounded-full shrink-0 ${hasApiKey ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : 'bg-amber-500 animate-pulse'}`} />
            )}
          </button>

          {/* Theme Toggle Item */}
          <button
            onClick={onToggleTheme}
            className={`w-full h-8.5 flex items-center space-x-2.5 px-2.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-800 ${
              isCollapsed ? 'justify-center px-0' : ''
            }`}
            title="Toggle Theme"
          >
            {isDarkMode ? <Sun size={14} className="text-amber-400 shrink-0" /> : <Moon size={14} className="text-slate-500 shrink-0" />}
            {!isCollapsed && <span className="text-[12px]">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>

        </div>

      </aside>
    </>
  );
}

export default memo(Sidebar);
