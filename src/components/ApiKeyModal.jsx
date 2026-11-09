import React, { useState, useEffect } from 'react';
import { 
  Key, 
  X, 
  ExternalLink, 
  Check, 
  Code2, 
  MessageSquare, 
  Globe,
  Eye, 
  EyeOff, 
  RotateCw,
  Layers,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { getGroqApiKeys, saveGroqApiKeys, getGroqKeysStatus } from '../services/groqService';
import { getGeminiApiKeys, saveGeminiApiKeys, getGeminiKeysStatus } from '../services/geminiService';
import { getSearchKeys, saveSearchKeys } from '../services/searchService';
import { getHfToken, saveHfToken, getStabilityApiKey, saveStabilityApiKey } from '../services/imageService';

export default function ApiKeyModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('groq'); // 'groq' | 'gemini' | 'search' | 'image'
  const [groqKeys, setGroqKeys] = useState(['', '', '']);
  const [geminiKeys, setGeminiKeys] = useState(['', '', '']);
  const [tavilyKey, setTavilyKey] = useState('');
  const [braveKey, setBraveKey] = useState('');
  const [searxngUrl, setSearxngUrl] = useState('');
  const [hfToken, setHfToken] = useState('');
  const [stabilityKey, setStabilityKey] = useState('');
  const [showKey, setShowKey] = useState({});
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [groqStatus, setGroqStatus] = useState([]);
  const [geminiStatus, setGeminiStatus] = useState([]);

  useEffect(() => {
    if (isOpen) {
      setGroqKeys(getGroqApiKeys());
      setGeminiKeys(getGeminiApiKeys());
      const sKeys = getSearchKeys();
      setTavilyKey(sKeys.tavilyKey);
      setBraveKey(sKeys.braveKey);
      setSearxngUrl(sKeys.searxngUrl || '');
      setHfToken(getHfToken());
      setStabilityKey(getStabilityApiKey());
      setGroqStatus(getGroqKeysStatus());
      setGeminiStatus(getGeminiKeysStatus());
      setSavedSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    saveGroqApiKeys(groqKeys);
    saveGeminiApiKeys(geminiKeys);
    saveSearchKeys({ tavilyKey, braveKey, searxngUrl });
    saveHfToken(hfToken);
    saveStabilityApiKey(stabilityKey);
    setGroqStatus(getGroqKeysStatus());
    setGeminiStatus(getGeminiKeysStatus());
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  const toggleShowKey = (id) => {
    setShowKey(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleGroqChange = (index, value) => {
    setGroqKeys(prev => {
      const copy = [...prev];
      copy[index] = value;
      return copy;
    });
  };

  const handleGeminiChange = (index, value) => {
    setGeminiKeys(prev => {
      const copy = [...prev];
      copy[index] = value;
      return copy;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-white dark:bg-[#0d1120] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">

        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-[#0066FF] dark:text-blue-400 flex items-center justify-center shrink-0">
              <Key size={16} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">API Keys & Engine Settings</h2>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">Groq text • Gemini code • Tavily & SearXNG search</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center px-4 pt-2.5 gap-1.5 border-b border-slate-100 dark:border-slate-800/80 shrink-0 overflow-x-auto custom-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('groq')}
            className={`flex items-center space-x-1.5 pb-2.5 px-2.5 text-xs sm:text-[13px] font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'groq'
                ? 'border-[#0066FF] text-[#0066FF] dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <MessageSquare size={13} />
            <span>Groq (Text)</span>
            <span className="text-[9.5px] px-1.5 py-0.2 rounded-full bg-blue-50 dark:bg-blue-950 text-[#0066FF] font-bold">3 Keys</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('gemini')}
            className={`flex items-center space-x-1.5 pb-2.5 px-2.5 text-xs sm:text-[13px] font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'gemini'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Code2 size={13} />
            <span>Gemini (Code)</span>
            <span className="text-[9.5px] px-1.5 py-0.2 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 font-bold">3 Keys</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('search')}
            className={`flex items-center space-x-1.5 pb-2.5 px-2.5 text-xs sm:text-[13px] font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'search'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Globe size={13} />
            <span>Web Search</span>
            <span className="text-[9.5px] px-1.5 py-0.2 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 font-bold">Tavily + SearXNG</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('image')}
            className={`flex items-center space-x-1.5 pb-2.5 px-2.5 text-xs sm:text-[13px] font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'image'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles size={13} />
            <span>Image (SD 1.5)</span>
            <span className="text-[9.5px] px-1.5 py-0.2 rounded-full bg-purple-50 dark:bg-purple-950 text-purple-600 font-bold">Stable Diffusion</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs leading-relaxed custom-scrollbar flex-1">

          {/* ── GROQ TAB ─────────────────────────────────────────── */}
          {activeTab === 'groq' && (
            <div className="space-y-3.5 animate-fade-in">
              <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 flex items-start space-x-2.5 text-blue-900 dark:text-blue-300">
                <RotateCw size={15} className="shrink-0 mt-0.5 text-[#0066FF] dark:text-blue-400" />
                <div>
                  <p className="font-semibold mb-0.5">Groq Cloud — Ultra-Fast Reasoning Engine (Qwen 3.8 / GPT-OSS)</p>
                  <p className="text-[11px] opacity-90">
                    Handles conversations, master graph planning, and commands. If Key #1 hits rate limits (429), it automatically switches to Key #2 and Key #3.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Groq API Keys (3 Slots)
                </span>
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#0066FF] hover:underline flex items-center space-x-1 font-medium text-[11px]"
                >
                  <span>Get Groq Keys</span>
                  <ExternalLink size={10} />
                </a>
              </div>

              {[0, 1, 2].map((idx) => {
                const isPrimary = idx === 0;
                const status = groqStatus[idx] || {};
                const inputId = `groq_${idx}`;
                const isVisible = showKey[inputId];

                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                        <span>{isPrimary ? '🔑 Groq Key #1 (Primary)' : `🔄 Groq Key #${idx + 1} (Fallback ${idx})`}</span>
                        {status.isActive && (
                          <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-900/60 text-[#0066FF]">
                            Active
                          </span>
                        )}
                        {status.inCooldown && (
                          <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-600">
                            Cooldown
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="relative flex items-center">
                      <input
                        type={isVisible ? 'text' : 'password'}
                        value={groqKeys[idx]}
                        onChange={(e) => handleGroqChange(idx, e.target.value)}
                        placeholder={`gsk_... (${isPrimary ? 'Required for chat' : 'Optional fallback'})`}
                        className="w-full px-3 py-2 pr-9 rounded-xl bg-slate-50 dark:bg-[#121626] border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#0066FF] font-mono text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowKey(inputId)}
                        className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
                      >
                        {isVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── GEMINI TAB ───────────────────────────────────────── */}
          {activeTab === 'gemini' && (
            <div className="space-y-3.5 animate-fade-in">
              <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/50 flex items-start space-x-2.5 text-emerald-900 dark:text-emerald-300">
                <Code2 size={15} className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <p className="font-semibold mb-0.5">Google Gemini 2.5 Flash — Dedicated Coding Engine</p>
                  <p className="text-[11px] opacity-90">
                    Powers 100% of Code Generation, Interactive HTML Canvas, and Artifacts. Rotates across 3 keys automatically when quotas expire.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Gemini API Keys (3 Slots)
                </span>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-600 hover:underline flex items-center space-x-1 font-medium text-[11px]"
                >
                  <span>Get Gemini Keys</span>
                  <ExternalLink size={10} />
                </a>
              </div>

              {[0, 1, 2].map((idx) => {
                const isPrimary = idx === 0;
                const status = geminiStatus[idx] || {};
                const inputId = `gemini_${idx}`;
                const isVisible = showKey[inputId];

                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                        <span>{isPrimary ? '⚡ Gemini Key #1 (Primary Code)' : `🔄 Gemini Key #${idx + 1} (Fallback ${idx})`}</span>
                        {status.isActive && (
                          <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600">
                            Active
                          </span>
                        )}
                        {status.inCooldown && (
                          <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-600">
                            Quota Cooldown
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="relative flex items-center">
                      <input
                        type={isVisible ? 'text' : 'password'}
                        value={geminiKeys[idx]}
                        onChange={(e) => handleGeminiChange(idx, e.target.value)}
                        placeholder={`AIzaSy... (${isPrimary ? 'Required for Coding' : 'Optional fallback'})`}
                        className="w-full px-3 py-2 pr-9 rounded-xl bg-slate-50 dark:bg-[#121626] border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowKey(inputId)}
                        className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
                      >
                        {isVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── SEARCH TAB ───────────────────────────────────────── */}
          {activeTab === 'search' && (
            <div className="space-y-3.5 animate-fade-in">
              <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/50 flex items-start space-x-2.5 text-indigo-900 dark:text-indigo-300">
                <Globe size={15} className="shrink-0 mt-0.5 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <p className="font-semibold mb-0.5">Dual Real-Time Search Engine (Tavily + SearXNG)</p>
                  <p className="text-[11px] opacity-90">
                    Queries <strong>Tavily</strong> and <strong>SearXNG</strong> in parallel, merges and deduplicates verified live web findings, and feeds the unified context to <strong>Groq</strong> for synthesis.
                  </p>
                </div>
              </div>

              {/* Priority 1A: Tavily */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                    <span>🥇 Priority 1A: Tavily AI Search</span>
                    {tavilyKey && (
                      <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600">
                        Active Parallel
                      </span>
                    )}
                  </span>
                  <a
                    href="https://app.tavily.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#0066FF] hover:underline flex items-center space-x-1 font-medium text-[11px]"
                  >
                    <span>Get Tavily Key</span>
                    <ExternalLink size={10} />
                  </a>
                </div>

                <div className="relative flex items-center">
                  <input
                    type={showKey.tavily ? 'text' : 'password'}
                    value={tavilyKey}
                    onChange={(e) => setTavilyKey(e.target.value)}
                    placeholder="tvly-... (AI Web Search)"
                    className="w-full px-3 py-2 pr-9 rounded-xl bg-slate-50 dark:bg-[#121626] border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#0066FF] font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey('tavily')}
                    className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
                  >
                    {showKey.tavily ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>

              {/* Priority 1B: SearXNG Multi-Engine */}
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                    <span>⚡ Priority 1B: SearXNG Multi-Engine</span>
                    <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-600">
                      Auto-Balanced
                    </span>
                  </span>
                  <span className="text-[10px] text-slate-400">Zero-Key / Custom URL</span>
                </div>

                <input
                  type="text"
                  value={searxngUrl}
                  onChange={(e) => setSearxngUrl(e.target.value)}
                  placeholder="Optional custom instance: https://searxng.site or http://localhost:8080"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#121626] border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 font-mono text-xs"
                />
                <p className="text-[10.5px] text-slate-400 dark:text-slate-500">
                  Runs simultaneously with Tavily across Google, Bing, Reddit, & Wikipedia. Leave empty to use auto-balanced public pool.
                </p>
              </div>

              {/* Priority 2: Brave Search */}
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                    <span>🥈 Priority 2: Brave Search API</span>
                    {braveKey && (
                      <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600">
                        Fallback #1
                      </span>
                    )}
                  </span>
                  <a
                    href="https://brave.com/search/api/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 hover:underline flex items-center space-x-1 font-medium text-[11px]"
                  >
                    <span>Get Brave Key</span>
                    <ExternalLink size={10} />
                  </a>
                </div>

                <div className="relative flex items-center">
                  <input
                    type={showKey.brave ? 'text' : 'password'}
                    value={braveKey}
                    onChange={(e) => setBraveKey(e.target.value)}
                    placeholder="BSA... (Brave Subscription Token)"
                    className="w-full px-3 py-2 pr-9 rounded-xl bg-slate-50 dark:bg-[#121626] border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey('brave')}
                    className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
                  >
                    {showKey.brave ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>

              {/* Priority 3: DuckDuckGo + Wikipedia (Free) */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-[#121626]/60 flex items-start space-x-2.5">
                <ShieldCheck size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                       Priority 3: DuckDuckGo & Wikipedia
                    </span>
                    <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-600">
                      Always Ready
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    100% open-source and free fallback. Requires zero API keys and works automatically if Tavily and Brave are not set or unavailable.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── IMAGE TAB (STABLE DIFFUSION 1.5) ─────────────────── */}
          {activeTab === 'image' && (
            <div className="space-y-3.5 animate-fade-in">
              <div className="p-3 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-900/50 flex items-start space-x-2.5 text-purple-900 dark:text-purple-300">
                <Sparkles size={15} className="shrink-0 mt-0.5 text-purple-600 dark:text-purple-400" />
                <div>
                  <p className="font-semibold mb-0.5">Stable Diffusion 1.5 Architecture</p>
                  <p className="text-[11px] opacity-90">
                    Generates photorealistic imagery dynamically when you ask to create, draw, or synthesize pictures (or use <code>/image</code>).
                  </p>
                </div>
              </div>

              {/* Priority 1: Hugging Face Token */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121626] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 font-semibold text-slate-800 dark:text-slate-200 text-xs">
                    <span>🤗 Priority 1: Hugging Face Token</span>
                    {hfToken && (
                      <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-600">
                        Active
                      </span>
                    )}
                  </div>
                  <a
                    href="https://huggingface.co/settings/tokens"
                    target="_blank"
                    rel="noreferrer"
                    className="text-purple-600 dark:text-purple-400 hover:underline flex items-center space-x-1 font-medium text-[11px]"
                  >
                    <span>Get Free HF Token</span>
                    <ExternalLink size={10} />
                  </a>
                </div>

                <div className="relative flex items-center">
                  <input
                    type={showKey.hf ? 'text' : 'password'}
                    value={hfToken}
                    onChange={(e) => setHfToken(e.target.value)}
                    placeholder="hf_... (Free User Access Token)"
                    className="w-full pl-3 pr-9 py-2 rounded-lg bg-slate-50 dark:bg-[#080b12] border border-slate-200 dark:border-slate-800 text-xs font-mono focus:outline-none focus:border-purple-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey('hf')}
                    className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
                  >
                    {showKey.hf ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
                <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                  Connects directly to official <code>runwayml/stable-diffusion-v1-5</code> model weights.
                </p>
              </div>

              {/* Priority 2: Stability AI Key (Optional) */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121626] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 font-semibold text-slate-800 dark:text-slate-200 text-xs">
                    <span>⚡ Priority 2: Stability AI API Key</span>
                    {stabilityKey && (
                      <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-600">
                        Active
                      </span>
                    )}
                  </div>
                  <a
                    href="https://platform.stability.ai/account/keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center space-x-1 font-medium text-[11px]"
                  >
                    <span>Get Key</span>
                    <ExternalLink size={10} />
                  </a>
                </div>

                <div className="relative flex items-center">
                  <input
                    type={showKey.stability ? 'text' : 'password'}
                    value={stabilityKey}
                    onChange={(e) => setStabilityKey(e.target.value)}
                    placeholder="sk-... (Stability AI Engine)"
                    className="w-full pl-3 pr-9 py-2 rounded-lg bg-slate-50 dark:bg-[#080b12] border border-slate-200 dark:border-slate-800 text-xs font-mono focus:outline-none focus:border-indigo-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowKey('stability')}
                    className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
                  >
                    {showKey.stability ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>

              {/* Local WebUI or Decentralized AI Horde Support */}
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-[#121626]/60 flex items-start space-x-2.5">
                <ShieldCheck size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                    🖥️ Local AUTOMATIC1111 / AI Horde Grid
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Devnexes AI automatically detects local Stable Diffusion WebUI on <code>http://127.0.0.1:7860</code>, or routes through the decentralized AI Horde SD 1.5 grid.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-[#0a0d18]">
          <div className="flex items-center space-x-2 text-[11px] text-slate-500 dark:text-slate-400">
            <Layers size={13} />
            <span>Keys are securely saved in your browser</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-[#0066FF] hover:bg-blue-700 active:scale-95 text-white shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              {savedSuccess ? (
                <>
                  <Check size={13} className="text-emerald-300" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Keys</span>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
