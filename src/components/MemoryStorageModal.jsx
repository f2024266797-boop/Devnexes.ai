import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Brain,
  X,
  Search,
  Plus,
  Trash2,
  Edit2,
  Check,
  Download,
  Upload,
  RotateCcw,
  Sparkles,
  GraduationCap,
  Layers,
  Sliders,
  FileText,
  ShieldCheck,
  ChevronRight,
  Info,
  CheckCircle2,
  BookOpen,
  Cpu,
  FileCode,
  ArrowRight
} from 'lucide-react';
import {
  getAllMemories,
  saveMemory,
  deleteMemory,
  clearAllMemories,
  exportMemoriesAsJson,
  importMemoriesFromJson,
  getMemorySettings,
  saveMemorySettings,
  retrieveRelevantMemories,
  MEMORY_CATEGORIES
} from '../services/memoryRagService';
import { ragManager } from '../services/ragEngine';

const CATEGORY_ICONS = {
  all: Brain,
  lesson_learned: GraduationCap,
  tech_stack: Layers,
  user_preference: Sliders,
  project_fact: FileText,
  rule: ShieldCheck
};

const CATEGORY_COLORS = {
  lesson_learned: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60',
  tech_stack: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60',
  user_preference: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/60',
  project_fact: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60',
  rule: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60'
};

export default function MemoryStorageModal({ isOpen, onClose }) {
  const [memories, setMemories] = useState([]);
  const [modalTab, setModalTab] = useState('memories'); // 'memories' | 'rag_engine'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [settings, setSettings] = useState(getMemorySettings());
  const [editingItem, setEditingItem] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [notification, setNotification] = useState(null);

  // RAG Interactive Tester State
  const [ragTestQuery, setRagTestQuery] = useState('');
  const [ragTestResults, setRagTestResults] = useState([]);
  const [isRagTesting, setIsRagTesting] = useState(false);

  // Form State for Add / Edit
  const [formCategory, setFormCategory] = useState('lesson_learned');
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formTags, setFormTags] = useState('');

  // Load memories from storage
  const loadMemories = useCallback(() => {
    setMemories(getAllMemories());
    setSettings(getMemorySettings());
  }, []);

  const handleRunRagTest = useCallback((queryToTest) => {
    const q = (queryToTest !== undefined ? queryToTest : ragTestQuery).trim();
    if (!q) return;
    setIsRagTesting(true);

    try {
      const workspaceChunks = ragManager.retrieve(q, 'default', { topK: 4 }) || [];
      const memoryMatches = retrieveRelevantMemories(q, { limit: 4 }) || [];

      const combined = [
        ...workspaceChunks.map(c => ({
          ...c,
          sourceType: 'workspace_file',
          scoreBadge: `${c.relevancePercent || 90}% Match (Hybrid RRF)`
        })),
        ...memoryMatches.map(m => ({
          id: m.id,
          filePath: `Rule [${m.category}]`,
          fileName: m.title,
          lineStart: 1,
          lineEnd: 1,
          content: m.content,
          heading: m.category,
          sourceType: 'memory_rule',
          scoreBadge: `${m.relevancePercent || 85}% Match (Memory RAG)`
        }))
      ];

      setRagTestResults(combined);
    } catch (e) {
      console.warn('RAG Test error:', e);
    } finally {
      setIsRagTesting(false);
    }
  }, [ragTestQuery]);

  useEffect(() => {
    if (isOpen) {
      loadMemories();
    }
  }, [isOpen, loadMemories]);

  // Listen for memory updates from other components
  useEffect(() => {
    const handleMemoryUpdated = () => {
      loadMemories();
    };
    window.addEventListener('devnexes-memory-updated', handleMemoryUpdated);
    return () => window.removeEventListener('devnexes-memory-updated', handleMemoryUpdated);
  }, [loadMemories]);

  // Flash friendly notification
  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // Filter memories based on search query & category
  const filteredMemories = useMemo(() => {
    let list = memories;
    if (selectedCategory !== 'all') {
      list = list.filter(m => m.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(m =>
        (m.title || '').toLowerCase().includes(q) ||
        (m.content || '').toLowerCase().includes(q) ||
        (m.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [memories, selectedCategory, searchQuery]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts = { all: memories.length };
    MEMORY_CATEGORIES.forEach(cat => {
      if (cat.id !== 'all') {
        counts[cat.id] = memories.filter(m => m.category === cat.id).length;
      }
    });
    return counts;
  }, [memories]);

  const handleStartAdd = () => {
    setEditingItem(null);
    setFormCategory(selectedCategory === 'all' ? 'lesson_learned' : selectedCategory);
    setFormTitle('');
    setFormContent('');
    setFormTags('');
    setIsAdding(true);
  };

  const handleStartEdit = (item) => {
    setIsAdding(false);
    setEditingItem(item);
    setFormCategory(item.category || 'lesson_learned');
    setFormTitle(item.title || '');
    setFormContent(item.content || '');
    setFormTags((item.tags || []).join(', '));
  };

  const handleCancelForm = () => {
    setIsAdding(false);
    setEditingItem(null);
  };

  const handleSaveForm = (e) => {
    e.preventDefault();
    if (!formContent.trim()) return;

    const tagsArray = formTags
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);

    const saved = saveMemory({
      id: editingItem ? editingItem.id : undefined,
      category: formCategory,
      title: formTitle.trim() || formContent.slice(0, 35) + '...',
      content: formContent.trim(),
      tags: tagsArray,
      source: 'manual'
    });

    if (saved) {
      loadMemories();
      handleCancelForm();
      showNotification(editingItem ? 'Rule updated successfully' : 'New knowledge rule saved');
    }
  };

  const handleDeleteItem = (id, e) => {
    e.stopPropagation();
    if (deleteMemory(id)) {
      loadMemories();
      showNotification('Memory removed');
    }
  };

  const handleRestoreDefaults = () => {
    clearAllMemories(true);
    loadMemories();
    showNotification('Restored foundational rules');
  };

  const handleToggleAutoLearn = () => {
    const nextVal = !settings.autoLearnEnabled;
    saveMemorySettings({ autoLearnEnabled: nextVal });
    setSettings(prev => ({ ...prev, autoLearnEnabled: nextVal }));
    showNotification(`Auto-learning ${nextVal ? 'enabled' : 'disabled'}`);
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(exportMemoriesAsJson());
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `devnexes_rag_memories_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showNotification('Exported memory backup');
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        const result = importMemoriesFromJson(content);
        if (result.success) {
          loadMemories();
          showNotification(`Imported ${result.count} memories`);
        } else {
          showNotification(`Import failed: ${result.error}`);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-fade-in font-sans">
      <div
        className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-white dark:bg-[#0c1020] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 sm:py-3.5 flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/50">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-[#0066FF] dark:text-blue-400 flex items-center justify-center shrink-0">
              <Brain size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-100 leading-tight truncate">
                Memory & Knowledge Base
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate hidden sm:block">
                Persistent storage &bull; Self-improving agent &bull; Cross-conversation recall
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0 ml-2">
            {/* Desktop Self-Learning Toggle */}
            <button
              onClick={handleToggleAutoLearn}
              className={`hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                settings.autoLearnEnabled
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
              }`}
              title="Automatically record corrections and lessons from conversations"
            >
              <Sparkles size={12} className={settings.autoLearnEnabled ? 'text-emerald-500' : 'text-slate-400'} />
              <span>Self-Learning: {settings.autoLearnEnabled ? 'Active' : 'Off'}</span>
            </button>

            {/* Mobile Compact Self-Learning Icon */}
            <button
              onClick={handleToggleAutoLearn}
              className={`sm:hidden p-1.5 rounded-lg border text-xs cursor-pointer ${
                settings.autoLearnEnabled
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border-emerald-200 dark:border-emerald-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
              }`}
              title={`Self-Learning: ${settings.autoLearnEnabled ? 'Active' : 'Off'}`}
            >
              <Sparkles size={14} className={settings.autoLearnEnabled ? 'text-emerald-500' : 'text-slate-400'} />
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Sub-Navigation Tabs: Memories vs RAG Engine */}
        <div className="flex border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 px-3 sm:px-5 pt-1.5 sm:pt-2">
          <button
            onClick={() => setModalTab('memories')}
            className={`flex-1 sm:flex-initial pb-2 px-3 text-xs font-medium border-b-2 transition-all flex items-center justify-center space-x-1.5 cursor-pointer whitespace-nowrap ${
              modalTab === 'memories'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Brain size={13.5} />
            <span>Rules & Memories</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {memories.length}
            </span>
          </button>
          <button
            onClick={() => {
              setModalTab('rag_engine');
              if (ragTestResults.length === 0) {
                handleRunRagTest('Tailwind CSS v4 config');
              }
            }}
            className={`flex-1 sm:flex-initial pb-2 px-3 text-xs font-medium border-b-2 transition-all flex items-center justify-center space-x-1.5 cursor-pointer whitespace-nowrap ${
              modalTab === 'rag_engine'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <BookOpen size={13.5} className="text-emerald-500" />
            <span>RAG Search Tester</span>
          </button>
        </div>

        {modalTab === 'memories' ? (
          <>

        {/* Toolbar: Search, Category Tabs & Actions */}
        <div className="p-4 border-b border-slate-200/60 dark:border-slate-800/60 space-y-3 bg-white dark:bg-[#0c1020]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search memories, rules, lessons, tech stack..."
                className="w-full h-9 pl-9 pr-8 text-xs bg-slate-100/80 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={handleStartAdd}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#0066FF] hover:bg-blue-600 text-white text-xs font-medium shadow-xs cursor-pointer transition-all"
              >
                <Plus size={14} />
                <span>Add Rule</span>
              </button>

              <button
                onClick={handleExport}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Export memories to JSON"
              >
                <Download size={14} />
              </button>

              <label
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Import memories from JSON"
              >
                <Upload size={14} />
                <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
              </label>

              <button
                onClick={handleRestoreDefaults}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Reset to foundational defaults"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 custom-scrollbar text-xs">
            {MEMORY_CATEGORIES.map(cat => {
              const Icon = CATEGORY_ICONS[cat.id] || Brain;
              const isSelected = selectedCategory === cat.id;
              const count = categoryCounts[cat.id] || 0;

              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-[#0066FF] dark:text-blue-400 border border-blue-200 dark:border-blue-800/80 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <Icon size={13} />
                  <span>{cat.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-blue-200/60 dark:bg-blue-900 text-blue-800 dark:text-blue-200' : 'bg-slate-200/50 dark:bg-slate-800 text-slate-500'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area: List or Add/Edit Form */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {/* Add / Edit Drawer */}
          {(isAdding || editingItem) ? (
            <form onSubmit={handleSaveForm} className="mb-4 p-4 rounded-xl border border-blue-200/80 dark:border-blue-800/60 bg-blue-50/30 dark:bg-blue-950/20 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-2">
                  <Sparkles size={14} className="text-[#0066FF] dark:text-blue-400" />
                  <span>{editingItem ? 'Edit Knowledge Memory' : 'Add New Knowledge Rule / Memory'}</span>
                </h3>
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100"
                  >
                    {MEMORY_CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Title / Rule Name
                  </label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Tailwind CSS v4 setup rule"
                    className="w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Memory Rule / Insight Content (concise actionable instruction)
                </label>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  rows={3}
                  required
                  placeholder="Explain the lesson learned, stack requirement, or user preference in 1-3 sentences..."
                  className="w-full p-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Tags (comma-separated, helps RAG find it)
                </label>
                <input
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="tailwind, css, vite, styling, rules"
                  className="w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-[#0066FF] hover:bg-blue-600 text-white text-xs font-medium cursor-pointer shadow-xs"
                >
                  {editingItem ? 'Save Changes' : 'Add Memory Rule'}
                </button>
              </div>
            </form>
          ) : null}

          {/* Empty State */}
          {filteredMemories.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                <Brain size={24} />
              </div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {searchQuery ? 'No matching memories found' : 'No memories stored in this category'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                {searchQuery
                  ? 'Try searching with different keywords or clear the search filter.'
                  : 'Devnexes AI will automatically learn lessons from your conversations, or you can add custom rules anytime.'}
              </p>
              <button
                onClick={handleStartAdd}
                className="mt-4 flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950 text-[#0066FF] dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-xs font-medium cursor-pointer"
              >
                <Plus size={13} />
                <span>Add first rule</span>
              </button>
            </div>
          ) : (
            /* Memory Cards Grid */
            <div className="grid grid-cols-1 gap-2.5">
              {filteredMemories.map(mem => {
                const Icon = CATEGORY_ICONS[mem.category] || Brain;
                const colorClass = CATEGORY_COLORS[mem.category] || CATEGORY_COLORS.rule;
                const categoryLabel = (mem.category || 'rule').replace('_', ' ');

                return (
                  <div
                    key={mem.id}
                    className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between group shadow-2xs"
                  >
                    <div>
                      {/* Top Row: Category Pill, Recall Badge & Actions */}
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium border capitalize ${colorClass}`}>
                            <Icon size={11} />
                            <span>{categoryLabel}</span>
                          </span>

                          {mem.timesRecalled > 0 && (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                              Recalled {mem.timesRecalled}&times;
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleStartEdit(mem)}
                            className="p-1 rounded-md text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                            title="Edit memory"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={(e) => handleDeleteItem(mem.id, e)}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition-colors"
                            title="Delete memory"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Title */}
                      <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                        {mem.title || 'Knowledge Entry'}
                      </h4>

                      {/* Content */}
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed whitespace-pre-wrap font-sans">
                        {mem.content}
                      </p>
                    </div>

                    {/* Bottom: Tags */}
                    {Array.isArray(mem.tags) && mem.tags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                        {mem.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            onClick={() => setSearchQuery(tag)}
                            className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 cursor-pointer transition-colors"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        </>
        ) : (
          /* Tab 2: RAG Architecture & Live Hybrid Search Tester */
          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-5 bg-white dark:bg-[#0c1020]">
            {/* RAG Engine Status & Formula Card */}
            <div className="p-4 rounded-xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <BookOpen size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      Hybrid RAG Architecture (Retrieval-Augmented Generation)
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Okapi BM25 (Sparse) + Sublinear TF-IDF (Dense Vector) fused via Reciprocal Rank Fusion (k=60)
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-medium bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Ready &bull; Zero Context Loss
                </span>
              </div>

              {/* 5 Pillars Quick Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                <div className="p-2 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-emerald-200/50 dark:border-emerald-900/40 text-[10.5px]">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300 block">1. Chunking</span>
                  <span className="text-slate-500 dark:text-slate-400 text-[9.5px]">Syntax & AST-aware</span>
                </div>
                <div className="p-2 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-emerald-200/50 dark:border-emerald-900/40 text-[10.5px]">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300 block">2. Sparse BM25</span>
                  <span className="text-slate-500 dark:text-slate-400 text-[9.5px]">Exact IDs & symbols</span>
                </div>
                <div className="p-2 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-emerald-200/50 dark:border-emerald-900/40 text-[10.5px]">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300 block">3. Dense Vector</span>
                  <span className="text-slate-500 dark:text-slate-400 text-[9.5px]">Cosine similarity</span>
                </div>
                <div className="p-2 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-emerald-200/50 dark:border-emerald-900/40 text-[10.5px]">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300 block">4. RRF (k=60)</span>
                  <span className="text-slate-500 dark:text-slate-400 text-[9.5px]">Hybrid Rank Fusion</span>
                </div>
                <div className="p-2 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-emerald-200/50 dark:border-emerald-900/40 text-[10.5px]">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300 block">5. Citations</span>
                  <span className="text-slate-500 dark:text-slate-400 text-[9.5px]">Exact line numbers</span>
                </div>
              </div>
            </div>

            {/* Live Interactive Query Tester */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Interactive RAG Query Playground
                </span>
                <span className="text-[11px] text-slate-400">
                  Test how chunks match in real-time
                </span>
              </div>

              {/* Quick Sample Queries */}
              <div className="flex flex-wrap items-center gap-1.5">
                {['Tailwind CSS v4 config', 'React 19 & Lucide rules', 'Devnexes AI architecture', 'Zero placeholder rule'].map((sample, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setRagTestQuery(sample);
                      handleRunRagTest(sample);
                    }}
                    className="px-2 py-0.5 rounded-md text-[10.5px] bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-emerald-950 dark:hover:text-emerald-300 transition-colors cursor-pointer"
                  >
                    "{sample}"
                  </button>
                ))}
              </div>

              {/* Input + Test Button */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={ragTestQuery}
                    onChange={(e) => setRagTestQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRunRagTest()}
                    placeholder="Enter any code question, symbol, or rule to test RAG retrieval..."
                    className="w-full h-9 pl-9 pr-3 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-emerald-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 transition-all font-sans"
                  />
                </div>
                <button
                  onClick={() => handleRunRagTest()}
                  disabled={isRagTesting || !ragTestQuery.trim()}
                  className="px-3.5 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-medium cursor-pointer transition-colors flex items-center space-x-1.5 shrink-0 shadow-xs"
                >
                  <Cpu size={13} />
                  <span>{isRagTesting ? 'Retrieving...' : 'Run RAG Search'}</span>
                </button>
              </div>

              {/* Retrieval Results */}
              <div className="space-y-2.5 pt-2">
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-200/60 dark:border-slate-800/60 pb-1.5">
                  <span>Top Retrieved Chunks ({ragTestResults.length})</span>
                  <span>Scored via Reciprocal Rank Fusion</span>
                </div>

                {ragTestResults.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    Type a query above to test real-time hybrid retrieval.
                  </div>
                ) : (
                  ragTestResults.map((result, idx) => (
                    <div
                      key={result.id || idx}
                      className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 space-y-2 shadow-2xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex items-center space-x-2 min-w-0">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                            #{idx + 1}
                          </span>
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate font-mono">
                            {result.fileName || result.filePath}
                          </span>
                          {result.lineStart && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              L{result.lineStart}-{result.lineEnd}
                            </span>
                          )}
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                          {result.scoreBadge}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] leading-relaxed max-h-36 overflow-y-auto custom-scrollbar whitespace-pre-wrap">
                        {result.content}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer info banner */}
        <div className="px-5 py-3 border-t border-slate-200/60 dark:border-slate-800/60 bg-slate-50/60 dark:bg-slate-900/40 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center space-x-1.5">
            <Info size={13} className="text-blue-500 shrink-0" />
            <span>Memories are automatically matched and injected into Groq, Gemini, Tavily, and Stability prompts.</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-medium cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
