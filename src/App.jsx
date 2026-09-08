import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  X,
  Copy,
  Check,
  RotateCcw,
  Volume2,
  VolumeX,
  ThumbsUp,
  ThumbsDown,
  Pencil,
  Globe,
  Brain,
  Code2
} from 'lucide-react';

const QUICK_CAPABILITIES = [
  {
    id: 'deepThink',
    label: 'Deep Think',
    icon: Brain,
    description: 'Autonomous multi-step reasoning & planning'
  },
  {
    id: 'googleSearch',
    label: 'Google Search',
    icon: Globe,
    description: 'Real-time web knowledge grounding'
  },
  {
    id: 'canvasCode',
    label: 'Canvas Code',
    icon: Code2,
    description: 'Interactive live UI & code canvas'
  }
];

const createInitialConversation = () => ({
  id: `conv-${Date.now()}`,
  title: 'New Chat',
  messages: []
});

const DYNAMIC_GREETINGS = [
  "What can I build for you today?",
  "How can I help you today?",
  "Where should we start?",
  "What are you working on?",
  "Ready to build something amazing?"
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
  const [agentTraceMode, setAgentTraceMode] = useState(false); // Default to Fast Chat as requested
  const [isWebSearchActive, setIsWebSearchActive] = useState(false);
  const [isCanvasCodeActive, setIsCanvasCodeActive] = useState(false);
  const [dismissedCaps, setDismissedCaps] = useState([]);
  const [activeMobileCapIndex, setActiveMobileCapIndex] = useState(0);
  const [isMobileFlowPaused, setIsMobileFlowPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const activeAvailableCaps = QUICK_CAPABILITIES.filter(cap => !dismissedCaps.includes(cap.id));

  // Auto-flowing pill animation for mobile: flows right-to-left, pauses 1.2s at center, then advances to next
  useEffect(() => {
    if (isMobileFlowPaused || activeAvailableCaps.length <= 1) return;
    const timer = setInterval(() => {
      setActiveMobileCapIndex(prev => (prev + 1) % activeAvailableCaps.length);
    }, 2200); // 1.2s center pause + transition time
    return () => clearInterval(timer);
  }, [isMobileFlowPaused, activeAvailableCaps.length]);

  const handleDismissCapability = useCallback((id, e) => {
    e.stopPropagation();
    setDismissedCaps(prev => [...prev, id]);
  }, []);
  const [previewModal, setPreviewModal] = useState({ isOpen: false, code: '', title: '' });
  const [idePanel, setIdePanel] = useState({ isOpen: false, code: '', title: '', language: '' });
  const [selectedImageModal, setSelectedImageModal] = useState({ isOpen: false, url: '' });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [copiedMsgId, setCopiedMsgId] = useState(null);
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editingText, setEditingText] = useState('');

  const handleToggleWebSearch = useCallback(() => {
    setIsWebSearchActive(prev => !prev);
  }, []);

  const handleToggleCanvasCode = useCallback(() => {
    setIsCanvasCodeActive(prev => !prev);
  }, []);

  const handleCopyMessage = useCallback((msgId, text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 2000);
  }, []);

  const handleStartEdit = useCallback((msg) => {
    setEditingMsgId(msg.id);
    setEditingText(msg.content);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingMsgId(null);
    setEditingText('');
  }, []);

  const chatContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const isAutoScrollLocked = useRef(true);

  const conversationsRef = useRef(conversations);
  const activeIdRef = useRef(activeId);
  const selectedModelRef = useRef(selectedModel);
  const agentTraceModeRef = useRef(agentTraceMode);
  const isLoadingRef = useRef(isLoading);

  useEffect(() => {
    conversationsRef.current = conversations;
    activeIdRef.current = activeId;
    selectedModelRef.current = selectedModel;
    agentTraceModeRef.current = agentTraceMode;
    isLoadingRef.current = isLoading;
  });

  // Sync activeId with loaded conversations
  useEffect(() => {
    if (!activeId || !conversations.some(c => c.id === activeId)) {
      if (conversations.length > 0) {
        setActiveId(conversations[0].id);
      }
    }
  }, [conversations, activeId]);

  // Safe LocalStorage Persistence with Quota Safety & Base64 Compression
  useEffect(() => {
    try {
      // Create a lightweight sanitized copy of conversations for storage
      const sanitized = conversations.slice(0, 20).map(conv => ({
        ...conv,
        messages: conv.messages.slice(-30).map(msg => {
          // If image is a huge data URL (> 50KB), compress reference or keep lightweight thumbnail
          if (msg.image && typeof msg.image === 'string' && msg.image.length > 50000) {
            return { ...msg, image: msg.image.slice(0, 50000) + '...' };
          }
          return msg;
        })
      }));
      localStorage.setItem('devnexes_conversations', JSON.stringify(sanitized));
    } catch (e) {
      console.warn('LocalStorage quota limit reached. Pruning oldest conversation:', e);
      try {
        // Fallback: save only active and last 3 conversations without images
        const minimal = conversations.slice(0, 5).map(c => ({
          ...c,
          messages: c.messages.slice(-15).map(m => ({ ...m, image: null }))
        }));
        localStorage.setItem('devnexes_conversations', JSON.stringify(minimal));
      } catch (err) {
        console.error('Failed to save minimal conversations:', err);
      }
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

  // Handle user scroll detection: reveals scroll-to-bottom arrow when user scrolls up
  const handleChatScroll = useCallback(() => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    // Auto-scroll stays enabled only if user is within 80px of bottom
    const isNearBottom = distanceFromBottom < 80;
    isAutoScrollLocked.current = isNearBottom;
    setShowScrollBottom(distanceFromBottom > 90);
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
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
  }, []);

  const scrollToBottomInstant = useCallback(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
    }
  }, []);

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
    if (isAutoScrollLocked.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [conversations, isLoading]);

  const activeConv = conversations.find(c => c.id === activeId) || conversations[0];

  const handleSelectConv = useCallback((id) => setActiveId(id), []);

  const handleNewChat = useCallback(() => {
    const newConv = createInitialConversation();
    setConversations(prev => [newConv, ...prev]);
    setActiveId(newConv.id);
    setGreetingIndex(prev => (prev + 1) % DYNAMIC_GREETINGS.length);
  }, []);

  const handleDeleteConv = useCallback((id) => {
    setConversations(prev => {
      if (prev.length <= 1) return prev;
      const remaining = prev.filter(c => c.id !== id);
      if (activeIdRef.current === id) setActiveId(remaining[0].id);
      return remaining;
    });
  }, []);

  const handleOpenPreview = useCallback((code, title) => {
    setPreviewModal({ isOpen: true, code, title });
  }, []);

  const handleToggleTheme = useCallback(() => {
    setIsDarkMode(prev => !prev);
  }, []);

  const handleToggleCollapse = useCallback(() => {
    setIsSidebarCollapsed(prev => !prev);
  }, []);

  const handleOpenApiKeyModal = useCallback(() => {
    setIsApiKeyModalOpen(true);
  }, []);

  const handleToggleAgentTraceMode = useCallback(() => {
    setAgentTraceMode(prev => !prev);
  }, []);

  const executeGeneration = useCallback(async (promptToSend, userImage, historyBefore, assistantMsgId, convId) => {
    const key = getGroqApiKey();
    if (!key) { setIsApiKeyModalOpen(true); return; }

    setIsLoading(true);

    const hasInlineGoogle = /\/(google|search)\b/i.test(promptToSend);
    const hasInlineCanvas = /\/(canvas|code|artifact)\b/i.test(promptToSend);
    const hasInlineThink = /\/(think|deep|deepthink)\b/i.test(promptToSend);
    const hasInlineFast = /\/(fast|fastchat)\b/i.test(promptToSend);

    const effectiveWebSearch = isWebSearchActive || hasInlineGoogle;
    const effectiveCanvasCode = isCanvasCodeActive || hasInlineCanvas;
    const effectiveTraceMode = (hasInlineThink || agentTraceModeRef.current) && !hasInlineFast;

    // Automatic Smart Intent Recognition (even if user didn't write /slash or click filters)
    const lowerPrompt = promptToSend.toLowerCase();
    const isImplicitCodeIntent = /\b(banao|create|build|make|code|website|app|ui|frontend|component|html|react|script|store|ecommerce|canvas|game|program)\b/i.test(lowerPrompt);
    const isImplicitSearchIntent = /\b(search|dhoondo|dhundo|pata karo|kon ha|who is|latest|news|what is|kya ha|current|information)\b/i.test(lowerPrompt);

    const shouldRunAgentPipeline = effectiveTraceMode || effectiveWebSearch || effectiveCanvasCode || isImplicitCodeIntent || isImplicitSearchIntent;

    if (shouldRunAgentPipeline) {
      try {
        let hasCode = false;

        await generateDynamicAgentPipeline({
          userPrompt: promptToSend,
          userImage: userImage,
          model: selectedModelRef.current,
          apiKey: key,
          messagesHistory: historyBefore,
          forceWebSearch: effectiveWebSearch,
          forceCanvasCode: effectiveCanvasCode,
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

        if (hasCode || effectiveCanvasCode) {
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
      try {
        let systemPrompt = 'You are Devnexes AI, a world-class, sharp, and highly intelligent AI assistant. Follow strict query calibration: answer exactly what the user asks directly, cleanly, and accurately with zero filler or generic conversational preambles ("na extra, na kam"). Deliver high-density, actionable clarity and match the user\'s language (Roman Urdu, Urdu, or English) naturally.';
        
        if (isWebSearchActive) {
          systemPrompt += ' [REAL-TIME WEB SEARCH GROUNDING ENABLED]: Actively ground your response in verified real-time facts with structured synthesis and citations where applicable.';
        }
        if (isCanvasCodeActive) {
          systemPrompt += ' [LIVE CODE CANVAS ENABLED]: Generate complete, clean, standalone runnable code enclosed in standard markdown syntax fences.';
        }

        const userMsgPayload = userImage
          ? [
              { type: 'text', text: promptToSend },
              { type: 'image_url', image_url: { url: userImage } }
            ]
          : promptToSend;

        await streamGroqChat({
          messages: [
            { role: 'system', content: systemPrompt },
            ...historyBefore.slice(-6).map(m => ({
              role: m.role === 'user' ? 'user' : 'assistant',
              content: m.content || 'Responded to prompt'
            })),
            { role: 'user', content: userMsgPayload }
          ],
          model: selectedModelRef.current,
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
  }, []);

  const handleSendMessage = useCallback(async (userText, userImage = null) => {
    if ((!userText?.trim() && !userImage) || isLoadingRef.current) return;

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

    const convId = activeIdRef.current;
    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `asst-${Date.now()}`;

    const currentConv = conversationsRef.current.find(c => c.id === convId);
    const historyBeforeSend = currentConv ? currentConv.messages : [];

    // Add user message with image attached if present
    setConversations(prev => prev.map(c => {
      if (c.id !== convId) return c;
      return {
        ...c,
        title: c.messages.length === 0 ? (userImage ? 'Image Analysis' : promptToSend.slice(0, 32)) : c.title,
        messages: [
          ...c.messages,
          { id: userMsgId, role: 'user', content: promptToSend, image: userImage },
          { id: assistantMsgId, role: 'assistant', isTrace: agentTraceModeRef.current, content: '', traceData: { steps: [] } }
        ]
      };
    }));

    await executeGeneration(promptToSend, userImage, historyBeforeSend, assistantMsgId, convId);
  }, [executeGeneration, scrollToBottomInstant]);

  const handleSaveEdit = useCallback(async (msgId, newContent, userImage = null) => {
    if (!newContent?.trim() || isLoadingRef.current) return;
    setEditingMsgId(null);

    const convId = activeIdRef.current;
    const currentConv = conversationsRef.current.find(c => c.id === convId);
    if (!currentConv) return;

    const msgIndex = currentConv.messages.findIndex(m => m.id === msgId);
    if (msgIndex === -1) return;

    const promptToSend = newContent.trim();
    const historyBefore = currentConv.messages.slice(0, msgIndex);
    const updatedUserMsg = { ...currentConv.messages[msgIndex], content: promptToSend };
    const assistantMsgId = `asst-${Date.now()}`;

    setConversations(prev => prev.map(c => {
      if (c.id !== convId) return c;
      return {
        ...c,
        title: msgIndex === 0 ? (userImage ? 'Image Analysis' : promptToSend.slice(0, 32)) : c.title,
        messages: [
          ...historyBefore,
          updatedUserMsg,
          { id: assistantMsgId, role: 'assistant', isTrace: agentTraceModeRef.current, content: '', traceData: { steps: [] } }
        ]
      };
    }));

    await executeGeneration(promptToSend, userImage, historyBefore, assistantMsgId, convId);
  }, [executeGeneration]);

  const handleRegenerateFromAssistant = useCallback(async (asstMsgId) => {
    if (isLoadingRef.current) return;

    const convId = activeIdRef.current;
    const currentConv = conversationsRef.current.find(c => c.id === convId);
    if (!currentConv) return;

    const asstIndex = currentConv.messages.findIndex(m => m.id === asstMsgId);
    if (asstIndex === -1) return;

    const prevUserMsg = currentConv.messages.slice(0, asstIndex).reverse().find(m => m.role === 'user');
    if (!prevUserMsg) return;

    const userIndex = currentConv.messages.findIndex(m => m.id === prevUserMsg.id);
    const historyBefore = currentConv.messages.slice(0, userIndex);
    const assistantMsgId = `asst-${Date.now()}`;

    setConversations(prev => prev.map(c => {
      if (c.id !== convId) return c;
      return {
        ...c,
        messages: [
          ...currentConv.messages.slice(0, userIndex + 1),
          { id: assistantMsgId, role: 'assistant', isTrace: agentTraceModeRef.current, content: '', traceData: { steps: [] } }
        ]
      };
    }));

    await executeGeneration(prevUserMsg.content, prevUserMsg.image, historyBefore, assistantMsgId, convId);
  }, [executeGeneration]);

  return (
    <div className={`flex h-[100dvh] max-h-[100dvh] w-full max-w-full font-sans overflow-hidden ${isDarkMode ? 'bg-[#080a12] text-slate-100' : 'bg-[#f8fafc] text-slate-900'}`}>

      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelectConv={handleSelectConv}
        onNewChat={handleNewChat}
        onDeleteConv={handleDeleteConv}
        hasApiKey={hasApiKey}
        onOpenApiKeyModal={handleOpenApiKeyModal}
        isDarkMode={isDarkMode}
        onToggleTheme={handleToggleTheme}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />

      {/* Main workspace */}
      <div className="flex-1 flex h-full overflow-hidden w-full max-w-full min-w-0">

        {/* Chat pane */}
        <main className={`flex-1 flex flex-col h-full overflow-hidden min-w-0 w-full max-w-full relative border-r ${isDarkMode ? 'border-slate-800/60' : 'border-slate-200'}`}>

          {/* Header (Fully Transparent & Borderless Header Bar) */}
          <header className="h-11 sm:h-12 px-2.5 sm:px-4 flex items-center justify-between shrink-0 z-10 bg-transparent transition-all duration-300 relative select-none">
            {/* Left: Mobile sidebar toggle + Conversation title */}
            <div className="flex items-center space-x-2 truncate pr-2">
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer md:hidden"
                title="Toggle Sidebar"
              >
                <PanelLeftOpen size={16} />
              </button>

              {activeConv && activeConv.messages.length > 0 && (
                <span className={`text-xs sm:text-sm font-semibold truncate max-w-[200px] sm:max-w-xs md:max-w-md ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                  {activeConv.title || 'New Chat'}
                </span>
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
                      ? 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
                title={idePanel.isOpen ? "Close Code Canvas" : "Open Code Canvas"}
              >
                <BookOpen size={15} />
              </button>
            </div>
          </header>

          {/* Chat scroll area */}
          <div
            ref={chatContainerRef}
            onScroll={handleChatScroll}
            className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col w-full max-w-full"
          >
            {activeConv && activeConv.messages.length > 0 ? (
              <div className="messages-wrapper max-w-5xl xl:max-w-6xl 2xl:max-w-7xl w-full mx-auto px-4 sm:px-6 md:px-8 py-4 sm:py-8 space-y-5 sm:space-y-7 overflow-x-hidden">
                {activeConv.messages.map((msg) => (
                  <div key={msg.id} className="animate-bubble-in w-full max-w-full overflow-hidden">

                    {msg.role === 'user' ? (
                      /* User message — right aligned reference bubble or inline edit */
                      <div className="flex flex-col items-end w-full max-w-full space-y-1.5">
                        {editingMsgId === msg.id ? (
                          /* Inline Edit Form */
                          <div className={`w-full max-w-[90%] sm:max-w-2xl p-3.5 sm:p-4 rounded-2xl border shadow-sm ${
                            isDarkMode ? 'bg-[#121626] border-blue-500/70' : 'bg-white border-blue-400'
                          }`}>
                            <textarea
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              rows={Math.max(2, Math.min(editingText.split('\n').length, 6))}
                              autoFocus
                              className={`w-full bg-transparent border-0 focus:outline-none text-[14.5px] sm:text-[16px] leading-relaxed resize-none ${
                                isDarkMode ? 'text-slate-100' : 'text-slate-900'
                              }`}
                            />
                            <div className="flex items-center justify-end space-x-2 pt-2.5 mt-1 border-t border-slate-200/60 dark:border-slate-800">
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(msg.id, editingText, msg.image)}
                                disabled={!editingText.trim() || isLoading}
                                className="px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-[#0066FF] hover:bg-blue-600 active:scale-95 text-white shadow-xs transition-all cursor-pointer disabled:opacity-50"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className={`max-w-[90%] sm:max-w-2xl px-5 sm:px-6 py-3 sm:py-3.5 rounded-2xl rounded-tr-xs text-[14.5px] sm:text-[16px] leading-relaxed shadow-2xs break-words font-sans ${
                              isDarkMode ? 'bg-[#121626] text-slate-100 border border-slate-800/80' : 'bg-slate-100 text-slate-900 border border-slate-200/60'
                            }`}>
                              {msg.image && (
                                <div
                                  onClick={() => setSelectedImageModal({ isOpen: true, url: msg.image })}
                                  className="mb-2.5 max-w-xs sm:max-w-sm rounded-xl overflow-hidden border border-slate-300/80 dark:border-slate-700/80 bg-slate-900/10 dark:bg-black/40 cursor-pointer group relative"
                                  title="Click to zoom image"
                                >
                                  <img src={msg.image} alt="User attachment" className="max-h-60 w-auto object-contain rounded-lg group-hover:scale-[1.02] transition-transform duration-200" />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                                    <span className="opacity-0 group-hover:opacity-100 px-2 py-0.5 rounded-md bg-black/70 text-white text-[11px] font-medium transition-opacity">Zoom</span>
                                  </div>
                                </div>
                              )}
                              {msg.content}
                            </div>

                            {/* User Action bar: Edit + Copy */}
                            <div className="flex items-center space-x-1.5 text-slate-400 dark:text-slate-400 px-1 opacity-70 hover:opacity-100 transition-opacity select-none">
                              <button
                                onClick={() => handleStartEdit(msg)}
                                disabled={isLoading}
                                className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800/80 disabled:opacity-50"
                                title="Edit message"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() => handleCopyMessage(msg.id, msg.content)}
                                className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800/80"
                                title="Copy text"
                              >
                                {copiedMsgId === msg.id ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      /* AI message — clean response + reference action toolbar */
                      <div className="w-full max-w-full overflow-hidden space-y-2">
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
                            <div className="text-[14.5px] sm:text-[15.5px] md:text-[16px] leading-relaxed text-slate-900 dark:text-slate-100">
                              <MarkdownRenderer content={msg.content} />
                            </div>
                          )}
                        </div>

                        {/* AI Response Action Toolbar: Copy + Regenerate ONLY */}
                        {(!msg.isTrace || !isLoading) && (
                          <div className="flex items-center space-x-1.5 text-slate-400 dark:text-slate-400 pt-1 select-none">
                            {/* Copy */}
                            <button
                              onClick={() => handleCopyMessage(msg.id, msg.content || msg.traceData?.steps?.find(s => s.type === 'response')?.content || '')}
                              className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800/80"
                              title="Copy response"
                            >
                              {copiedMsgId === msg.id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                            </button>

                            {/* Regenerate */}
                            <button
                              onClick={() => handleRegenerateFromAssistant(msg.id)}
                              disabled={isLoading}
                              className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800/80 disabled:opacity-50"
                              title="Regenerate response"
                            >
                              <RotateCcw size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                ))}

                {/* Loading indicator */}
                {isLoading && activeConv.messages[activeConv.messages.length - 1]?.role === 'user' && (
                  <div className="flex items-center space-x-2 pl-0.5 sm:pl-1 py-1">
                    <img src="/devnexes-logo.png" alt="Devnexes AI" className="w-5 h-5 object-contain" />
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
              /* Welcome / clean empty state perfectly balanced in upper-middle */
              <div className="flex-1 flex flex-col items-center justify-start pt-[14vh] sm:pt-[16vh] px-3.5 sm:px-6 pb-6 select-none overflow-y-auto">
                <div className="w-full max-w-3xl mx-auto space-y-4 sm:space-y-6 animate-fade-in">

                  {/* Clean elegant typography heading */}
                  <div className="text-center pb-1 px-2">
                    <h1 className={`text-2xl sm:text-3xl md:text-4xl font-serif tracking-tight font-normal ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                      {currentGreeting}
                    </h1>
                  </div>

                  {/* Centered Chat Input */}
                  <div className="w-full">
                    <ChatInput
                      onSendMessage={handleSendMessage}
                      isLoading={isLoading}
                      agentTraceMode={agentTraceMode}
                      onToggleAgentTraceMode={handleToggleAgentTraceMode}
                      isDarkMode={isDarkMode}
                      selectedModel={selectedModel}
                      onSelectModel={setSelectedModel}
                      isWebSearchActive={isWebSearchActive}
                      onToggleWebSearch={handleToggleWebSearch}
                      isCanvasCodeActive={isCanvasCodeActive}
                      onToggleCanvasCode={handleToggleCanvasCode}
                    />
                  </div>

                  {/* Devnexes AI Brand & Sleek Capability Chips */}
                  <div className="w-full max-w-3xl mx-auto px-3 sm:px-4 -mt-1 sm:-mt-2 flex items-center justify-between md:justify-end gap-2.5 sm:gap-3 select-none py-1">
                    
                    {/* Brand line - Grouped before the capability pills */}
                    <div className="flex items-center space-x-2 shrink-0 py-0.5 pr-1">
                      <img 
                        src="/devnexes-logo.png" 
                        alt="Devnexes AI" 
                        className="w-4 h-4 object-contain shrink-0"
                      />
                      <span className={`text-xs font-semibold tracking-tight ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                        Devnexes AI
                      </span>
                    </div>

                    {/* MOBILE VIEW: Animated right-to-left flowing pill carousel that pauses 1 second at center */}
                    {activeAvailableCaps.length > 0 && (
                      <div 
                        className="flex md:hidden items-center space-x-2 min-w-0"
                        onMouseEnter={() => setIsMobileFlowPaused(true)}
                        onMouseLeave={() => setIsMobileFlowPaused(false)}
                        onTouchStart={() => setIsMobileFlowPaused(true)}
                        onTouchEnd={() => setTimeout(() => setIsMobileFlowPaused(false), 2000)}
                      >
                        {(() => {
                          const cap = activeAvailableCaps[activeMobileCapIndex % activeAvailableCaps.length];
                          if (!cap) return null;
                          const Icon = cap.icon;
                          const isActive = 
                            cap.id === 'deepThink' ? agentTraceMode :
                            cap.id === 'googleSearch' ? isWebSearchActive :
                            cap.id === 'canvasCode' ? isCanvasCodeActive : false;

                          return (
                            <div
                              key={`${cap.id}-${activeMobileCapIndex}`}
                              onClick={() => {
                                if (cap.id === 'deepThink') setAgentTraceMode(prev => !prev);
                                else if (cap.id === 'googleSearch') setIsWebSearchActive(prev => !prev);
                                else if (cap.id === 'canvasCode') setIsCanvasCodeActive(prev => !prev);
                              }}
                              className={`animate-slide-right-center group inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full border text-xs transition-all duration-200 cursor-pointer backdrop-blur-md shadow-2xs select-none shrink-0 whitespace-nowrap active:scale-95 ${
                                isActive
                                  ? 'bg-blue-50 dark:bg-blue-950/70 border-[#0066FF] text-[#0066FF] dark:text-blue-400 font-semibold ring-1 ring-blue-500/20'
                                  : isDarkMode
                                    ? 'bg-[#121626]/80 hover:bg-[#182035] border-slate-800 text-slate-300 hover:text-white'
                                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              <Icon size={12.5} className={isActive ? 'text-[#0066FF] dark:text-blue-400' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'} />
                              <span className="text-[11.5px] font-medium">{cap.label}</span>
                              {isActive && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-900/60 text-[#0066FF] dark:text-blue-300">
                                  Active
                                </span>
                              )}
                            </div>
                          );
                        })()}

                        {/* Flow dot indicators */}
                        {activeAvailableCaps.length > 1 && (
                          <div className="flex items-center space-x-1 shrink-0 pl-1">
                            {activeAvailableCaps.map((c, dIdx) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setActiveMobileCapIndex(dIdx);
                                  setIsMobileFlowPaused(true);
                                  setTimeout(() => setIsMobileFlowPaused(false), 3000);
                                }}
                                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                                  (activeMobileCapIndex % activeAvailableCaps.length) === dIdx
                                    ? 'bg-[#0066FF] w-3 scale-110'
                                    : isDarkMode ? 'bg-slate-700 hover:bg-slate-500 w-1.5' : 'bg-slate-300 hover:bg-slate-400 w-1.5'
                                }`}
                                title={c.label}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* DESKTOP VIEW: Full Horizontal Capability Chips */}
                    {activeAvailableCaps.length > 0 && (
                      <div className="hidden md:flex items-center flex-nowrap gap-2 shrink-0">
                        {activeAvailableCaps.map(cap => {
                          const Icon = cap.icon;
                          const isActive = 
                            cap.id === 'deepThink' ? agentTraceMode :
                            cap.id === 'googleSearch' ? isWebSearchActive :
                            cap.id === 'canvasCode' ? isCanvasCodeActive : false;

                          return (
                            <div
                              key={cap.id}
                              onClick={() => {
                                if (cap.id === 'deepThink') setAgentTraceMode(prev => !prev);
                                else if (cap.id === 'googleSearch') setIsWebSearchActive(prev => !prev);
                                else if (cap.id === 'canvasCode') setIsCanvasCodeActive(prev => !prev);
                              }}
                              className={`group inline-flex items-center space-x-1.5 sm:space-x-2 px-3 py-1.5 rounded-full border text-xs transition-all duration-200 cursor-pointer backdrop-blur-md shadow-2xs select-none shrink-0 whitespace-nowrap hover:scale-[1.02] active:scale-95 ${
                                isActive
                                  ? 'bg-blue-50 dark:bg-blue-950/70 border-[#0066FF] text-[#0066FF] dark:text-blue-400 font-semibold ring-1 ring-blue-500/20'
                                  : isDarkMode
                                    ? 'bg-[#121626]/80 hover:bg-[#182035] border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300'
                              }`}
                            >
                              <Icon size={12.5} className={isActive ? 'text-[#0066FF] dark:text-blue-400' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'} />
                              <span className="text-[11.5px] font-medium">{cap.label}</span>
                              {isActive && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-900/60 text-[#0066FF] dark:text-blue-300">
                                  Active
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={(e) => handleDismissCapability(cap.id, e)}
                                className="ml-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                title={`Remove ${cap.label}`}
                              >
                                <X size={11} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                  </div>

                </div>
              </div>
            )}
          </div>

          {/* Floating Scroll to Bottom Arrow Button */}
          {showScrollBottom && activeConv && activeConv.messages.length > 0 && (
            <div className="absolute bottom-28 sm:bottom-32 left-1/2 -translate-x-1/2 z-40 animate-fade-in pointer-events-auto">
              <button
                type="button"
                onClick={() => scrollToBottom(true)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-full text-xs font-semibold border shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer backdrop-blur-xl group ${
                  isDarkMode
                    ? 'bg-[#0f1424]/95 text-slate-100 border-blue-500/40 hover:border-blue-400 shadow-[0_8px_25px_rgba(0,0,0,0.65)]'
                    : 'bg-white/95 text-slate-800 border-blue-200 hover:border-blue-400 shadow-[0_8px_25px_rgba(0,102,255,0.18)]'
                }`}
                title="Scroll to latest message"
              >
                <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950 text-[#0066FF] dark:text-blue-400 flex items-center justify-center group-hover:translate-y-0.5 transition-transform">
                  <ArrowDown size={13} />
                </div>
                <span>Latest Message</span>
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
                onToggleAgentTraceMode={handleToggleAgentTraceMode}
                isDarkMode={isDarkMode}
                activeClarification={activeClarification}
                selectedModel={selectedModel}
                onSelectModel={setSelectedModel}
                isWebSearchActive={isWebSearchActive}
                onToggleWebSearch={handleToggleWebSearch}
                isCanvasCodeActive={isCanvasCodeActive}
                onToggleCanvasCode={handleToggleCanvasCode}
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
