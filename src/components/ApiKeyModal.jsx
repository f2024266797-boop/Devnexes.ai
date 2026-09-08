import React, { useState } from 'react';
import { Key, X, ExternalLink, Check, Info, Layers, ShieldCheck } from 'lucide-react';
import { getGroqApiKey, setGroqApiKey, getAllGroqApiKeys } from '../services/groqService';

export default function ApiKeyModal({ isOpen, onClose, onSave }) {
  const [apiKey, setApiKeyInput] = useState(getGroqApiKey());
  const [savedSuccess, setSavedSuccess] = useState(false);
  const activeKeys = getAllGroqApiKeys();

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    setGroqApiKey(apiKey);
    setSavedSuccess(true);
    if (onSave) onSave(apiKey);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-[#0066FF] dark:text-blue-400 flex items-center justify-center">
              <Key size={16} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Groq API Key Pool</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Multi-Key Automatic Failover & Rotation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 flex items-start space-x-2.5 text-xs text-blue-900 dark:text-blue-300">
            <Layers size={16} className="shrink-0 mt-0.5 text-[#0066FF] dark:text-blue-400" />
            <div>
              <p className="font-semibold mb-0.5">Active Key Pool: {activeKeys.length} {activeKeys.length === 1 ? 'Key' : 'Keys'} Connected</p>
              <p className="text-[11px] opacity-90">If any key hits a rate limit or runs out of quota, Devnexes AI automatically rotates to the next available key without interrupting your flow.</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Custom / Override Groq API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="gsk_..."
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono"
            />
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noreferrer"
              className="text-[#0066FF] hover:underline flex items-center space-x-1 font-medium"
            >
              <span>Get Groq API Key</span>
              <ExternalLink size={11} />
            </a>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white rounded-xl shadow-sm transition-colors flex items-center space-x-1.5"
            >
              {savedSuccess ? (
                <>
                  <Check size={14} />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Key</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
