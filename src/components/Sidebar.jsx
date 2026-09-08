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
        {/* Header: Devnexes AI Brand / Collapse Toggle */}
        <div className="h-13 px-3 flex items-center justify-between shrink-0 border-b border-slate-200/60 dark:border-slate-800/60">
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
            <div className="w-full flex items-center justify-center relative group">
              <button
                onClick={onToggleCollapse}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-[#0066FF] dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800/80 transition-all cursor-pointer"
                title="Expand Sidebar"
              >
                <PanelLeftOpen size={17} className="group-hover:scale-105 transition-transform" />
              </button>

              {/* Collapsed Tooltip */}
              <div className="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 hidden group-hover:flex items-center z-50 pointer-events-none animate-fade-in">
                <div className="px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-slate-800 text-white text-[11px] font-medium shadow-xl whitespace-nowrap border border-slate-700/50">
                  Expand Sidebar
                </div>
              </div>
            </div>
          )}
        </div>

        {/* New Chat Button */}
        <div className="p-3 pb-2 shrink-0 flex items-center justify-center">
          {!isCollapsed ? (
            <button
              onClick={() => {
                onNewChat();
                handleMobileClose();
              }}
              className="w-full h-9 flex items-center justify-center space-x-2 px-3 rounded-xl bg-gradient-to-r from-[#0066FF] via-[#1a75ff] to-[#0052cc] hover:from-[#0052cc] hover:to-[#0066FF] active:scale-[0.98] text-white text-xs font-semibold shadow-xs shadow-blue-500/20 hover:shadow-md hover:shadow-blue-500/30 transition-all duration-200 cursor-pointer"
              title="Start New Chat"
            >
              <Plus size={14} strokeWidth={2.5} />
              <span>New Chat</span>
            </button>
          ) : (
            <div className="relative group">
              <button
                onClick={() => {
                  onNewChat();
                  handleMobileClose();
                }}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-gradient-to-tr from-[#0052cc] to-[#0066FF] hover:from-[#0066FF] hover:to-[#2b8aff] text-white shadow-sm shadow-blue-500/25 hover:shadow-md hover:shadow-blue-500/40 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
                title="New Chat"
              >
                <Plus size={16} strokeWidth={2.5} />
              </button>

              {/* Collapsed Tooltip */}
              <div className="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 hidden group-hover:flex items-center z-50 pointer-events-none animate-fade-in">
                <div className="px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-slate-800 text-white text-[11px] font-medium shadow-xl whitespace-nowrap border border-slate-700/50">
                  New Chat
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section Label (Expanded only) */}
        {!isCollapsed && (
          <div className="px-3.5 pt-2 pb-1.5 flex items-center justify-between text-[10.5px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider select-none shrink-0">
            <span>Recent Chats</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-200/70 dark:bg-slate-800 text-[9.5px] font-mono font-medium text-slate-500 dark:text-slate-400">
              {conversations.length}
            </span>
          </div>
        )}

        {/* Divider in Collapsed Mode */}
        {isCollapsed && (
          <div className="w-8 h-[1px] bg-slate-200 dark:bg-slate-800/80 mx-auto my-1 shrink-0" />
        )}

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1 custom-scrollbar">
          {conversations.map((conv) => {
            const isActive = conv.id === activeId;
            const isConfirming = confirmDeleteId === conv.id;

            // Expanded delete confirmation inline
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

            // COLLAPSED MODE ITEM: Clean centered icon with right-floating hover popover
            if (isCollapsed) {
              return (
                <div key={conv.id} className="relative group flex items-center justify-center py-0.5">
                  <button
                    onClick={() => {
                      onSelectConv(conv.id);
                      handleMobileClose();
                    }}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-950/80 border border-blue-200/90 dark:border-blue-800/80 text-[#0066FF] dark:text-blue-400 shadow-2xs'
                        : 'text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 border border-transparent'
                    }`}
                  >
                    <MessageSquare size={15} />
                  </button>

                  {/* Floating Flyout Tooltip / Card on Hover */}
                  <div className="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 hidden group-hover:flex items-center z-50 animate-fade-in">
                    <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-900/95 dark:bg-[#0f1424]/95 text-slate-100 text-xs shadow-2xl border border-slate-700/80 backdrop-blur-xl whitespace-nowrap max-w-xs">
                      <span className="truncate max-w-[180px] font-medium">
                        {conv.title || 'New Chat'}
                      </span>
                      {conversations.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteConv(conv.id);
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/50 transition-colors cursor-pointer"
                          title="Delete chat"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            // EXPANDED MODE ITEM
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
                  <span className="truncate text-[12.5px] leading-tight">
                    {conv.title || 'New Chat'}
                  </span>
                </div>

                {conversations.length > 1 && (
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
        <div className="p-2 border-t border-slate-200/60 dark:border-slate-800/60 space-y-1 shrink-0 bg-white/40 dark:bg-[#060914]/40">
          
          {/* API Key Status Item */}
          <div className="relative group flex justify-center">
            <button
              onClick={onOpenApiKeyModal}
              className={`w-full h-8.5 flex items-center justify-between px-2.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-800 ${
                isCollapsed ? 'w-9 h-8.5 justify-center px-0' : ''
              }`}
              title={!isCollapsed ? 'API Key Settings' : ''}
            >
              <div className="flex items-center space-x-2.5 min-w-0 relative">
                {hasApiKey ? (
                  <ShieldCheck size={15} className="text-emerald-500 shrink-0" />
                ) : (
                  <Key size={15} className="text-[#0066FF] dark:text-blue-400 shrink-0" />
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

            {/* Collapsed Tooltip */}
            {isCollapsed && (
              <div className="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 hidden group-hover:flex items-center z-50 pointer-events-none animate-fade-in">
                <div className="px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-slate-800 text-white text-[11px] font-medium shadow-xl whitespace-nowrap border border-slate-700/50 flex items-center space-x-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${hasApiKey ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <span>{hasApiKey ? 'API Key Configured' : 'Configure API Key'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Theme Toggle Item */}
          <div className="relative group flex justify-center">
            <button
              onClick={onToggleTheme}
              className={`w-full h-8.5 flex items-center space-x-2.5 px-2.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-800 ${
                isCollapsed ? 'w-9 h-8.5 justify-center px-0' : ''
              }`}
              title={!isCollapsed ? 'Toggle Theme' : ''}
            >
              {isDarkMode ? <Sun size={15} className="text-amber-400 shrink-0" /> : <Moon size={15} className="text-slate-500 shrink-0" />}
              {!isCollapsed && <span className="text-[12px]">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>}
            </button>

            {/* Collapsed Tooltip */}
            {isCollapsed && (
              <div className="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 hidden group-hover:flex items-center z-50 pointer-events-none animate-fade-in">
                <div className="px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-slate-800 text-white text-[11px] font-medium shadow-xl whitespace-nowrap border border-slate-700/50">
                  {isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                </div>
              </div>
            )}
          </div>

        </div>

      </aside>
    </>
  );
}

export default memo(Sidebar);
