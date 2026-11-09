import React, { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import AgentTraceTree from './components/AgentTraceTree';
import ChatInput from './components/ChatInput';
import ApiKeyModal from './components/ApiKeyModal';
import ArtifactModal from './components/ArtifactModal';
import IdeCodePanel from './components/IdeCodePanel';
import ImageStudioView from './components/ImageStudioView';
import { generateDynamicAgentPipeline, listLocalModels, AVAILABLE_MODELS, hasGroqApiKey } from './services/groqService';
import { hasGeminiApiKey } from './services/geminiService';
import { isGeneralNonImagePrompt } from './services/agentOrchestrator';
import MarkdownRenderer from './components/MarkdownRenderer';
import FollowUpActionCard from './components/FollowUpActionCard';
import {
  AlertCircle,
  BookOpen,
  PanelLeftOpen,
  ArrowDown,
  X,
  Copy,
  Check,
  RotateCcw,
  Pencil,
  Globe,
  Brain,
  Code2,
  Sparkles
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
  createdAt: Date.now(),
  updatedAt: Date.now(),
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

function isCodeSnippet(text = '') {
  if (!text || typeof text !== 'string') return false;
  return (
    /\b(#include|using namespace|int main|def\s+\w+|class\s+\w+|import\s+[\w{}*]+|function\s*\w*\s*\(|const\s+\w+\s*=|let\s+\w+\s*=|public class|cout\s*<<|cin\s*>>|console\.log|printf\s*\(|<\?php|<html)\b/m.test(text)
  );
}

function formatUserFacingError(err, userPrompt = '') {
  const msg = err?.message || String(err || '');
  const isUrdu = /\b(kya|ha|hai|hain|karo|banao|mujhe|aap|ap|ye|yeh|kripya|chahiye|nahi|nhi)\b/i.test(userPrompt);

  if (/terms acceptance|model_terms_required|terms/i.test(msg)) {
    return isUrdu
      ? 'Chuna gaya model is waqt dastiyab nahi hai. Kripya doosra model chunein.'
      : 'The selected model is currently unavailable. Please choose another model and try again.';
  }
  if (/rate limit|too many requests|tpm|rpm/i.test(msg)) {
    return isUrdu
      ? 'System par temporary load zyada hai. Kripya thori der baad dobara koshish karein.'
      : 'Service is temporarily busy. Please wait a moment and try again.';
  }
  if (/network|fetch failed|failed to fetch/i.test(msg)) {
    return isUrdu
      ? 'Network issue ki wajah se rabta nahi ho saka. Kripya apna internet connection check karein.'
      : 'Network connection issue. Please check your internet connection and retry.';
  }

  return isUrdu
    ? 'Maazrat, is request ko process karne me masla pesh aaya. Kripya dobara koshish karein.'
    : 'Sorry, an issue occurred while processing your request. Please try again.';
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
    const saved = localStorage.getItem('devnexes_selected_model');
    if (!saved || saved.includes('mixtral') || saved.includes('safeguard') || saved.includes('guard') || saved.includes('orpheus') || saved.includes('canopylabs')) {
      try { localStorage.setItem('devnexes_selected_model', 'qwen/qwen3.8-27b'); } catch { }
      return 'qwen/qwen3.8-27b';
    }
    return saved;
  });
  const [availableModels, setAvailableModels] = useState(AVAILABLE_MODELS);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return false; // Default to Light Theme as requested
  });
  const [hasApiKey, setHasApiKey] = useState(() => hasGroqApiKey() && hasGeminiApiKey());
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [agentTraceMode, setAgentTraceMode] = useState(false); // Default to Fast Chat as requested
  const [isWebSearchActive, setIsWebSearchActive] = useState(false);
  const [isCanvasCodeActive, setIsCanvasCodeActive] = useState(false);
  const [dismissedCaps, setDismissedCaps] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const activeAvailableCaps = QUICK_CAPABILITIES.filter(cap => !dismissedCaps.includes(cap.id));

  const handleDismissCapability = useCallback((id, e) => {
    e.stopPropagation();
    setDismissedCaps(prev => [...prev, id]);
  }, []);
  const [activeView, setActiveView] = useState('chat'); // 'chat' | 'images'
  const [viewSwitchNotice, setViewSwitchNotice] = useState(null);

  // Auto-dismiss view switch notice after 6 seconds
  useEffect(() => {
    if (!viewSwitchNotice) return;
    const timer = setTimeout(() => {
      setViewSwitchNotice(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [viewSwitchNotice]);
  const [previewModal, setPreviewModal] = useState({ isOpen: false, code: '', title: '' });
  const [idePanel, setIdePanel] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedCode = localStorage.getItem('devnexes_canvas_code') || localStorage.getItem('devnexes_ide_code') || '';
        const savedLang = localStorage.getItem('devnexes_canvas_language') || localStorage.getItem('devnexes_ide_language') || 'html';
        if (savedCode && savedCode.trim().length > 25) {
          return { isOpen: false, code: savedCode, title: 'Code Canvas', language: savedLang };
        }
      } catch { }
    }
    return { isOpen: false, code: '', title: '', language: '' };
  });
  const idePanelRef = useRef(idePanel);
  useEffect(() => {
    idePanelRef.current = idePanel;
  }, [idePanel]);

  const handleOpenIdePanel = useCallback((code, title, language) => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('devnexes_canvas_code', code || '');
        localStorage.setItem('devnexes_canvas_language', language || 'html');
      }
    } catch { }
    setIdePanel({ isOpen: true, code, title, language: language || 'html' });
  }, []);
  const [selectedImageModal, setSelectedImageModal] = useState({ isOpen: false, url: '' });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [copiedMsgId, setCopiedMsgId] = useState(null);
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [activeClarification, setActiveClarification] = useState(null);
  const [mobileCapIndex, setMobileCapIndex] = useState(0);
  const [isCapTransitioning, setIsCapTransitioning] = useState(false);
  const [isMobileCapPaused, setIsMobileCapPaused] = useState(false);
  const mobileCapPauseTimeoutRef = useRef(null);

  // Auto-cycle through capabilities with smooth "ek jaye doosra aaye" animation
  useEffect(() => {
    if (isMobileCapPaused) return;

    const interval = setInterval(() => {
      // Step 1: Slide out the current capability upwards
      setIsCapTransitioning(true);

      setTimeout(() => {
        // Step 2: Switch to next capability; it enters smoothly from the bottom
        setMobileCapIndex(prev => (prev + 1) % QUICK_CAPABILITIES.length);
        setIsCapTransitioning(false);
      }, 200);
    }, 3200);

    return () => clearInterval(interval);
  }, [isMobileCapPaused]);

  const handleSelectMobileCap = useCallback((targetIdx) => {
    if (targetIdx === mobileCapIndex) return;
    setIsMobileCapPaused(true);
    if (mobileCapPauseTimeoutRef.current) clearTimeout(mobileCapPauseTimeoutRef.current);

    setIsCapTransitioning(true);
    setTimeout(() => {
      setMobileCapIndex(targetIdx);
      setIsCapTransitioning(false);
    }, 180);

    // Resume auto-cycle after 8 seconds of idle
    mobileCapPauseTimeoutRef.current = setTimeout(() => {
      setIsMobileCapPaused(false);
    }, 8000);
  }, [mobileCapIndex]);

  const handleToggleCurrentMobileCap = useCallback(() => {
    const currentCap = QUICK_CAPABILITIES[mobileCapIndex] || QUICK_CAPABILITIES[0];
    if (currentCap.id === 'deepThink') setAgentTraceMode(prev => !prev);
    else if (currentCap.id === 'googleSearch') setIsWebSearchActive(prev => !prev);
    else if (currentCap.id === 'canvasCode') setIsCanvasCodeActive(prev => !prev);

    // Pause auto-cycle for 8 seconds so user can see their toggle state
    setIsMobileCapPaused(true);
    if (mobileCapPauseTimeoutRef.current) clearTimeout(mobileCapPauseTimeoutRef.current);
    mobileCapPauseTimeoutRef.current = setTimeout(() => {
      setIsMobileCapPaused(false);
    }, 8000);
  }, [mobileCapIndex]);

  // Sync mobile capability index with active mode when user toggles externally
  useEffect(() => {
    if (isCanvasCodeActive) setMobileCapIndex(2);
    else if (isWebSearchActive) setMobileCapIndex(1);
    else if (agentTraceMode) setMobileCapIndex(0);
  }, [isCanvasCodeActive, isWebSearchActive, agentTraceMode]);
  const [chatPaneWidthPercent, setChatPaneWidthPercent] = useState(38);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const isDraggingSplitRef = useRef(false);

  const handleSplitMouseDown = useCallback((e) => {
    e.preventDefault();
    isDraggingSplitRef.current = true;
    setIsDraggingSplit(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent) => {
      if (!isDraggingSplitRef.current) return;
      const isMobile = window.innerWidth < 768;
      const sidebarWidth = isMobile ? 0 : (isSidebarCollapsed ? 64 : 265);
      const availableWidth = window.innerWidth - sidebarWidth;
      const newWidth = ((moveEvent.clientX - sidebarWidth) / availableWidth) * 100;
      if (newWidth >= 22 && newWidth <= 58) {
        setChatPaneWidthPercent(Math.round(newWidth));
      }
    };

    const handleMouseUp = () => {
      isDraggingSplitRef.current = false;
      setIsDraggingSplit(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [isSidebarCollapsed]);

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
  const mainPaneRef = useRef(null);
  const messagesEndRef = useRef(null);
  const latestPromptRef = useRef(null);
  const isAutoScrollLocked = useRef(true);

  const conversationsRef = useRef(conversations);
  const activeIdRef = useRef(activeId);
  const selectedModelRef = useRef(selectedModel);
  const agentTraceModeRef = useRef(agentTraceMode);
  const isLoadingRef = useRef(isLoading);
  const generationAbortRef = useRef(null);
  const activeClarificationRef = useRef(activeClarification);

  useEffect(() => {
    conversationsRef.current = conversations;
    activeIdRef.current = activeId;
    selectedModelRef.current = selectedModel;
    agentTraceModeRef.current = agentTraceMode;
    isLoadingRef.current = isLoading;
    activeClarificationRef.current = activeClarification;
  });

  // The selector represents models actually installed in this user's Ollama,
  // not a list baked into the UI at build time.
  useEffect(() => {
    listLocalModels().then(models => {
      if (Array.isArray(models) && models.length > 0) {
        setAvailableModels(models);
        setSelectedModel(current => {
          if (!current || current.includes('mixtral') || current.includes('safeguard') || current.includes('guard') || current.includes('orpheus') || current.includes('canopylabs') || !models.some(m => m.id === current)) {
            const fallbackId = models[0]?.id || 'qwen/qwen3.8-27b';
            try { localStorage.setItem('devnexes_selected_model', fallbackId); } catch { }
            return fallbackId;
          }
          return current;
        });
      }
    });
  }, []);

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
          // Do not store corrupted strings in localStorage (never truncate base64 with '...')
          if (msg.image && typeof msg.image === 'string' && (msg.image.length > 80000 || msg.image.endsWith('...'))) {
            return { ...msg, image: null, hasStoredImage: true };
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
    // Auto-scroll stays active if user is near bottom or in the generous bottom spacer zone
    const threshold = Math.max(260, clientHeight * 0.42);
    const isNearBottom = distanceFromBottom < threshold;
    isAutoScrollLocked.current = isNearBottom;
    setShowScrollBottom(!isNearBottom && scrollHeight > clientHeight + 350);
  }, []);

  const scrollToLatestPrompt = useCallback((smooth = true) => {
    if (latestPromptRef.current) {
      latestPromptRef.current.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'start'
      });
      setShowScrollBottom(false);
      isAutoScrollLocked.current = true;
      return;
    }
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

  // Seamless full-pane scroll forwarding: allows scrolling from any spacing (gutters, header, bottom bar around ChatInput)
  useEffect(() => {
    const mainEl = mainPaneRef.current;
    if (!mainEl) return;

    const handlePaneWheel = (e) => {
      const container = chatContainerRef.current;
      if (!container) return;

      const target = e.target;
      if (target && target.closest) {
        // If cursor is inside a scrollable textarea with multiline overflow, let it scroll
        const textarea = target.closest('textarea');
        if (textarea) {
          const canScrollDown = e.deltaY > 0 && textarea.scrollTop + textarea.clientHeight < textarea.scrollHeight - 1;
          const canScrollUp = e.deltaY < 0 && textarea.scrollTop > 1;
          if (canScrollDown || canScrollUp) return;
        }

        // If cursor is inside an inner code pre / custom scroll area that can scroll
        const innerScroll = target.closest('pre, .overflow-y-auto:not([data-chat-scroll])');
        if (innerScroll && innerScroll !== container) {
          const canScrollDown = e.deltaY > 0 && innerScroll.scrollTop + innerScroll.clientHeight < innerScroll.scrollHeight - 1;
          const canScrollUp = e.deltaY < 0 && innerScroll.scrollTop > 1;
          if (canScrollDown || canScrollUp) return;
        }
      }

      // If wheel happened outside chatContainerRef (header, bottom padding, space beside ChatInput)
      if (!container.contains(target)) {
        if (container.scrollHeight > container.clientHeight) {
          container.scrollTop += e.deltaY;
          handleChatScroll();
        }
      }
    };

    mainEl.addEventListener('wheel', handlePaneWheel, { passive: true });
    return () => mainEl.removeEventListener('wheel', handlePaneWheel);
  }, [handleChatScroll]);

  const activeConv = conversations.find(c => c.id === activeId) || conversations[0];

  const handleSelectConv = useCallback((id) => {
    setActiveView('chat');
    setActiveId(id);
    setActiveClarification(null);
  }, []);

  const handleSelectView = useCallback((view) => {
    setActiveView(view);
    if (view === 'images') {
      // "images vlay section am jab jauu to vo sara kam new chat ma ho"
      // If current active conversation already has prior messages, create a fresh new chat session for images!
      const current = conversationsRef.current.find(c => c.id === activeIdRef.current);
      if (current && current.messages && current.messages.length > 0) {
        const newConv = createInitialConversation();
        newConv.title = 'AI Image Studio';
        conversationsRef.current = [newConv, ...conversationsRef.current];
        activeIdRef.current = newConv.id;
        setConversations(prev => [newConv, ...prev]);
        setActiveId(newConv.id);
      }
    }
  }, []);

  const handleNewChat = useCallback(() => {
    setActiveView('chat');
    setViewSwitchNotice(null);
    setActiveClarification(null);
    const newConv = createInitialConversation();
    conversationsRef.current = [newConv, ...conversationsRef.current];
    activeIdRef.current = newConv.id;
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

  const handleRenameConv = useCallback((id, newTitle) => {
    const trimmed = (newTitle || '').trim();
    if (!trimmed) return;
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title: trimmed, updatedAt: Date.now() } : c));
  }, []);

  const handleClearAllConvs = useCallback(() => {
    const fresh = createInitialConversation();
    setConversations([fresh]);
    setActiveId(fresh.id);
    setActiveClarification(null);
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

  const executeGeneration = useCallback(async (promptToSend, userImage, historyBefore, assistantMsgId, convId, meta = null) => {
    setIsLoading(true);
    const controller = new AbortController();
    generationAbortRef.current = controller;

    const hasInlineGoogle = /\/(google|search)\b/i.test(promptToSend);
    const hasInlineCanvas = /\/(canvas|code|artifact)\b/i.test(promptToSend);
    const effectiveWebSearch = isWebSearchActive || hasInlineGoogle;
    const effectiveCanvasCode = isCanvasCodeActive || hasInlineCanvas;
    const cleanPrompt = promptToSend.replace(/\/(google|search|canvas|code|artifact|think|deep|deepthink|fast|fastchat)\b/gi, '').replace(/\s{2,}/g, ' ').trim();
    let hasCode = false;
    let queuedUpdate = null;
    let animationFrame = null;

    const applyUpdate = ({ steps, isDirect }) => {
      const artifact = steps.find(step => step.type === 'code' || step.type === 'artifact');
      if (artifact?.code?.trim()) {
        hasCode = true;
        const cleaned = cleanCodeContent(artifact.code) || artifact.code;
        const lang = artifact.language || 'html';
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('devnexes_canvas_code', cleaned);
            localStorage.setItem('devnexes_canvas_language', lang);
          }
        } catch { }
        setIdePanel(previous => ({ ...previous, code: cleaned, title: artifact.title || previous.title, language: lang }));
      }

      const imageStep = steps.find(step => (step.type === 'image' || step.imageResult) && step.imageResult?.url);
      if (imageStep?.imageResult?.url) {
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('devnexes_latest_image_meta', JSON.stringify({
              url: imageStep.imageResult.url,
              prompt: imageStep.imageResult.prompt || '',
              originalPrompt: imageStep.imageResult.originalPrompt || '',
              seed: imageStep.imageResult.seed || null
            }));
          }
        } catch { }
      }

      setConversations(previous => previous.map(conversation => conversation.id !== convId ? conversation : {
        ...conversation,
        messages: conversation.messages.map(message => message.id !== assistantMsgId ? message : isDirect
          ? { ...message, isTrace: false, content: steps.find(step => step.type === 'response')?.content || '' }
          : { ...message, isTrace: true, traceData: { steps } })
      }));
    };
    const publishSteps = (steps, isDirect) => {
      // The response remains token-by-token from the model, while React work is
      // coalesced to one paint frame so long answers do not make the UI lag.
      queuedUpdate = { steps: steps.map(step => ({ ...step, results: step.results ? [...step.results] : step.results })), isDirect };
      if (animationFrame !== null) return;
      animationFrame = requestAnimationFrame(() => {
        animationFrame = null;
        if (queuedUpdate) applyUpdate(queuedUpdate);
        queuedUpdate = null;
      });
    };

    try {
      const activeCanvasCode = idePanelRef.current?.code || null;
      const activeCanvasLanguage = idePanelRef.current?.language || null;

      const pipelineResult = await generateDynamicAgentPipeline({
        userPrompt: cleanPrompt || promptToSend,
        userImage,
        model: selectedModelRef.current,
        messagesHistory: historyBefore,
        forceWebSearch: effectiveWebSearch,
        forceCanvasCode: effectiveCanvasCode,
        isFromImageStudio: Boolean(meta?.isFromImageStudio),
        activeCanvasCode,
        activeCanvasLanguage,
        signal: controller.signal,
        onStepUpdate: publishSteps,
        onError: error => { if (error.name !== 'AbortError') console.error(error); }
      });
      if (queuedUpdate) applyUpdate(queuedUpdate);

      // Auto-open sidebar (Code Canvas) ONLY for substantial code (full apps, websites, or > 15 lines).
      // Chota mota code (<= 15 lines) stays on the main screen without opening the sidebar!
      const isSubstantial = pipelineResult?.isSubstantialCode || effectiveCanvasCode;
      if (hasCode && isSubstantial) {
        setIdePanel(previous => ({ ...previous, isOpen: true }));
      }

      if (pipelineResult?.needsClarification && pipelineResult?.clarification) {
        setActiveClarification(pipelineResult.clarification);
        // Remove empty placeholder assistant message so NO question bubble appears in chat UI
        setConversations(prev => prev.map(c => c.id !== convId ? c : {
          ...c,
          messages: c.messages.filter(m => m.id !== assistantMsgId)
        }));
      } else {
        setActiveClarification(null);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        const friendlyMessage = formatUserFacingError(error, cleanPrompt || promptToSend);
        applyUpdate({ steps: [{ type: 'response', content: friendlyMessage }], isDirect: true });
      }
    } finally {
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      generationAbortRef.current = null;
      setIsLoading(false);
    }
  }, [isWebSearchActive, isCanvasCodeActive]);

  const handleStopGeneration = useCallback(() => generationAbortRef.current?.abort(), []);

  const handleSendMessage = useCallback(async (userText, userImage = null, meta = null) => {
    if ((!userText?.trim() && !userImage) || isLoadingRef.current) return;

    const currentClar = activeClarificationRef.current;
    setActiveClarification(null);

    const promptToSend = userText?.trim() || 'Please analyze this screenshot / image in full detail.';

    // Smoothly scroll previous messages up, bringing the new prompt into clear focus with generous space below
    isAutoScrollLocked.current = true;
    setShowScrollBottom(false);
    requestAnimationFrame(() => {
      setTimeout(() => scrollToLatestPrompt(true), 20);
      setTimeout(() => scrollToLatestPrompt(true), 80);
      setTimeout(() => scrollToLatestPrompt(true), 200);
      setTimeout(() => scrollToLatestPrompt(true), 400);
    });

    const convId = meta?.targetConvId || activeIdRef.current;
    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `asst-${Date.now()}`;

    const currentConv = conversationsRef.current.find(c => c.id === convId);
    const historyBeforeSend = currentConv ? currentConv.messages : [];

    const isBranchAnswer = Boolean(
      meta?.isClarificationAnswer ||
      meta?.isFollowUpAnswer ||
      currentClar ||
      (historyBeforeSend.length > 0 && historyBeforeSend[historyBeforeSend.length - 1]?.role === 'user')
    );
    const questionText = meta?.question || currentClar?.question || null;

    // Add user message with image attached if present
    setConversations(prev => prev.map(c => {
      if (c.id !== convId) return c;
      return {
        ...c,
        title: c.messages.length === 0 ? (userImage ? 'Image Analysis' : promptToSend.slice(0, 32)) : c.title,
        updatedAt: Date.now(),
        messages: [
          ...c.messages,
          {
            id: userMsgId,
            role: 'user',
            content: promptToSend,
            image: userImage,
            isBranchAnswer,
            questionText
          },
          { id: assistantMsgId, role: 'assistant', isTrace: true, content: '', traceData: { steps: [] } }
        ]
      };
    }));

    await executeGeneration(promptToSend, userImage, historyBeforeSend, assistantMsgId, convId, meta);
  }, [executeGeneration, scrollToLatestPrompt]);

  const handleGenerateFromImageStudio = useCallback((prompt) => {
    if (!prompt?.trim()) return;
    const clean = prompt.trim();
    const isGeneral = isGeneralNonImagePrompt(clean);

    // "images vlay section am jab jauu to vo sara kam new chat ma ho"
    // Make sure all work initiated from the Images section runs in a dedicated new conversation
    let convId = activeIdRef.current;
    const currentConv = conversationsRef.current.find(c => c.id === convId);
    if (currentConv && currentConv.messages && currentConv.messages.length > 0) {
      const newConv = createInitialConversation();
      newConv.title = isGeneral ? clean.slice(0, 32) : `${clean.slice(0, 26)} (Visual)`;
      conversationsRef.current = [newConv, ...conversationsRef.current];
      activeIdRef.current = newConv.id;
      setConversations(prev => [newConv, ...prev]);
      setActiveId(newConv.id);
      convId = newConv.id;
    } else if (currentConv && currentConv.messages.length === 0) {
      const cleanTitle = isGeneral ? clean.slice(0, 32) : `${clean.slice(0, 26)} (Visual)`;
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, title: cleanTitle } : c));
    }

    // Switch view to Devnexes Chat
    setActiveView('chat');

    if (isGeneral) {
      // "agr us ma koi or kam kh dyta ha to vo bi karyyy vo ato switch ho jay devnexes chat py and uper bta dyyy switching to that"
      setViewSwitchNotice({
        text: 'Switching to Devnexes Chat — General task detected, processing in standard chat...',
        type: 'switch_to_chat'
      });
      handleSendMessage(clean, null, { isSwitchedFromImageStudio: true, targetConvId: convId });
    } else {
      // "usy pta ho ab images vala section ma gai ha to ab image hi ka kam ha"
      handleSendMessage(clean, null, { isFromImageStudio: true, targetConvId: convId });
    }
  }, [handleSendMessage]);

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
          { id: assistantMsgId, role: 'assistant', isTrace: true, content: '', traceData: { steps: [] } }
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
          { id: assistantMsgId, role: 'assistant', isTrace: true, content: '', traceData: { steps: [] } }
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
        activeView={activeView}
        onSelectView={handleSelectView}
        onSelectConv={handleSelectConv}
        onNewChat={handleNewChat}
        onDeleteConv={handleDeleteConv}
        onRenameConv={handleRenameConv}
        onClearAllConvs={handleClearAllConvs}
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
        <main
          ref={mainPaneRef}
          style={
            idePanel.isOpen && typeof window !== 'undefined' && window.innerWidth >= 1024
              ? { width: `${chatPaneWidthPercent}%`, flex: 'none' }
              : undefined
          }
          className={`flex flex-col h-full overflow-hidden min-w-0 relative border-r ${isDraggingSplit ? 'transition-none select-none' : 'transition-all duration-150'
            } ${idePanel.isOpen
              ? 'w-full lg:w-[38%] shrink-0'
              : 'flex-1 w-full max-w-full'
            } ${isDarkMode ? 'border-slate-800/60' : 'border-slate-200'}`}
        >

          {/* Header (Fully Transparent & Borderless Header Bar) */}
          <header className="h-11 sm:h-12 px-3.5 sm:px-4 flex items-center justify-between shrink-0 z-10 bg-transparent transition-all duration-300 relative select-none">
            {/* Left: Mobile sidebar toggle + Conversation title */}
            <div className="flex items-center space-x-2 truncate pr-2">
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer md:hidden"
                title="Toggle Sidebar"
              >
                <PanelLeftOpen size={16} />
              </button>

              {activeView === 'images' ? (
                <div className="flex items-center space-x-1.5">
                  <div className="w-5 h-5 rounded-md bg-blue-50 dark:bg-blue-950/70 text-[#0066FF] dark:text-blue-400 flex items-center justify-center">
                    <Sparkles size={12} />
                  </div>
                  <span className={`text-xs sm:text-sm font-semibold truncate ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                    AI Image Studio
                  </span>
                </div>
              ) : (
                activeConv && activeConv.messages.length > 0 ? (
                  <span className={`text-xs sm:text-sm font-semibold truncate max-w-[150px] xs:max-w-[200px] sm:max-w-xs md:max-w-md ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                    {activeConv.title || 'New Chat'}
                  </span>
                ) : (
                  <div className="flex items-center space-x-1.5 md:hidden">
                    <img src="/devnexes-logo.png" alt="Devnexes AI" className="w-4 h-4 object-contain" />
                    <span className={`text-xs font-semibold ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                      Devnexes AI
                    </span>
                  </div>
                )
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
                className={`p-1.5 rounded-lg transition-all duration-200 cursor-pointer ${idePanel.isOpen
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

          {/* Top Notice Banner: "Switching to Devnexes Chat..." when user asks general tasks in Image Studio */}
          {viewSwitchNotice && (
            <div className="mx-3 sm:mx-6 my-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300 text-xs font-medium flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-center space-x-2.5">
                <span className="flex h-2.5 w-2.5 relative shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#0066FF] dark:bg-blue-400"></span>
                </span>
                <span className="font-semibold">{viewSwitchNotice.text}</span>
              </div>
              <button
                onClick={() => setViewSwitchNotice(null)}
                className="p-1 hover:bg-blue-500/20 rounded-lg text-blue-600 dark:text-blue-300 transition-colors cursor-pointer shrink-0 ml-2"
                title="Dismiss"
              >
                <X size={13} />
              </button>
            </div>
          )}

          {activeView === 'images' ? (
            <ImageStudioView
              onGenerateImage={handleGenerateFromImageStudio}
              onOpenImageModal={(url) => setSelectedImageModal({ isOpen: true, url })}
              conversations={conversations}
              isDarkMode={isDarkMode}
              onSwitchToChat={() => setActiveView('chat')}
            />
          ) : (
            <>
              {/* Chat scroll area */}
              <div
                ref={chatContainerRef}
                data-chat-scroll="true"
                onScroll={handleChatScroll}
                className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col w-full max-w-full"
              >
                {activeConv && activeConv.messages.length > 0 ? (
                  <div className="messages-wrapper max-w-[700px] sm:max-w-[750px] md:max-w-[800px] lg:max-w-[820px] w-full mx-auto px-4 sm:px-5 md:px-6 py-4 sm:py-8 space-y-5 sm:space-y-7 flex-1 min-h-full">
                    {activeConv.messages.map((msg, msgIdx) => {
                      const isLastUser = msg.role === 'user' && (
                        msgIdx === activeConv.messages.length - 1 ||
                        msgIdx === activeConv.messages.length - 2
                      );

                      return (
                        <div
                          key={msg.id}
                          ref={isLastUser ? latestPromptRef : null}
                          className={`animate-bubble-in w-full max-w-full overflow-visible ${isLastUser ? 'scroll-mt-14 sm:scroll-mt-16' : ''}`}
                        >

                          {msg.role === 'user' ? (() => {
                            const isConsecutiveUser = msgIdx > 0 && activeConv.messages[msgIdx - 1]?.role === 'user';
                            const isBranch = Boolean(msg.isBranchAnswer || msg.isClarificationAnswer || msg.isFollowUpAnswer || isConsecutiveUser);
                            const questionLabel = msg.questionText || (isConsecutiveUser ? 'Option selected' : 'Clarification answer');

                            return (
                              /* User message — right aligned reference bubble with branch root when connected */
                              <div className="relative flex flex-col items-end w-full max-w-full space-y-1.5">
                                {/* Branch Root Indicator & Tree Line connecting from above */}
                                {isBranch && (
                                  <div className="relative w-full flex items-center justify-end pr-3 sm:pr-4 mt-1 mb-1 select-none animate-step-reveal">
                                    <div className="flex items-center space-x-1.5 text-blue-600 dark:text-blue-400 bg-blue-50/90 dark:bg-blue-950/70 px-2.5 py-0.5 rounded-full border border-blue-200/80 dark:border-blue-900/60 shadow-2xs">
                                      {/* Branch Elbow Curve */}
                                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-blue-500 dark:text-blue-400 shrink-0">
                                        <path
                                          d="M 3 1 V 8 Q 3 13 8 13 H 14"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                        />
                                      </svg>
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#0066FF] dark:bg-blue-400 shrink-0" />
                                      <span className="text-[10px] sm:text-[10.5px] font-semibold tracking-tight text-blue-600 dark:text-blue-300 truncate max-w-[220px] sm:max-w-xs" title={msg.questionText || 'Answer to clarification question'}>
                                        ↳ {questionLabel}
                                      </span>
                                    </div>
                                  </div>
                                )}

                                {editingMsgId === msg.id ? (
                                  /* Inline Edit Form */
                                  <div className={`w-full max-w-[90%] sm:max-w-2xl p-3.5 sm:p-4 rounded-2xl border shadow-sm ${isBranch ? 'mr-3 sm:mr-5' : ''
                                    } ${isDarkMode ? 'bg-[#121626] border-blue-500/70' : 'bg-white border-blue-400'}`}>
                                    <textarea
                                      value={editingText}
                                      onChange={(e) => setEditingText(e.target.value)}
                                      rows={Math.max(2, Math.min(editingText.split('\n').length, 6))}
                                      autoFocus
                                      className={`w-full bg-transparent border-0 focus:outline-none text-[15.5px] sm:text-[17px] leading-relaxed resize-none ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}
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
                                    <div className={`max-w-[90%] sm:max-w-2xl px-5 sm:px-6 py-3 sm:py-3.5 rounded-2xl shadow-2xs break-words ${isBranch
                                        ? 'mr-3 sm:mr-5 rounded-tr-xl rounded-tl-sm border-l-3 border-l-[#0066FF] dark:border-l-blue-400'
                                        : 'rounded-tr-xs'
                                      } ${isDarkMode ? 'bg-[#121626] text-slate-100 border border-slate-800/80' : 'bg-slate-100 text-slate-900 border border-slate-200/60'
                                      }`}>
                                      {msg.image && typeof msg.image === 'string' && !msg.image.endsWith('...') && (
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
                                      {msg.content?.includes('```') ? (
                                        <MarkdownRenderer
                                          content={msg.content}
                                          onOpenIdePanel={handleOpenIdePanel}
                                        />
                                      ) : (
                                        <div className={`whitespace-pre-wrap break-words leading-relaxed ${isCodeSnippet(msg.content)
                                            ? 'font-mono text-[13.5px] sm:text-[14px]'
                                            : 'font-sans text-[16.5px] sm:text-[17px] font-medium'
                                          }`}>
                                          {msg.content}
                                        </div>
                                      )}
                                    </div>

                                    {/* User Action bar: Edit + Copy */}
                                    <div className={`flex items-center space-x-1.5 text-slate-400 dark:text-slate-400 px-1 opacity-70 hover:opacity-100 transition-opacity select-none ${isBranch ? 'mr-3 sm:mr-5' : ''
                                      }`}>
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
                            );
                          })() : (() => {
                            const hasSubsequentFix = activeConv.messages.slice(msgIdx + 1).some(m =>
                              (m.role === 'assistant' && (
                                m.traceData?.steps?.some(s => (s.type === 'code' || s.type === 'artifact') && s.code) ||
                                /```[a-zA-Z0-9_-]*\n[\s\S]{50,}\n```/.test(m.content || '')
                              )) ||
                              (m.role === 'user' && (m.isBranchAnswer || m.isFollowUpAnswer || /\b(fix|theek|sahi|correct|solve|kar do|kardo|krdo)\b/i.test(m.content || '')))
                            );

                            return (
                              /* AI message — clean response + reference action toolbar */
                              <div className="w-full max-w-full overflow-hidden space-y-2">
                                <div className="w-full max-w-full overflow-hidden">
                                  {msg.isTrace ? (
                                    <AgentTraceTree
                                      traceData={msg.traceData}
                                      userPrompt={msgIdx > 0 ? activeConv.messages[msgIdx - 1]?.content : ''}
                                      isExecuting={isLoading && activeConv.messages[activeConv.messages.length - 1]?.id === msg.id}
                                      onOpenPreview={handleOpenPreview}
                                      onOpenIdePanel={handleOpenIdePanel}
                                      onSendMessage={handleSendMessage}
                                      onOpenImageModal={(url) => setSelectedImageModal({ isOpen: true, url })}
                                      hasSubsequentFix={hasSubsequentFix}
                                    />
                                  ) : (
                                    <div className="text-[16.5px] sm:text-[17px] leading-[1.78] text-slate-900 dark:text-slate-100">
                                      <MarkdownRenderer
                                        content={msg.content}
                                        onOpenIdePanel={handleOpenIdePanel}
                                      />
                                      <FollowUpActionCard
                                        assistantText={msg.content}
                                        userPrompt={msgIdx > 0 ? activeConv.messages[msgIdx - 1]?.content : ''}
                                        onSendMessage={handleSendMessage}
                                        isExecuting={isLoading && activeConv.messages[activeConv.messages.length - 1]?.id === msg.id}
                                        hasCodeArtifact={Boolean(
                                          msg.traceData?.steps?.some(s => (s.type === 'code' || s.type === 'artifact') && s.code) ||
                                          hasSubsequentFix
                                        )}
                                      />
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
                          );
                        })()}

                        </div>
                      )
                    })}

                    {/* Loading indicator matching Screenshot 6 & 7 */}
                    {isLoading && activeConv.messages[activeConv.messages.length - 1]?.role === 'user' && (
                      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 pl-0.5 sm:pl-1 py-1 select-none animate-fade-in">
                        <div className="flex items-center space-x-1.5 shrink-0">
                          <img src="/devnexes-logo.png" alt="Devnexes AI" className="w-5 h-5 object-contain" />
                          <span className="text-[13px] sm:text-[13.5px] font-semibold text-slate-800 dark:text-slate-200">
                            Devnexes AI
                          </span>
                        </div>

                        {/* Active Tool Badge Pill matching Screenshot 6 & 7 */}
                        {isWebSearchActive && (
                          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium shadow-2xs">
                            <Globe size={13} className="text-[#0066FF] dark:text-blue-400" />
                            <span>Google Search</span>
                          </div>
                        )}
                        {isCanvasCodeActive && !isWebSearchActive && (
                          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium shadow-2xs">
                            <Code2 size={13} className="text-[#0066FF] dark:text-blue-400" />
                            <span>Canvas Code</span>
                          </div>
                        )}
                        {agentTraceMode && !isWebSearchActive && !isCanvasCodeActive && (
                          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium shadow-2xs">
                            <Brain size={13} className="text-[#0066FF] dark:text-blue-400" />
                            <span>Deep Think</span>
                          </div>
                        )}

                        {/* Animated 3-dot pulse indicator • ▬ • */}
                        <div className="flex items-center space-x-1 pl-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 animate-pulse" />
                          <span className="w-3.5 h-1.5 rounded-full bg-[#0066FF] animate-pulse" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 animate-pulse" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    )}

                    {/* Generous bottom breathing spacer so latest prompt & response scroll comfortably up with space below */}
                    <div
                      ref={messagesEndRef}
                      className="h-[36vh] sm:h-[44vh] w-full shrink-0 pointer-events-none select-none transition-all duration-300"
                      aria-hidden="true"
                    />
                  </div>
                ) : (
                  /* Welcome / clean empty state perfectly balanced in upper-middle */
                  <div className="flex-1 flex flex-col items-center justify-start pt-[8vh] sm:pt-[14vh] px-4 sm:px-6 pb-6 select-none">
                    <div className="w-full max-w-[700px] sm:max-w-[750px] md:max-w-[800px] lg:max-w-[820px] mx-auto space-y-3.5 sm:space-y-5 animate-fade-in">

                      {/* Clean elegant typography heading matching reference */}
                      <div className="text-center pb-1 sm:pb-2 px-2">
                        <h1 className={`text-2xl sm:text-4xl md:text-[44px] font-serif tracking-tight font-normal ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
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
                          activeClarification={activeClarification}
                          onDismissClarification={() => setActiveClarification(null)}
                          selectedModel={selectedModel}
                          onSelectModel={setSelectedModel}
                          availableModels={availableModels}
                          onStopGeneration={handleStopGeneration}
                          isWebSearchActive={isWebSearchActive}
                          onToggleWebSearch={handleToggleWebSearch}
                          isCanvasCodeActive={isCanvasCodeActive}
                          onToggleCanvasCode={handleToggleCanvasCode}
                        />
                      </div>

                      {/* MOBILE VIEW — Exact layout from user's reference screenshots */}
                      {(() => {
                        const currentMobileCap = QUICK_CAPABILITIES[mobileCapIndex] || QUICK_CAPABILITIES[0];
                        const Icon = currentMobileCap.icon;
                        const isActive =
                          currentMobileCap.id === 'deepThink' ? agentTraceMode :
                            currentMobileCap.id === 'googleSearch' ? isWebSearchActive :
                              currentMobileCap.id === 'canvasCode' ? isCanvasCodeActive : false;

                        return (
                          <div className="flex sm:hidden items-center justify-between w-full px-3.5 pt-2.5 select-none animate-fade-in">
                            {/* Left: Brand with Devnexes Logo */}
                            <div className="flex items-center space-x-2 text-[13px] font-semibold text-slate-800 dark:text-slate-200">
                              <img
                                src="/devnexes-logo.png"
                                alt="Devnexes AI"
                                className="w-4.5 h-4.5 object-contain shrink-0"
                              />
                              <span>Devnexes AI</span>
                            </div>

                            {/* Right: Selected Capability Pill + Carousel Stepper Dots (● ▬ ●) */}
                            <div
                              className="flex items-center space-x-2"
                              onMouseEnter={() => setIsMobileCapPaused(true)}
                              onMouseLeave={() => setIsMobileCapPaused(false)}
                            >
                              <button
                                type="button"
                                onClick={handleToggleCurrentMobileCap}
                                className={`relative overflow-hidden inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full border text-xs sm:text-[12.5px] font-medium transition-all duration-300 cursor-pointer shadow-2xs active:scale-95 ${isActive
                                    ? 'bg-blue-50 dark:bg-blue-950/70 border-[#0066FF] text-[#0066FF] dark:text-blue-400 font-semibold ring-1 ring-blue-500/20'
                                    : isDarkMode
                                      ? 'bg-[#121626]/90 border-slate-700/80 text-slate-300 hover:text-white'
                                      : 'bg-white border-slate-200/90 text-slate-600 hover:text-slate-900'
                                  }`}
                                title={`Tap to ${isActive ? 'deactivate' : 'activate'} ${currentMobileCap.label}`}
                              >
                                <div
                                  key={currentMobileCap.id}
                                  className={`inline-flex items-center space-x-1.5 will-change-transform ${
                                    isCapTransitioning
                                      ? 'opacity-0 -translate-y-2.5 transition-all duration-180 ease-in'
                                      : 'animate-cap-ticker'
                                  }`}
                                >
                                  <Icon size={13.5} className={isActive ? 'text-[#0066FF] dark:text-blue-400' : 'text-slate-400'} />
                                  <span className="text-[12px] font-medium whitespace-nowrap">{currentMobileCap.label}</span>
                                  {isActive && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#0066FF] dark:bg-blue-400 animate-pulse ml-0.5" />
                                  )}
                                </div>
                              </button>

                              {/* 3-Dots Stepper Indicator (● ▬ ●) */}
                              <div className="flex items-center space-x-1.5 pl-0.5">
                                {QUICK_CAPABILITIES.map((cap, idx) => {
                                  const isSelected = idx === mobileCapIndex;
                                  return (
                                    <button
                                      key={cap.id}
                                      type="button"
                                      onClick={() => handleSelectMobileCap(idx)}
                                      className={`transition-all duration-400 ease-out cursor-pointer ${isSelected
                                          ? 'w-5 h-2 rounded-full bg-[#0066FF] dark:bg-blue-400 shadow-xs ring-2 ring-blue-500/20'
                                          : 'w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
                                        }`}
                                      title={`Switch to ${cap.label}`}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* DESKTOP VIEW (Visible on sm and up) */}
                      <div className="hidden sm:flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 select-none pt-2 sm:pt-2.5">

                        {/* Brand line */}
                        <div className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                          <img
                            src="/devnexes-logo.png"
                            alt="Devnexes AI"
                            className="w-4 h-4 object-contain shrink-0"
                          />
                          <span>Devnexes AI</span>
                        </div>

                        {/* Centered Capability Chips with subtle X dismiss */}
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
                              className={`group inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full border text-xs transition-all duration-200 cursor-pointer backdrop-blur-md shadow-2xs select-none shrink-0 whitespace-nowrap active:scale-95 ${isActive
                                ? 'bg-blue-50 dark:bg-blue-950/70 border-[#0066FF] text-[#0066FF] dark:text-blue-400 font-semibold ring-1 ring-blue-500/20'
                                : isDarkMode
                                  ? 'bg-[#121626]/80 hover:bg-[#182035] border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                                  : 'bg-white hover:bg-slate-50 border-slate-200/90 text-slate-600 hover:text-slate-900 hover:border-slate-300'
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
                    className={`flex items-center space-x-2 px-3.5 py-2 rounded-full text-xs font-semibold border shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer backdrop-blur-xl group ${isDarkMode
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
              {activeConv && activeConv.messages.length > 0 && (
                <ChatInput
                  onSendMessage={handleSendMessage}
                  isLoading={isLoading}
                  agentTraceMode={agentTraceMode}
                  onToggleAgentTraceMode={handleToggleAgentTraceMode}
                  isDarkMode={isDarkMode}
                  activeClarification={activeClarification}
                  onDismissClarification={() => setActiveClarification(null)}
                  selectedModel={selectedModel}
                  onSelectModel={setSelectedModel}
                  availableModels={availableModels}
                  onStopGeneration={handleStopGeneration}
                  isWebSearchActive={isWebSearchActive}
                  onToggleWebSearch={handleToggleWebSearch}
                  isCanvasCodeActive={isCanvasCodeActive}
                  onToggleCanvasCode={handleToggleCanvasCode}
                />
              )}
            </>
          )}
        </main>

        {/* Draggable Split Divider between Chat Pane and Code Canvas */}
        {idePanel.isOpen && (
          <>
            {isDraggingSplit && (
              <div className="fixed inset-0 z-50 cursor-col-resize select-none bg-transparent" />
            )}
            <div
              onMouseDown={handleSplitMouseDown}
              className={`hidden lg:flex items-center justify-center w-1.5 hover:w-2 hover:bg-blue-500/40 active:bg-blue-600/60 cursor-col-resize z-30 transition-all select-none group shrink-0 ${isDraggingSplit ? 'bg-blue-500 w-2 ring-2 ring-blue-500/30' : 'bg-slate-200/80 dark:bg-slate-800/80'
                }`}
              title="Drag to resize Chat and Code Canvas"
            >
              <div className={`w-0.5 h-8 rounded-full transition-colors ${isDraggingSplit ? 'bg-white' : 'bg-slate-400 dark:bg-slate-500 group-hover:bg-blue-500'}`} />
            </div>
          </>
        )}

        {/* Code Canvas Panel */}
        <IdeCodePanel
          isOpen={idePanel.isOpen}
          onClose={() => setIdePanel(prev => ({ ...prev, isOpen: false }))}
          code={idePanel.code}
          title={idePanel.title}
          language={idePanel.language}
          onOpenPreview={handleOpenPreview}
          onSendMessage={handleSendMessage}
          onCodeChange={(newCode, newTitle, newLang) => {
            try {
              if (typeof localStorage !== 'undefined') {
                localStorage.setItem('devnexes_canvas_code', newCode || '');
                if (newLang) localStorage.setItem('devnexes_canvas_language', newLang);
              }
            } catch {}
            setIdePanel(prev => ({
              ...prev,
              code: newCode,
              title: newTitle || prev.title,
              language: newLang || prev.language
            }));
          }}
        />

      </div>

      {/* Modals */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => {
          setIsApiKeyModalOpen(false);
          setHasApiKey(hasGroqApiKey() && hasGeminiApiKey());
        }}
      />

      <ArtifactModal
        isOpen={previewModal.isOpen}
        onClose={() => setPreviewModal({ isOpen: false, code: '', title: '' })}
        code={previewModal.code}
        title={previewModal.title}
        onSendMessage={handleSendMessage}
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
