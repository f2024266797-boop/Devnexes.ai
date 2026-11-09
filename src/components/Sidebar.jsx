import React, { useState, useMemo, memo } from 'react';
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
  Trash2,
  Search,
  Pencil,
  Sparkles,
  Clock
} from 'lucide-react';

function getConversationTimestamp(conv, index) {
  if (conv?.updatedAt) {
    const t = Number(conv.updatedAt);
    if (!isNaN(t) && t > 0) return t;
  }
  if (conv?.createdAt) {
    const t = Number(conv.createdAt);
    if (!isNaN(t) && t > 0) return t;
  }

  if (typeof conv?.id === 'string') {
    const match = conv.id.match(/(\d{12,14})/);
    if (match) {
      const ts = parseInt(match[1], 10);
      if (!isNaN(ts) && ts > 1600000000000 && ts < 2500000000000) {
        return ts;
      }
    }
  }

  if (conv?.messages && conv.messages.length > 0) {
    const lastMsg = conv.messages[conv.messages.length - 1];
    if (lastMsg?.timestamp) {
      const t = new Date(lastMsg.timestamp).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
  }

  return Date.now() - index * (1000 * 60 * 60 * 12);
}

function Sidebar({
  conversations = [],
  activeId,
  activeView = 'chat',
  onSelectView,
  onSelectConv,
  onNewChat,
  onDeleteConv,
  onRenameConv,
  onClearAllConvs,
  hasApiKey,
  onOpenApiKeyModal,
  isDarkMode,
  onToggleTheme,
  isCollapsed,
  onToggleCollapse
}) {
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

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

  const startEditing = (conv, e) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditingTitle(conv.title || '');
  };

  const saveEditing = (id, e) => {
    if (e) e.stopPropagation();
    if (onRenameConv && editingTitle.trim()) {
      onRenameConv(id, editingTitle.trim());
    }
    setEditingId(null);
  };

  const cancelEditing = (e) => {
    if (e) e.stopPropagation();
    setEditingId(null);
  };

  // Chronological Grouping
  const groupedSections = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86400000;
    const startOfLast7Days = startOfToday - 7 * 86400000;

    const groups = {
      today: [],
      yesterday: [],
      last7Days: [],
      older: []
    };

    conversations.forEach((conv, index) => {
      const ts = getConversationTimestamp(conv, index);
      if (ts >= startOfToday) {
        groups.today.push(conv);
      } else if (ts >= startOfYesterday) {
        groups.yesterday.push(conv);
      } else if (ts >= startOfLast7Days) {
        groups.last7Days.push(conv);
      } else {
        groups.older.push(conv);
      }
    });

    return [
      { title: 'Today', items: groups.today },
      { title: 'Yesterday', items: groups.yesterday },
      { title: 'Previous 7 Days', items: groups.last7Days },
      { title: 'Older', items: groups.older }
    ].filter(g => g.items.length > 0);
  }, [conversations]);

  // Filtered by Search
  const filteredConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return null;
    return conversations.filter(c => (c.title || '').toLowerCase().includes(query));
  }, [conversations, searchQuery]);

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
          isCollapsed ? '-translate-x-full md:translate-x-0 md:w-16' : 'translate-x-0 w-[268px] sm:w-[260px] md:w-[246px]'
        }`}
      >
        {/* Header: Clean Brand & Fast Action Icons */}
        <div className="h-11 px-2.5 flex items-center justify-between shrink-0 border-b border-slate-200/50 dark:border-slate-800/50">
          {!isCollapsed ? (
            <>
              <div className="flex items-center space-x-2 animate-fade-in min-w-0">
                <img 
                  src="/devnexes-logo.png" 
                  alt="Devnexes AI" 
                  className="w-5.5 h-5.5 object-contain rounded-md"
                />
                <span className="font-semibold text-[13px] text-slate-800 dark:text-slate-100 tracking-tight truncate">
                  Devnexes AI
                </span>
              </div>
              <div className="flex items-center space-x-1 shrink-0">
                {conversations.length > 2 && (
                  <button
                    onClick={() => {
                      setIsSearchOpen(prev => !prev);
                      if (isSearchOpen) setSearchQuery('');
                    }}
                    className={`w-6.5 h-6.5 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                      isSearchOpen || searchQuery
                        ? 'text-[#0066FF] dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60'
                        : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                    }`}
                    title={isSearchOpen ? 'Close Search' : 'Search Chats'}
                  >
                    <Search size={13} />
                  </button>
                )}
                <button
                  onClick={onToggleCollapse}
                  className="w-6.5 h-6.5 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                  title="Collapse Sidebar"
                >
                  <PanelLeftClose size={14} />
                </button>
              </div>
            </>
          ) : (
            <div className="w-full flex items-center justify-center relative group">
              <button
                onClick={onToggleCollapse}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-[#0066FF] dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800/80 transition-all cursor-pointer"
                title="Expand Sidebar"
              >
                <PanelLeftOpen size={16} className="group-hover:scale-105 transition-transform" />
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

        {/* Navigation & Fast Action Buttons */}
        <div className="p-2 pb-1.5 shrink-0 space-y-1">
          {!isCollapsed ? (
            <>
              {/* New Chat Button */}
              <button
                onClick={() => {
                  onSelectView?.('chat');
                  onNewChat();
                  handleMobileClose();
                }}
                className={`w-full h-9 sm:h-8.5 flex items-center justify-between px-3 sm:px-2.5 rounded-xl text-xs sm:text-xs font-semibold transition-all duration-150 cursor-pointer group ${
                  activeView === 'chat'
                    ? 'bg-[#0066FF] hover:bg-blue-600 active:scale-[0.98] text-white shadow-xs shadow-blue-500/20'
                    : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-800'
                }`}
                title="Start New Chat"
              >
                <div className="flex items-center space-x-2">
                  <Plus size={14} strokeWidth={2.5} className="group-hover:rotate-90 transition-transform duration-200" />
                  <span className="text-[13px] sm:text-[12px]">New chat</span>
                </div>
              </button>

              {/* AI Image Studio Button (Devnexes ke neeche image ka button) */}
              <button
                onClick={() => {
                  onSelectView?.('images');
                  handleMobileClose();
                }}
                className={`w-full h-9 sm:h-8.5 flex items-center justify-between px-3 sm:px-2.5 rounded-xl text-xs sm:text-xs font-semibold transition-all duration-150 cursor-pointer group ${
                  activeView === 'images'
                    ? 'bg-blue-50 dark:bg-blue-950/80 text-[#0066FF] dark:text-blue-400 border border-blue-200/90 dark:border-blue-800 shadow-2xs'
                    : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-800'
                }`}
                title="AI Image Studio"
              >
                <div className="flex items-center space-x-2">
                  <Sparkles size={14} className="text-[#0066FF] dark:text-blue-400 group-hover:scale-110 transition-transform" />
                  <span className="text-[13px] sm:text-[12px]">Images</span>
                </div>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-blue-100 dark:bg-blue-950 text-[#0066FF] dark:text-blue-400">
                  Studio
                </span>
              </button>
            </>
          ) : (
            <div className="space-y-1.5 flex flex-col items-center">
              <div className="relative group flex justify-center">
                <button
                  onClick={() => {
                    onSelectView?.('chat');
                    onNewChat();
                    handleMobileClose();
                  }}
                  className={`w-8.5 h-8.5 flex items-center justify-center rounded-xl transition-all duration-150 cursor-pointer ${
                    activeView === 'chat'
                      ? 'bg-[#0066FF] hover:bg-blue-600 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  title="New Chat"
                >
                  <Plus size={16} strokeWidth={2.5} />
                </button>
                <div className="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 hidden group-hover:flex items-center z-50 pointer-events-none animate-fade-in">
                  <div className="px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-slate-800 text-white text-[11px] font-medium shadow-xl whitespace-nowrap border border-slate-700/50">
                    New Chat
                  </div>
                </div>
              </div>

              <div className="relative group flex justify-center">
                <button
                  onClick={() => {
                    onSelectView?.('images');
                    handleMobileClose();
                  }}
                  className={`w-8.5 h-8.5 flex items-center justify-center rounded-xl transition-all duration-150 cursor-pointer ${
                    activeView === 'images'
                      ? 'bg-blue-50 dark:bg-blue-950/80 text-[#0066FF] dark:text-blue-400 border border-blue-200/90 dark:border-blue-800'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  title="AI Images Studio"
                >
                  <Sparkles size={15} />
                </button>
                <div className="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 hidden group-hover:flex items-center z-50 pointer-events-none animate-fade-in">
                  <div className="px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-slate-800 text-white text-[11px] font-medium shadow-xl whitespace-nowrap border border-slate-700/50">
                    AI Images Studio
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Search Bar (Toggled on-demand, doesn't waste permanent space) */}
        {!isCollapsed && (isSearchOpen || searchQuery) && (
          <div className="px-2.5 pb-2 shrink-0 animate-fade-in">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats..."
                className="w-full h-8 pl-7 pr-6 text-xs bg-slate-200/50 dark:bg-slate-800/50 hover:bg-slate-200/70 dark:hover:bg-slate-800/70 focus:bg-white dark:focus:bg-slate-900 border border-transparent focus:border-blue-400/50 rounded-xl outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-all font-sans"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
                  title="Clear search"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Clear All Confirmation Box */}
        {!isCollapsed && showClearConfirm && (
          <div className="mx-2.5 mb-2 p-2.5 rounded-xl bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs animate-fade-in shrink-0">
            <p className="text-[11.5px] font-medium text-rose-700 dark:text-rose-300 mb-2">
              Clear all chats and start fresh?
            </p>
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => {
                  onClearAllConvs();
                  setShowClearConfirm(false);
                }}
                className="px-2.5 py-1 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-semibold cursor-pointer transition-colors shadow-2xs"
              >
                Yes, clear
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-[11px] font-medium cursor-pointer transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Divider in Collapsed Mode */}
        {isCollapsed && (
          <div className="w-8 h-[1px] bg-slate-200 dark:bg-slate-800/80 mx-auto my-1 shrink-0" />
        )}

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1 custom-scrollbar">
          {/* User-friendly Chat History Header */}
          {!isCollapsed && !filteredConversations && conversations.length > 0 && (
            <div className="px-2 pt-2.5 pb-1 flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 select-none">
              <div className="flex items-center space-x-1.5">
                <Clock size={12} className="text-slate-400 dark:text-slate-500" />
                <span>Chat History</span>
              </div>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-200/60 dark:bg-slate-800 text-[9.5px] font-mono text-slate-500 dark:text-slate-400">
                {conversations.length}
              </span>
            </div>
          )}

          {isCollapsed ? (
            // COLLAPSED MODE LIST
            conversations.map((conv) => {
              const isActive = conv.id === activeId && activeView === 'chat';
              return (
                <div key={conv.id} className="relative group flex items-center justify-center py-0.5">
                  <button
                    onClick={() => {
                      onSelectView?.('chat');
                      onSelectConv(conv.id);
                      handleMobileClose();
                    }}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer ${isActive
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
            })
          ) : filteredConversations ? (
            // SEARCH FILTER RESULTS
            filteredConversations.length > 0 ? (
              <div className="space-y-0.5">
                <div className="px-2 pt-2 pb-1 text-[11px] font-medium text-slate-400 dark:text-slate-500 select-none">
                  Matching ({filteredConversations.length})
                </div>
                {filteredConversations.map(conv => renderItem(conv))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                No chats found for "{searchQuery}"
              </div>
            )
          ) : (
            // CHRONOLOGICAL GROUPED SECTIONS (Clean & user-friendly)
            groupedSections.map((section) => (
              <div key={section.title} className="space-y-0.5">
                <div className="px-2 pt-2.5 pb-1 text-[10.5px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider select-none flex items-center space-x-1.5">
                  <span className="w-1 h-1 rounded-full bg-[#0066FF]/60 dark:bg-blue-400/60" />
                  <span>{section.title}</span>
                </div>
                {section.items.map(conv => renderItem(conv))}
              </div>
            ))
          )}
        </div>

        {/* Footer: API Key & Theme */}
        <div className="p-2 border-t border-slate-200/60 dark:border-slate-800/60 space-y-1 shrink-0 bg-white/40 dark:bg-[#060914]/40">

          {/* API Key Status Item */}
          <div className="relative group flex justify-center">
            <button
              onClick={onOpenApiKeyModal}
              className={`w-full h-8 flex items-center justify-between px-2.5 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer ${isCollapsed ? 'w-9 h-8 justify-center px-0' : ''
                }`}
              title={!isCollapsed ? 'API Key Settings' : ''}
            >
              <div className="flex items-center space-x-2 min-w-0">
                {hasApiKey ? (
                  <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
                ) : (
                  <Key size={14} className="text-[#0066FF] dark:text-blue-400 shrink-0" />
                )}
                {!isCollapsed && (
                  <span className="truncate text-[11.5px]">
                    {hasApiKey ? 'API Key Active' : 'Set API Key'}
                  </span>
                )}
              </div>
              {!isCollapsed && (
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasApiKey ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
              )}
            </button>

            {/* Collapsed Tooltip */}
            {isCollapsed && (
              <div className="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 hidden group-hover:flex items-center z-50 pointer-events-none animate-fade-in">
                <div className="px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-slate-800 text-white text-[11px] font-medium shadow-xl whitespace-nowrap border border-slate-700/50 flex items-center space-x-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${hasApiKey ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <span>{hasApiKey ? 'API Key Active' : 'Set API Key'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Bottom row: Theme Toggle + Clear history */}
          {!isCollapsed ? (
            <div className="flex items-center justify-between pt-0.5 px-1">
              <button
                onClick={onToggleTheme}
                className="flex items-center space-x-1.5 px-2 py-1 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {isDarkMode ? <Sun size={13} className="text-amber-400" /> : <Moon size={13} className="text-slate-500" />}
                <span className="text-[11.5px]">{isDarkMode ? 'Light' : 'Dark'}</span>
              </button>

              {onClearAllConvs && conversations.length > 1 && (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="flex items-center space-x-1 px-2 py-1 rounded-lg text-[11px] text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                  title="Clear chat history"
                >
                  <Trash2 size={11} />
                  <span>Clear all</span>
                </button>
              )}
            </div>
          ) : (
            /* Collapsed Theme Toggle */
            <div className="relative group flex justify-center">
              <button
                onClick={onToggleTheme}
                className="w-9 h-8 flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                title="Toggle Theme"
              >
                {isDarkMode ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} />}
              </button>
            </div>
          )}
        </div>

      </aside>
    </>
  );

  // Helper to render individual conversation items in expanded mode
  function renderItem(conv) {
    const isActive = conv.id === activeId && activeView === 'chat';
    const isConfirming = confirmDeleteId === conv.id;
    const isEditing = editingId === conv.id;

    // Inline Rename State
    if (isEditing) {
      return (
        <div
          key={conv.id}
          className="flex items-center h-8.5 px-2 rounded-xl bg-white dark:bg-slate-900 border border-blue-500/80 shadow-xs animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <MessageSquare size={13} className="shrink-0 text-blue-500 mr-1.5" />
          <input
            type="text"
            autoFocus
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEditing(conv.id, e);
              if (e.key === 'Escape') cancelEditing(e);
            }}
            onBlur={(e) => saveEditing(conv.id, e)}
            className="flex-1 bg-transparent text-xs text-slate-800 dark:text-slate-100 outline-none min-w-0"
          />
          <button
            onClick={(e) => saveEditing(conv.id, e)}
            className="p-1 rounded text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer ml-1"
            title="Save"
          >
            <Check size={12} strokeWidth={2.5} />
          </button>
          <button
            onClick={cancelEditing}
            className="p-1 rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            title="Cancel"
          >
            <X size={12} strokeWidth={2.5} />
          </button>
        </div>
      );
    }

    // Inline Delete Confirmation
    if (isConfirming) {
      return (
        <div
          key={conv.id}
          className="flex items-center justify-between h-8.5 px-2.5 rounded-xl text-xs bg-slate-100/90 dark:bg-slate-800/80 border border-slate-300/70 dark:border-slate-700/70 text-slate-700 dark:text-slate-200 animate-fade-in"
        >
          <span className="truncate font-medium text-[11.5px] max-w-[125px] text-slate-600 dark:text-slate-300">
            {conv.title || 'New Chat'}
          </span>
          <div className="flex items-center space-x-1 shrink-0 ml-1">
            <span className="text-[10.5px] font-medium text-rose-500 dark:text-rose-400 mr-1">
              Delete?
            </span>
            <button
              onClick={(e) => handleConfirmDelete(conv.id, e)}
              className="px-2 py-0.5 rounded-md bg-rose-500 hover:bg-rose-600 text-white text-[10.5px] font-semibold cursor-pointer transition-colors shadow-2xs"
              title="Confirm delete"
            >
              Yes
            </button>
            <button
              onClick={handleCancelDelete}
              className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-[10.5px] font-medium cursor-pointer transition-colors"
              title="Cancel"
            >
              No
            </button>
          </div>
        </div>
      );
    }

    // Standard Chat Item (Clean, Ergonomic, No Boxed Borders)
    return (
      <div
        key={conv.id}
        onClick={() => {
          onSelectView?.('chat');
          onSelectConv(conv.id);
          handleMobileClose();
        }}
        className={`group relative flex items-center justify-between h-9 sm:h-8.5 px-3 sm:px-2.5 rounded-xl text-xs sm:text-xs cursor-pointer transition-all duration-150 ${isActive
            ? 'bg-slate-200/80 dark:bg-slate-800/80 text-slate-900 dark:text-white font-medium shadow-2xs'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/40 border border-transparent font-normal'
          }`}
        title={conv.title}
      >
        <div className="flex items-center space-x-2.5 min-w-0 flex-1 pr-1 pl-0.5">
          <MessageSquare
            size={14}
            className={`shrink-0 transition-colors ${isActive
                ? 'text-[#0066FF] dark:text-blue-400'
                : 'text-slate-400/80 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
              }`}
          />
          <span className="truncate text-[13.5px] sm:text-[12.5px] leading-tight">
            {conv.title || 'New Chat'}
          </span>
        </div>

        {/* Action buttons on hover */}
        <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1">
          {onRenameConv && (
            <button
              onClick={(e) => startEditing(conv, e)}
              className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-300/60 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
              title="Rename"
            >
              <Pencil size={11} />
            </button>
          )}

          {conversations.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfirmDeleteId(conv.id);
              }}
              className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
              title="Delete"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>
    );
  }
}

export default memo(Sidebar);