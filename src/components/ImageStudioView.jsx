import React, { useState, useMemo, useEffect } from 'react';
import { 
  Sparkles, 
  Wand2, 
  Download, 
  Copy, 
  Check, 
  Maximize2, 
  MessageSquare, 
  ArrowRight, 
  Flame, 
  Palette,
  ChevronLeft,
  ChevronRight,
  Sparkle
} from 'lucide-react';

const PRESET_IMAGE_CARDS = [
  {
    id: 'cinematic-portrait',
    title: 'Cinematic 8K Portrait',
    category: 'Photorealistic',
    badge: 'PHOTO',
    badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300',
    prompt: 'Ultra-realistic close-up portrait of an adventurer with warm golden hour sunlight, sharp depth of field, 85mm f/1.4 lens, cinematic lighting, 8k resolution.',
    imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'cyberpunk-city',
    title: 'Neon Cyberpunk Metropolis',
    category: 'Sci-Fi',
    badge: 'CYBERPUNK',
    badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300',
    prompt: 'Sprawling futuristic cyberpunk city at midnight, neon reflections on wet asphalt streets, flying vehicles, atmospheric haze, Octane 3D render.',
    imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: '3d-character',
    title: '3D Pixar Companion',
    category: '3D Art',
    badge: '3D RENDER',
    badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300',
    prompt: 'Cute 3D animated robotic companion in a colorful high-tech workshop, expressive glowing eyes, Pixar aesthetic, subsurface scattering, vibrant lighting.',
    imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'minimalist-logo',
    title: 'Geometric Tech Logo',
    category: 'Logo Design',
    badge: 'LOGO',
    badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300',
    prompt: 'Minimalist geometric logo of an origami eagle, sharp clean vector lines, royal blue and emerald gradient on pure white background, corporate branding.',
    imageUrl: 'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'anime-concept',
    title: 'Makoto Shinkai Anime',
    category: 'Anime',
    badge: 'ANIME',
    badgeColor: 'bg-pink-100 text-pink-800 dark:bg-pink-950/80 dark:text-pink-300',
    prompt: 'Anime hero standing on rooftop overlooking vibrant Tokyo skyline, dramatic cumulus clouds, cinematic sunset lens flare, Makoto Shinkai art style.',
    imageUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'zen-architecture',
    title: 'Modern Zen Sanctuary',
    category: 'Architecture',
    badge: 'ARCH',
    badgeColor: 'bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300',
    prompt: 'Modern minimalist luxury villa with floor-to-ceiling glass looking onto misty Japanese bamboo garden, natural warm oak wood, interior design photography.',
    imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'supercar-concept',
    title: 'Hypercar Concept',
    category: 'Automotive',
    badge: 'CONCEPT',
    badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300',
    prompt: 'Next-generation electric hypercar speeding on coastal highway at dusk, aggressive aerodynamic carbon fiber body, motion blur, 8K automotive render.',
    imageUrl: 'https://images.unsplash.com/photo-1617788138017-80ad40651399?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: 'deep-space',
    title: 'Cosmic Nebula Wonder',
    category: 'Sci-Fi',
    badge: 'GALAXY',
    badgeColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300',
    prompt: 'Breathtaking interstellar nebula with swirling iridescent gas clouds, newborn star clusters, cosmic rays, Hubble telescope photography, ultra HD.',
    imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80'
  }
];

const STYLE_FILTERS = [
  'All',
  'Photorealistic',
  'Sci-Fi',
  '3D Art',
  'Anime',
  'Logo Design',
  'Architecture',
  'Automotive'
];

const QUICK_INSPIRATION_PROMPTS = [
  { tag: '8K Portrait', prompt: 'Ultra-realistic close-up portrait of an adventurer with warm golden hour sunlight, sharp depth of field, 85mm f/1.4 lens, cinematic lighting, 8k resolution.' },
  { tag: 'Cyberpunk', prompt: 'Sprawling futuristic cyberpunk city at midnight, neon reflections on wet asphalt streets, flying vehicles, atmospheric haze, Octane 3D render.' },
  { tag: '3D Pixar', prompt: 'Cute 3D animated robotic companion in a colorful high-tech workshop, expressive glowing eyes, Pixar aesthetic, subsurface scattering, vibrant lighting.' },
  { tag: 'Vector Logo', prompt: 'Minimalist geometric logo of an origami eagle, sharp clean vector lines, royal blue and emerald gradient on pure white background, corporate branding.' },
  { tag: 'Anime Scene', prompt: 'Anime hero standing on rooftop overlooking vibrant Tokyo skyline, dramatic cumulus clouds, cinematic sunset lens flare, Makoto Shinkai art style.' },
  { tag: 'Zen Villa', prompt: 'Modern minimalist luxury villa with floor-to-ceiling glass looking onto misty Japanese bamboo garden, natural warm oak wood, interior design photography.' },
  { tag: 'Hypercar', prompt: 'Next-generation electric hypercar speeding on coastal highway at dusk, aggressive aerodynamic carbon fiber body, motion blur, 8K automotive render.' }
];

export default function ImageStudioView({
  onGenerateImage,
  onOpenImageModal,
  conversations = [],
  isDarkMode = false,
  onSwitchToChat
}) {
  const [promptText, setPromptText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [copiedId, setCopiedId] = useState(null);
  const [mobileCardIndex, setMobileCardIndex] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(true);

  // Extract all generated images from conversation history
  const generatedHistory = useMemo(() => {
    const list = [];
    conversations.forEach(conv => {
      conv.messages.forEach(msg => {
        if (msg.image) {
          list.push({
            id: msg.id || Math.random().toString(),
            url: msg.image,
            prompt: msg.content || 'Generated Visual',
            date: msg.timestamp
          });
        }
        if (msg.traceData?.steps) {
          msg.traceData.steps.forEach(step => {
            if ((step.type === 'image' || step.name?.toLowerCase().includes('image')) && step.imageUrl) {
              list.push({
                id: step.id || Math.random().toString(),
                url: step.imageUrl,
                prompt: step.task || step.imagePrompt || msg.content || 'Generated Visual',
                date: msg.timestamp
              });
            }
          });
        }
      });
    });
    return list;
  }, [conversations]);

  const filteredCards = useMemo(() => {
    if (selectedCategory === 'All') return PRESET_IMAGE_CARDS;
    return PRESET_IMAGE_CARDS.filter(c => c.category === selectedCategory);
  }, [selectedCategory]);

  // Auto-cycle through inspiration cards 1-by-1 on mobile ("ik ik karky ayyjay and gaib hui jayy")
  useEffect(() => {
    if (!isAutoPlay || filteredCards.length <= 1) return;
    const interval = setInterval(() => {
      setMobileCardIndex(prev => (prev + 1) % filteredCards.length);
    }, 3800);
    return () => clearInterval(interval);
  }, [isAutoPlay, filteredCards.length]);

  useEffect(() => {
    setMobileCardIndex(0);
  }, [selectedCategory]);

  const handleCopyPrompt = (id, text, e) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleUsePrompt = (prompt) => {
    setPromptText(prompt);
    // Smooth scroll to top prompt input
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!promptText.trim()) return;
    onGenerateImage(promptText.trim());
  };

  return (
    <div className="flex-1 h-full overflow-y-auto custom-scrollbar p-3.5 sm:p-6 md:p-8 max-w-6xl mx-auto w-full select-none font-sans">
      
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-6 mb-6 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#0066FF] to-blue-400 p-2 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                AI Image Studio
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 dark:bg-blue-950 text-[#0066FF] dark:text-blue-300">
                PRO ENGINE
              </span>
            </div>
            <p className="text-xs sm:text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">
              Generate photorealistic visuals, logos, 3D renders, and cinematic concept art.
            </p>
          </div>
        </div>

        {onSwitchToChat && (
          <button
            onClick={onSwitchToChat}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all border border-slate-200/80 dark:border-slate-700/80 cursor-pointer"
          >
            <MessageSquare size={13} />
            <span className="hidden sm:inline">Back to Chat</span>
          </button>
        )}
      </div>

      {/* Main Prompt Generator Card */}
      <div className={`p-4 sm:p-5 rounded-2xl border mb-8 transition-all shadow-sm ${
        isDarkMode 
          ? 'bg-[#0f1424]/90 border-blue-500/30 shadow-[0_8px_30px_rgba(0,0,0,0.5)]' 
          : 'bg-white border-blue-200 shadow-[0_8px_30px_rgba(0,102,255,0.06)]'
      }`}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Describe the image you want to create (e.g. Majestic lion with glowing cosmic mane standing on mountain summit at dusk, 8k render)..."
              rows={3}
              className="w-full p-3 sm:p-4 text-[13.5px] sm:text-[14.5px] bg-slate-50 dark:bg-[#070a14] border border-slate-200 dark:border-slate-800 rounded-xl outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-[#0066FF] dark:focus:border-blue-400 transition-all resize-none font-sans"
            />
          </div>

          {/* Quick 1-Click Prompt Chips (User Friendly Shortcut) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 select-none">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 shrink-0 flex items-center gap-1">
              <Sparkle size={11} className="text-[#0066FF]" />
              Quick:
            </span>
            {QUICK_INSPIRATION_PROMPTS.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setPromptText(item.prompt)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 hover:bg-blue-50 dark:bg-slate-850 dark:hover:bg-blue-950/70 text-slate-700 dark:text-slate-300 hover:text-[#0066FF] dark:hover:text-blue-400 border border-slate-200/80 dark:border-slate-800 transition-colors shrink-0 cursor-pointer"
              >
                {item.tag}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Palette size={13} className="text-[#0066FF] dark:text-blue-400 shrink-0" />
              <span className="text-[11.5px] font-medium hidden xs:inline">Select any preset below to load prompt.</span>
            </div>

            <div className="flex items-center space-x-2 ml-auto">
              {promptText && (
                <button
                  type="button"
                  onClick={() => setPromptText('')}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
              <button
                type="submit"
                disabled={!promptText.trim()}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#0066FF] to-blue-600 hover:from-blue-600 hover:to-[#0066FF] active:scale-[0.98] text-white text-xs sm:text-[13px] font-semibold shadow-sm shadow-blue-500/25 hover:shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Wand2 size={14} />
                <span>Generate Image</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Style Filter Pills Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4 select-none">
        <div className="flex items-center space-x-1.5 shrink-0">
          <Flame size={15} className="text-amber-500" />
          <h2 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100">
            Inspiration & Style Presets
          </h2>
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-1 w-full sm:max-w-md">
          {STYLE_FILTERS.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all shrink-0 cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#0066FF] text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* MOBILE VIEW (sm:hidden): Compact 1-by-1 Auto-Cycle Carousel ("ik ik karky ayyjay and gaib hui jayy") */}
      <div className="sm:hidden mb-8 select-none">
        {filteredCards.length > 0 && (() => {
          const currentCard = filteredCards[mobileCardIndex] || filteredCards[0];
          return (
            <div 
              className="relative rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0e1322] shadow-sm overflow-hidden"
              onTouchStart={() => setIsAutoPlay(false)}
              onTouchEnd={() => setIsAutoPlay(true)}
              onMouseEnter={() => setIsAutoPlay(false)}
              onMouseLeave={() => setIsAutoPlay(true)}
            >
              {/* Active Card Body with Smooth Fade Transition */}
              <div key={currentCard.id} className="animate-fade-in flex flex-col">
                {/* Compact Thumbnail */}
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-900/10 dark:bg-black/40">
                  <img
                    src={currentCard.imageUrl}
                    alt={currentCard.title}
                    onError={(e) => {
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80';
                    }}
                    className="w-full h-full object-cover"
                  />
                  {/* Category Badge */}
                  <span className={`absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md text-[9.5px] font-bold tracking-wider shadow-xs ${currentCard.badgeColor}`}>
                    {currentCard.badge}
                  </span>
                  {/* Zoom Modal Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenImageModal?.(currentCard.imageUrl);
                    }}
                    className="absolute top-2.5 right-2.5 w-7 h-7 rounded-lg bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-xs transition-colors"
                    title="Zoom Preview"
                  >
                    <Maximize2 size={12} />
                  </button>
                </div>

                {/* Compact Card Info */}
                <div className="p-3.5 space-y-2.5">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate pr-2">
                        {currentCard.title}
                      </h3>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {mobileCardIndex + 1} / {filteredCards.length}
                      </span>
                    </div>
                    <p className="text-[11.5px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
                      {currentCard.prompt}
                    </p>
                  </div>

                  {/* Card Action Row */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={(e) => handleCopyPrompt(currentCard.id, currentCard.prompt, e)}
                        className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Copy Prompt"
                      >
                        {copiedId === currentCard.id ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUsePrompt(currentCard.prompt)}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 transition-colors"
                      >
                        Use Prompt
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => onGenerateImage(currentCard.prompt)}
                      className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0066FF] hover:bg-blue-600 text-white shadow-xs transition-colors"
                    >
                      <span>Generate</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Navigation Stepper Controls (Arrows + Dots) */}
              <div className="flex items-center justify-between px-3 py-2 bg-slate-50/80 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setMobileCardIndex(prev => (prev - 1 + filteredCards.length) % filteredCards.length)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                  title="Previous Preset"
                >
                  <ChevronLeft size={16} />
                </button>

                {/* 8-Dots Stepper Indicator (● ▬ ● ●) */}
                <div className="flex items-center space-x-1">
                  {filteredCards.map((card, idx) => {
                    const isSelected = idx === mobileCardIndex;
                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => setMobileCardIndex(idx)}
                        className={`transition-all duration-300 cursor-pointer ${
                          isSelected
                            ? 'w-4 h-1.5 rounded-full bg-[#0066FF] dark:bg-blue-400'
                            : 'w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
                        }`}
                        title={card.title}
                      />
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setMobileCardIndex(prev => (prev + 1) % filteredCards.length)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                  title="Next Preset"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* DESKTOP / TABLET VIEW: Full 4-Column Grid */}
      <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {filteredCards.map((card) => (
          <div
            key={card.id}
            onClick={() => handleUsePrompt(card.prompt)}
            className={`group rounded-2xl overflow-hidden border transition-all duration-200 cursor-pointer flex flex-col hover:shadow-lg hover:-translate-y-0.5 ${
              isDarkMode 
                ? 'bg-[#0e1322] border-slate-800/80 hover:border-blue-500/50' 
                : 'bg-white border-slate-200/90 hover:border-blue-300 shadow-2xs'
            }`}
          >
            {/* Card Thumbnail */}
            <div className="relative aspect-[16/10] overflow-hidden bg-slate-900/10 dark:bg-black/40">
              <img
                src={card.imageUrl}
                alt={card.title}
                onError={(e) => {
                  e.currentTarget.src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80';
                }}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
              <span className={`absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wider ${card.badgeColor}`}>
                {card.badge}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenImageModal?.(card.imageUrl);
                }}
                className="absolute top-2.5 right-2.5 w-6.5 h-6.5 rounded-md bg-black/60 hover:bg-black/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                title="Zoom Preview"
              >
                <Maximize2 size={11} />
              </button>
            </div>

            {/* Card Content */}
            <div className="p-3 sm:p-3.5 flex flex-col justify-between flex-1">
              <div>
                <h3 className="font-semibold text-xs sm:text-[13px] text-slate-800 dark:text-slate-100 group-hover:text-[#0066FF] dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                  {card.title}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {card.prompt}
                </p>
              </div>

              {/* Card Footer Actions */}
              <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100 dark:border-slate-800/60">
                <button
                  type="button"
                  onClick={(e) => handleCopyPrompt(card.id, card.prompt, e)}
                  className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  title="Copy Prompt"
                >
                  {copiedId === card.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onGenerateImage(card.prompt);
                  }}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-[#0066FF] dark:text-blue-400 hover:bg-[#0066FF] hover:text-white dark:hover:bg-blue-600 transition-all cursor-pointer"
                >
                  <span>Generate</span>
                  <ArrowRight size={11} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Your Generated History Section */}
      {generatedHistory.length > 0 && (
        <div className="mt-8 pt-6 border-t border-slate-200/80 dark:border-slate-800/80">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Sparkles size={15} className="text-[#0066FF] dark:text-blue-400" />
              <h2 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100">
                Your Generated Images ({generatedHistory.length})
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {generatedHistory.map((img) => (
              <div
                key={img.id}
                onClick={() => onOpenImageModal?.(img.url)}
                className="group relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 aspect-square cursor-pointer hover:shadow-md transition-all"
              >
                <img
                  src={img.url}
                  alt={img.prompt}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  loading="lazy"
                />
                
                {/* Floating Hover Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2.5 flex flex-col justify-between">
                  <div className="flex items-center justify-end space-x-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const a = document.createElement('a');
                        a.href = img.url;
                        a.download = `devnexes-image-${Date.now()}.png`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                      }}
                      className="p-1 rounded-md bg-black/60 hover:bg-black/80 text-white transition-colors cursor-pointer"
                      title="Download Image"
                    >
                      <Download size={12} />
                    </button>
                  </div>

                  <p className="text-[10.5px] text-white line-clamp-2 font-medium leading-tight drop-shadow-sm">
                    {img.prompt}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

