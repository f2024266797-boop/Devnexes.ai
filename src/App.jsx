import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import AgentTraceTree from './components/AgentTraceTree';
import ChatInput from './components/ChatInput';
import ApiKeyModal from './components/ApiKeyModal';
import ArtifactModal from './components/ArtifactModal';
import IdeCodePanel from './components/IdeCodePanel';
import { getGroqApiKey, streamGroqChat, generateDynamicAgentPipeline, AVAILABLE_MODELS } from './services/groqService';
import MarkdownRenderer from './components/MarkdownRenderer';
import {
  AlertCircle,
  BookOpen,
  PanelLeftOpen,
  ArrowDown,
  X
} from 'lucide-react';

const createInitialConversation = () => ({
  id: `conv-${Date.now()}`,
  title: 'New Chat',
  messages: []
});

const DYNAMIC_GREETINGS = [
  {
    title: "What can I build for you today?",
    subtitle: "Full-stack apps, modern web UI, scripts, or algorithms.",
    chips: ["Create a Portfolio Website", "Build a Financial Dashboard", "Write a Python Script", "Latest AI Trends 2026"]
  },
  {
    title: "How can I help you today?",
    subtitle: "Real-time research, clean code, or technical architecture.",
    chips: ["Design a Modern Landing Page", "Analyze Code & Find Bugs", "Compare Web Frameworks", "Write a Leave Letter"]
  },
  {
    title: "Where should we start?",
    subtitle: "Ask anything — from interactive apps to deep research.",
    chips: ["Build a Weather App UI", "Create an E-commerce Card", "Explain Graph Algorithms", "Draft a Project Proposal"]
  },
  {
    title: "What are you working on?",
    subtitle: "Intelligent code generation, live search, and reasoning at your fingertips.",
    chips: ["Create a Task Manager App", "Write a Professional Email", "Search Latest Tech News", "Generate SQL Schema"]
  },
  {
    title: "Ready to innovate?",
    subtitle: "Design stunning components or explore new creative ideas.",
    chips: ["Build an Interactive Chart", "Implement Dark/Light Mode", "Research Emerging Tech", "Write an Algorithm"]
  }
];

function cleanCodeContent(code) {
  if (!code) return '';
  return code
    .replace(/^```[a-zA-Z0-9_-]*\n?/m, '')
    .replace(/\n?```\s*$/m, '')
    .trim();
}

export default function App() {
  const [greetingIndex, setGreetingIndex] = useState(() => Math.floor(Math.random() * DYNAMIC_GREETINGS.length));
  const currentGreeting = DYNAMIC_GREETINGS[greetingIndex] || DYNAMIC_GREETINGS[0];

  const [conversations, setConversations] = useState(() => {
    try {
      const saved = localStorage.getItem('devnexes_conversations');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load saved conversations:', e);
    }
    return [createInitialConversation()];
  });

  const [activeId, setActiveId] = useState(() => {
    const savedActive = localStorage.getItem('devnexes_active_id');
    return savedActive || undefined;
  });

  const [selectedModel, setSelectedModel] = useState(() => {
    return localStorage.getItem('devnexes_selected_model') || AVAILABLE_MODELS[0].id;
  });

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return false; // Default to Light Theme as requested
  });
  const [hasApiKey, setHasApiKey] = useState(!!getGroqApiKey());
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [agentTraceMode, setAgentTraceMode] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [previewModal, setPreviewModal] = useState({ isOpen: false, code: '', title: '' });
  const [idePanel, setIdePanel] = useState({ isOpen: false, code: '', title: '', language: '' });
  const [selectedImageModal, setSelectedImageModal] = useState({ isOpen: false, url: '' });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  const chatContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const isAutoScrollLocked = useRef(true);

  // Sync activeId with loaded conversations
  useEffect(() => {
    if (!activeId || !conversations.some(c => c.id === activeId)) {
      if (conversations.length > 0) {
        setActiveId(conversations[0].id);
      }
    }
  }, [conversations, activeId]);

  // Persist conversations to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('devnexes_conversations', JSON.stringify(conversations));
    } catch (e) {
      console.warn('Failed to save conversations to storage:', e);
    }
  }, [conversations]);

  // Persist activeId to localStorage
  useEffect(() => {
    if (activeId) {
      localStorage.setItem('devnexes_active_id', activeId);
    }
  }, [activeId]);

  // Persist selected model to localStorage
  useEffect(() => {
    if (selectedModel) {
      localStorage.setItem('devnexes_selected_model', selectedModel);
    }
  }, [selectedModel]);

  // Theme synchronization
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Handle user scroll detection
  const handleChatScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    // Auto-scroll stays enabled if user is within 180px of bottom
    isAutoScrollLocked.current = distanceFromBottom < 180;
    setShowScrollBottom(distanceFromBottom > 200);
  };

  const scrollToBottom = (smooth = true) => {
    if (chatContainerRef.current) {
      if (smooth) {
        chatContainerRef.current.scrollTo({
          top: chatContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      } else {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
      setShowScrollBottom(false);
      isAutoScrollLocked.current = true;
    }
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' });
    }
  };

  const scrollToBottomInstant = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
    }
  };

  // Bulletproof live Auto-scroll: tracks all DOM height expansions (streaming tokens, steps reveal)
  useEffect(() => {
    if (!chatContainerRef.current) return;
    const container = chatContainerRef.current;
    
    const resizeObserver = new ResizeObserver(() => {
      if (isAutoScrollLocked.current) {
        container.scrollTop = container.scrollHeight;
      }
    });

    const innerDiv = container.querySelector('.messages-wrapper') || container.firstElementChild;
    if (innerDiv) {
      resizeObserver.observe(innerDiv);
    }

    return () => resizeObserver.disconnect();
  }, [activeId, conversations.length]);

  // Secondary reactive autoscroll on state updates & streaming
  useEffect(() => {
    if (!chatContainerRef.current) return;
    const container = chatContainerRef.current;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    
    if (isAutoScrollLocked.current || (isLoading && distanceFromBottom < 300)) {
      container.scrollTop = container.scrollHeight;
    }
  }, [conversations, isLoading]);

  const activeConv = conversations.find(c => c.id === activeId) || conversations[0];

  const handleSelectConv = (id) => setActiveId(id);

  const handleNewChat = () => {
    const newConv = createInitialConversation();
    setConversations(prev => [newConv, ...prev]);
    setActiveId(newConv.id);
    setGreetingIndex(prev => (prev + 1) % DYNAMIC_GREETINGS.length);
  };

  const handleDeleteConv = (id) => {
    if (conversations.length <= 1) return;
    const remaining = conversations.filter(c => c.id !== id);
    setConversations(remaining);
    if (activeId === id) setActiveId(remaining[0].id);
  };

  const handleOpenPreview = (code, title) => {
    setPreviewModal({ isOpen: true, code, title });
  };

  const handleSendMessage = async (userText, userImage = null) => {
    if ((!userText?.trim() && !userImage) || isLoading) return;

    const key = getGroqApiKey();
    if (!key) { setIsApiKeyModalOpen(true); return; }

    const promptToSend = userText?.trim() || 'Please analyze this screenshot / image in full detail.';

    // Instant auto-scroll to bottom on message submission across frames
    isAutoScrollLocked.current = true;
    setShowScrollBottom(false);
    scrollToBottomInstant();
    setTimeout(scrollToBottomInstant, 30);
    setTimeout(scrollToBottomInstant, 100);
    setTimeout(scrollToBottomInstant, 250);

    const convId = activeId;
    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `asst-${Date.now()}`;

    const currentConv = conversations.find(c => c.id === convId);
    const historyBeforeSend = currentConv ? currentConv.messages : [];

    // Add user message with image attached if present
    setConversations(prev => prev.map(c => {
      if (c.id !== convId) return c;
      return {
        ...c,
        title: c.messages.length === 0 ? (userImage ? '📸 Image Analysis' : promptToSend.slice(0, 32)) : c.title,
        messages: [...c.messages, { id: userMsgId, role: 'user', content: promptToSend, image: userImage }]
      };
    }));

    setIsLoading(true);

    if (agentTraceMode) {
      // Add placeholder for pipeline response
      setConversations(prev => prev.map(c => {
        if (c.id !== convId) return c;
        return {
          ...c,
          messages: [
            ...c.messages,
            {
              id: assistantMsgId,
              role: 'assistant',
              isTrace: true,
              traceData: { steps: [] }
            }
          ]
        };
      }));

      try {
        let hasCode = false;

        await generateDynamicAgentPipeline({
          userPrompt: promptToSend,
          userImage: userImage,
          model: selectedModel,
          apiKey: key,
          messagesHistory: historyBeforeSend,
          onStepUpdate: (steps, isGreeting) => {
            if (isGreeting) {
              const respContent = steps.find(s => s.type === 'response')?.content || '';
              setConversations(prev => prev.map(c => {
                if (c.id !== convId) return c;
                return {
                  ...c,
                  messages: c.messages.map(m =>
                    m.id === assistantMsgId
                      ? { ...m, isTrace: false, content: respContent }
                      : m
                  )
                };
              }));
              return;
            }

            // Update code panel live
            const artStep = steps.find(s => s.type === 'code' || s.type === 'artifact');
            if (artStep && artStep.code && artStep.code.trim()) {
              hasCode = true;
              const cleanCode = cleanCodeContent(artStep.code) || artStep.code;
              setIdePanel(prev => ({
                ...prev,
                code: cleanCode,
                title: artStep.title || prev.title,
                language: artStep.language || prev.language
              }));
            }

            setConversations(prev => prev.map(c => {
              if (c.id !== convId) return c;
              return {
                ...c,
                messages: c.messages.map(m =>
                  m.id === assistantMsgId
                    ? { ...m, isTrace: true, traceData: { steps } }
                    : m
                )
              };
            }));
          },
          onError: (err) => console.error(err)
        });

        // Auto-open code canvas when code is generated
        if (hasCode) {
          setIdePanel(prev => ({ ...prev, isOpen: true }));
        }

      } catch (err) {
        setConversations(prev => prev.map(c => {
          if (c.id !== convId) return c;
          return {
            ...c,
            messages: c.messages.map(m =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    traceData: {
                      steps: [{ type: 'response', content: `Error: ${err.message}` }]
                    }
                  }
                : m
            )
          };
        }));
      } finally {
        setIsLoading(false);
      }

    } else {
      // Standard direct chat mode (supports vision via llama-3.2-11b-vision-preview)
      setConversations(prev => prev.map(c => {
        if (c.id !== convId) return c;
        return {
          ...c,
          messages: [
            ...c.messages,
            { id: assistantMsgId, role: 'assistant', isTrace: false, content: '' }
          ]
        };
      }));

      try {
        const userMsgPayload = userImage
          ? [
              { type: 'text', text: promptToSend },
              { type: 'image_url', image_url: { url: userImage } }
            ]
          : promptToSend;

        await streamGroqChat({
          messages: [
            { role: 'system', content: 'You are Devnexes AI, a helpful AI assistant. Be clear and concise. If an image is provided, analyze its components, OCR text, and design thoroughly.' },
            ...historyBeforeSend.slice(-6).map(m => ({
              role: m.role === 'user' ? 'user' : 'assistant',
              content: m.content || 'Responded to prompt'
            })),
            { role: 'user', content: userMsgPayload }
          ],
          model: selectedModel,
          apiKey: key,
          onChunk: (_, fullText) => {
            setConversations(prev => prev.map(c => {
              if (c.id !== convId) return c;
              return {
                ...c,
                messages: c.messages.map(m =>
                  m.id === assistantMsgId ? { ...m, content: fullText } : m
                )
              };
            }));
          },
          onError: (err) => console.error(err)
        });
      } catch (err) {
        setConversations(prev => prev.map(c => {
          if (c.id !== convId) return c;
          return {
            ...c,
            messages: c.messages.map(m =>
              m.id === assistantMsgId ? { ...m, content: `Error: ${err.message}` } : m
            )
          };
        }));
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className={`flex h-[100dvh] max-h-[100dvh] w-full max-w-full font-sans overflow-hidden ${isDarkMode ? 'bg-[#080b14] text-slate-100' : 'bg-[#f8fafc] text-slate-900'}`}>

      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelectConv={handleSelectConv}
        onNewChat={handleNewChat}
        onDeleteConv={handleDeleteConv}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        hasApiKey={hasApiKey}
        onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
        isDarkMode={isDarkMode}
        onToggleTheme={() => setIsDarkMode(!isDarkMode)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Main workspace */}
      <div className="flex-1 flex h-full overflow-hidden w-full max-w-full min-w-0">

        {/* Chat pane */}
        <main className={`flex-1 flex flex-col h-full overflow-hidden min-w-0 w-full max-w-full relative border-r ${isDarkMode ? 'border-slate-800/60' : 'border-slate-200'}`}>

          {/* Header */}
          <header className={`h-11 sm:h-12 px-2.5 sm:px-4 flex items-center justify-between shrink-0 border-b ${isDarkMode ? 'border-slate-800/60 bg-[#080b14]/90' : 'border-slate-200 bg-white/90'} backdrop-blur-md z-10`}>

            {/* Left: Mobile sidebar toggle + Brand logo & title */}
            <div className="flex items-center space-x-2 truncate pr-2">
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer md:hidden"
                title="Toggle Sidebar"
              >
                <PanelLeftOpen size={16} />
              </button>

              {isSidebarCollapsed ? (
                /* When sidebar is collapsed: show brand logo and title */
                <div className="flex items-center space-x-2 truncate">
                  <img 
                    src="/devnexes-logo.png" 
                    alt="Devnexes AI" 
                    className="w-5.5 h-5.5 sm:w-6 sm:h-6 object-contain shrink-0 animate-logo-float"
                  />
                  <div className="flex items-center space-x-1.5 truncate">
                    <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white tracking-tight shrink-0">
                      Devnexes AI
                    </span>
                    <span className="text-slate-300 dark:text-slate-700 text-xs hidden sm:inline">/</span>
                    <span className={`text-xs font-medium truncate max-w-[120px] sm:max-w-[200px] md:max-w-xs hidden sm:inline ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      {activeConv?.title || 'New Chat'}
                    </span>
                  </div>
                </div>
              ) : (
                /* When sidebar is open: show ONLY the conversation title (Zero Duplication) */
                <div className="flex items-center space-x-2 truncate">
                  <span className={`text-xs sm:text-sm font-semibold truncate max-w-[200px] sm:max-w-xs md:max-w-md ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                    {activeConv?.title || 'New Chat'}
                  </span>
                </div>
              )}
            </div>

            {/* Right actions */}
            <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0">
              {!hasApiKey && (
                <button
                  onClick={() => setIsApiKeyModalOpen(true)}
                  className="flex items-center space-x-1 text-amber-600 dark:text-amber-400 font-medium px-2 py-0.5 sm:py-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-[10.5px] sm:text-xs hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors cursor-pointer"
                >
                  <AlertCircle size={11} />
                  <span className="hidden sm:inline">Set API Key</span>
                </button>
              )}

              {/* Book Icon Button for Code Canvas / Workspace */}
              <button
                onClick={() => setIdePanel(prev => ({ ...prev, isOpen: !prev.isOpen }))}
                className={`p-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
                  idePanel.isOpen
                    ? 'bg-blue-100 dark:bg-blue-950/80 text-[#0066FF] dark:text-blue-400 ring-1 ring-blue-500/30 shadow-xs'
                    : isDarkMode
                      ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
                title={idePanel.isOpen ? "Close Code Canvas" : "Open Code Canvas"}
              >
                <BookOpen size={15} />
              </button>
            </div>
          </header>

          {/* Messages area or Centered Welcome Input */}
          <div
            ref={chatContainerRef}
            onScroll={handleChatScroll}
            className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col w-full max-w-full"
          >
            {activeConv && activeConv.messages.length > 0 ? (
              <div className="messages-wrapper max-w-3xl w-full mx-auto px-3.5 sm:px-6 md:px-8 py-3 sm:py-6 space-y-4 sm:space-y-6 overflow-x-hidden">
                {activeConv.messages.map((msg) => (
                  <div key={msg.id} className="animate-bubble-in w-full max-w-full overflow-hidden">

                    {msg.role === 'user' ? (
                      /* User message — right aligned */
                      <div className="flex justify-end w-full max-w-full">
                        <div className={`max-w-[88%] sm:max-w-xl px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl rounded-tr-xs text-[12.5px] sm:text-[13.5px] leading-relaxed shadow-2xs border break-words ${isDarkMode ? 'bg-[#181f33] border-blue-900/40 text-slate-100' : 'bg-blue-50/90 border-blue-100 text-slate-900'}`}>
                          {msg.image && (
                            <div
                              onClick={() => setSelectedImageModal({ isOpen: true, url: msg.image })}
                              className="mb-2 max-w-xs rounded-xl overflow-hidden border border-slate-300/80 dark:border-slate-700/80 bg-slate-900/10 dark:bg-black/40 cursor-pointer group relative"
                              title="Click to zoom image"
                            >
                              <img src={msg.image} alt="User attachment" className="max-h-52 w-auto object-contain rounded-lg group-hover:scale-[1.02] transition-transform duration-200" />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                                <span className="opacity-0 group-hover:opacity-100 px-2 py-0.5 rounded-md bg-black/70 text-white text-[10px] font-medium transition-opacity">Zoom</span>
                              </div>
                            </div>
                          )}
                          {msg.content}
                        </div>
                      </div>
                    ) : (
                      /* AI message — clean direct thought process & content */
                      <div className="w-full max-w-full overflow-hidden">
                        {/* Message / Trace Content */}
                        <div className="w-full max-w-full overflow-hidden">
                          {msg.isTrace ? (
                            <AgentTraceTree
                              traceData={msg.traceData}
                              isExecuting={isLoading && activeConv.messages[activeConv.messages.length - 1]?.id === msg.id}
                              onOpenPreview={handleOpenPreview}
                              onOpenIdePanel={(code, title, language) => setIdePanel({ isOpen: true, code, title, language })}
                              onSendMessage={handleSendMessage}
                            />
                          ) : (
                            <div className="text-[13px] sm:text-[13.5px] leading-relaxed">
                              <MarkdownRenderer content={msg.content} />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                  </div>
                ))}

                {/* Loading indicator */}
                {isLoading && activeConv.messages[activeConv.messages.length - 1]?.role === 'user' && (
                  <div className="flex items-center space-x-2 pl-0.5 sm:pl-1 py-1">
                    <img src="/devnexes-logo.png" alt="Devnexes AI" className="w-5 h-5 object-contain animate-logo-float" />
                    <div className="flex space-x-1 px-2 py-1">
                      {[0, 1, 2].map(i => (
                        <div
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-[#0066FF]/70 animate-bounce"
                          style={{ animationDelay: `${i * 150}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            ) : (
              /* Welcome / empty state with centered ChatInput */
              <div className="flex-1 flex flex-col items-center justify-center px-3 sm:px-4 py-6 sm:py-8 select-none">
                <div className="w-full max-w-2xl space-y-4 sm:space-y-6 animate-fade-in">

                  {/* Logo + greeting */}
                  <div className="text-center space-y-2 sm:space-y-3">
                    <div className="inline-flex items-center justify-center relative">
                      <div className={`p-2.5 sm:p-3 rounded-2xl relative overflow-hidden border ${isDarkMode ? 'bg-slate-800/60 border-slate-700/50' : 'bg-white border-slate-200'} shadow-md`}>
                        <div className="absolute inset-0 pointer-events-none animate-mirror-shine bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                        <img
                          src="/devnexes-logo.png"
                          alt="Devnexes AI"
                          className="w-8 h-8 sm:w-11 sm:h-11 object-contain animate-logo-float relative z-10"
                        />
                      </div>
                    </div>

                    <div>
                      <h1 className={`text-xl sm:text-2xl font-semibold tracking-tight ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                        {currentGreeting.title}
                      </h1>
                      <p className={`mt-1 text-[11.5px] sm:text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {currentGreeting.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Centered Chat Input */}
                  <div className="w-full">
                    <ChatInput
                      onSendMessage={handleSendMessage}
                      isLoading={isLoading}
                      agentTraceMode={agentTraceMode}
                      onToggleAgentTraceMode={() => setAgentTraceMode(!agentTraceMode)}
                      isDarkMode={isDarkMode}
                    />
                  </div>

                  {/* Dynamic Suggestion Chips */}
                  {currentGreeting.chips && currentGreeting.chips.length > 0 && (
                    <div className="flex flex-wrap items-center justify-center gap-1.5 pt-0.5 px-2 animate-fade-in">
                      {currentGreeting.chips.map((chip, cIdx) => (
                        <button
                          key={cIdx}
                          onClick={() => handleSendMessage(chip)}
                          className={`text-[11px] sm:text-xs px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl border transition-all cursor-pointer select-none active:scale-95 ${
                            isDarkMode
                              ? 'bg-slate-800/50 hover:bg-slate-800 border-slate-700/60 text-slate-300 hover:text-white hover:border-blue-500/50'
                              : 'bg-white hover:bg-blue-50/60 border-slate-200/90 text-slate-700 hover:text-[#0066FF] hover:border-blue-300 shadow-2xs'
                          }`}
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  )}

                </div>
              </div>
            )}
          </div>

          {/* Floating Scroll to Bottom Arrow Button */}
          {showScrollBottom && activeConv && activeConv.messages.length > 0 && (
            <div className="absolute bottom-24 sm:bottom-28 left-1/2 -translate-x-1/2 z-30 animate-fade-in pointer-events-auto">
              <button
                onClick={scrollToBottom}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium border shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer backdrop-blur-md ${
                  isDarkMode
                    ? 'bg-slate-900/90 text-slate-200 border-slate-700/80 hover:bg-slate-800'
                    : 'bg-white/95 text-slate-700 border-slate-200/90 hover:bg-slate-50'
                }`}
                title="Scroll to bottom"
              >
                <ArrowDown size={13} className="text-[#0066FF] animate-bounce" />
                <span>Scroll down</span>
              </button>
            </div>
          )}

          {/* Bottom Chat Input — shown when conversation has messages */}
          {activeConv && activeConv.messages.length > 0 && (() => {
            const lastMsg = activeConv.messages[activeConv.messages.length - 1];
            const activeClarification = !isLoading && lastMsg?.isTrace
              ? lastMsg?.traceData?.steps?.find(s => s.type === 'clarification' || s.clarification)?.clarification
              : null;

            return (
              <ChatInput
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
                agentTraceMode={agentTraceMode}
                onToggleAgentTraceMode={() => setAgentTraceMode(!agentTraceMode)}
                isDarkMode={isDarkMode}
                activeClarification={activeClarification}
              />
            );
          })()}
        </main>

        {/* Code Canvas Panel */}
        <IdeCodePanel
          isOpen={idePanel.isOpen}
          onClose={() => setIdePanel(prev => ({ ...prev, isOpen: false }))}
          code={idePanel.code}
          title={idePanel.title}
          language={idePanel.language}
          onOpenPreview={handleOpenPreview}
        />

      </div>

      {/* Modals */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => {
          setIsApiKeyModalOpen(false);
          setHasApiKey(!!getGroqApiKey());
        }}
      />

      <ArtifactModal
        isOpen={previewModal.isOpen}
        onClose={() => setPreviewModal({ isOpen: false, code: '', title: '' })}
        code={previewModal.code}
        title={previewModal.title}
      />

      {/* Lightbox Image Zoom Modal */}
      {selectedImageModal.isOpen && (
        <div 
          onClick={() => setSelectedImageModal({ isOpen: false, url: '' })}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in cursor-pointer select-none"
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelectedImageModal({ isOpen: false, url: '' })}
              className="absolute -top-11 right-0 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer"
              title="Close image"
            >
              <X size={18} />
            </button>
            <img
              src={selectedImageModal.url}
              alt="Enlarged screenshot preview"
              className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl border border-white/10"
            />
          </div>
        </div>
      )}
    </div>
  );
}
