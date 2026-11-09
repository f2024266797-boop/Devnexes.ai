import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Monitor, 
  Tablet, 
  Smartphone, 
  MousePointerClick, 
  RefreshCw, 
  Sparkles, 
  X, 
  Check, 
  Maximize2
} from 'lucide-react';

/**
 * Devnexes AI - Interactive Canvas Live Preview Engine
 * Features:
 * 1. Responsive Screen Switcher (Desktop 100%, Tablet 768px, Mobile 375px with realistic frame)
 * 2. Visual Element Inspector (Inspect & Click-to-Edit like v0 / Lovable)
 * 3. React 18 + JSX + Tailwind Sandbox Runtime with Babel transpilation
 * 4. Inline AI Targeted Modification Drawer with quick chips
 */
export default function CanvasLivePreview({
  code,
  language = 'html',
  title = 'Preview',
  onSendMessage,
  onOpenFullscreen
}) {
  const [screenMode, setScreenMode] = useState('desktop'); // 'desktop' | 'tablet' | 'mobile'
  const [isInspectMode, setIsInspectMode] = useState(false);
  const [selectedElement, setSelectedElement] = useState(null);
  const [inspectPrompt, setInspectPrompt] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const iframeRef = useRef(null);

  // Clean raw code: remove markdown code fence tags
  const rawCode = useMemo(() => {
    return (code || '')
      .replace(/^```[a-z0-9_]*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();
  }, [code]);

  // Detect whether code is React JSX component vs standard HTML
  const isReactJsx = useMemo(() => {
    const lang = (language || '').toLowerCase();
    if (lang === 'jsx' || lang === 'tsx' || lang === 'react') return true;
    if (rawCode.includes('<!DOCTYPE') || rawCode.includes('<html')) return false;
    return (
      rawCode.includes('import React') ||
      rawCode.includes('export default function') ||
      rawCode.includes('function App') ||
      rawCode.includes('const App =') ||
      rawCode.includes('useState(') ||
      rawCode.includes('useEffect(') ||
      /return\s*\(\s*<[a-z0-9]/i.test(rawCode)
    );
  }, [rawCode, language]);

  // Clean React code for standalone Babel execution (remove unsupported ES import/export statements)
  const preparedReactCode = useMemo(() => {
    if (!isReactJsx) return '';
    return rawCode
      // Replace import React, { ... } from 'react';
      .replace(/import\s+React\s*,\s*\{([^}]+)\}\s+from\s+['"][^'"]+['"];?/g, 'const { $1 } = React;')
      .replace(/import\s+\{([^}]+)\}\s+from\s+['"][^'"]+['"];?/g, 'const { $1 } = React;')
      .replace(/import\s+React\s+from\s+['"][^'"]+['"];?/g, '')
      .replace(/import\s+[^;]+;?/g, '')
      // Replace export default function / export default
      .replace(/export\s+default\s+function\s*([a-zA-Z0-9_]*)/g, 'function $1')
      .replace(/export\s+default\s+[a-zA-Z0-9_]+;?/g, '')
      .replace(/export\s+\{[^}]+\};?/g, '')
      .replace(/export\s+(const|let|var|function|class)/g, '$1');
  }, [rawCode, isReactJsx]);

  // Inspect mode injection script
  const inspectInjectionScript = useMemo(() => {
    if (!isInspectMode) return '';
    return `
      <script>
      (function() {
        var overlayId = '__devnexes_inspect_overlay';
        var badgeId = '__devnexes_inspect_badge';
        var overlay = document.getElementById(overlayId);
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.id = overlayId;
          overlay.style.position = 'fixed';
          overlay.style.pointerEvents = 'none';
          overlay.style.zIndex = '9999999';
          overlay.style.border = '2px solid #0066FF';
          overlay.style.backgroundColor = 'rgba(0, 102, 255, 0.08)';
          overlay.style.transition = 'all 0.08s cubic-bezier(0, 0, 0.2, 1)';
          overlay.style.display = 'none';
          overlay.style.borderRadius = '4px';
          document.body.appendChild(overlay);

          var badge = document.createElement('div');
          badge.id = badgeId;
          badge.style.position = 'absolute';
          badge.style.top = '-26px';
          badge.style.left = '0';
          badge.style.background = '#0066FF';
          badge.style.color = '#ffffff';
          badge.style.fontFamily = 'monospace';
          badge.style.fontSize = '11px';
          badge.style.fontWeight = '600';
          badge.style.padding = '2px 8px';
          badge.style.borderRadius = '3px';
          badge.style.whiteSpace = 'nowrap';
          badge.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
          badge.style.pointerEvents = 'none';
          overlay.appendChild(badge);
        }

        document.addEventListener('mouseover', function(e) {
          if (!e.target || e.target === overlay || e.target.id === badgeId || e.target === document.body || e.target === document.documentElement) return;
          var target = e.target;
          var rect = target.getBoundingClientRect();
          overlay.style.display = 'block';
          overlay.style.top = rect.top + 'px';
          overlay.style.left = rect.left + 'px';
          overlay.style.width = rect.width + 'px';
          overlay.style.height = rect.height + 'px';

          var tag = target.tagName.toLowerCase();
          var idStr = target.id ? '#' + target.id : '';
          var classStr = target.className && typeof target.className === 'string'
            ? '.' + target.className.trim().split(/\\s+/).slice(0, 2).join('.')
            : '';
          var badgeEl = document.getElementById(badgeId);
          if (badgeEl) {
            badgeEl.textContent = '<' + tag + idStr + classStr + '>';
            if (rect.top < 30) {
              badgeEl.style.top = '4px';
            } else {
              badgeEl.style.top = '-26px';
            }
          }
        }, true);

        document.addEventListener('mouseout', function(e) {
          if (e.relatedTarget === null) {
            overlay.style.display = 'none';
          }
        }, true);

        document.addEventListener('click', function(e) {
          if (!e.target || e.target === overlay) return;
          e.preventDefault();
          e.stopPropagation();

          var target = e.target;
          var rect = target.getBoundingClientRect();
          var tag = target.tagName.toLowerCase();
          var idStr = target.id ? '#' + target.id : '';
          var classStr = target.className && typeof target.className === 'string'
            ? '.' + target.className.trim().split(/\\s+/).slice(0, 3).join('.')
            : '';

          var clone = target.cloneNode(true);
          var snippet = clone.outerHTML || '';
          if (snippet.length > 400) {
            snippet = snippet.substring(0, 400) + '...';
          }

          var textSnippet = (target.innerText || target.textContent || '').trim().slice(0, 80);

          window.parent.postMessage({
            type: 'DEVNEXES_INSPECT_SELECT',
            tagName: tag,
            selector: tag + idStr + classStr,
            htmlSnippet: snippet,
            textSnippet: textSnippet,
            rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
          }, '*');
        }, true);
      })();
      </script>
    `;
  }, [isInspectMode]);

  // Construct final executable HTML content for iframe
  const executableHtml = useMemo(() => {
    if (!rawCode) {
      return `
        <!DOCTYPE html>
        <html>
        <body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#94a3b8;background:#f8fafc;">
          <div style="text-align:center;">
            <p style="font-size:14px;font-weight:500;">No live code preview available yet</p>
          </div>
        </body>
        </html>
      `;
    }

    if (isReactJsx) {
      // Full React 18 sandbox template with Babel Standalone & Tailwind CDN
      return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title || 'Devnexes React Sandbox'}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
          <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
          <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
          <script src="https://unpkg.com/lucide@latest"></script>
          <style>
            body { margin: 0; padding: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            ${isInspectMode ? ' * { cursor: crosshair !important; } ' : ''}
          </style>
        </head>
        <body class="bg-white text-slate-900 min-h-screen">
          <div id="root"></div>
          <script type="text/babel">
            try {
              ${preparedReactCode}

              // Auto detect and mount component
              const ComponentToRender = 
                typeof App !== 'undefined' ? App :
                typeof Main !== 'undefined' ? Main :
                typeof Component !== 'undefined' ? Component :
                typeof Dashboard !== 'undefined' ? Dashboard :
                typeof Portfolio !== 'undefined' ? Portfolio : null;

              if (ComponentToRender) {
                const root = ReactDOM.createRoot(document.getElementById('root'));
                root.render(React.createElement(ComponentToRender));
                setTimeout(function() {
                  if (window.lucide) window.lucide.createIcons();
                }, 100);
              } else {
                document.getElementById('root').innerHTML = '<div style="padding:24px;font-family:sans-serif;color:#64748b;text-align:center;">React code executed successfully. Ensure main component is named App.</div>';
              }
            } catch (err) {
              document.getElementById('root').innerHTML = '<div style="margin:20px;padding:16px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;font-family:monospace;color:#991b1b;font-size:12px;"><strong>React Runtime Error:</strong><br/>' + err.message + '</div>';
            }
          </script>
          ${inspectInjectionScript}
        </body>
        </html>
      `;
    }

    // Standard HTML Document
    let htmlContent = rawCode;

    // Inject Tailwind CDN if not already in document
    if (!htmlContent.includes('cdn.tailwindcss.com') && /class(Name)?=["'][^"']*(flex|grid|p-|m-|text-|bg-|rounded|border)/i.test(htmlContent)) {
      if (htmlContent.includes('<head>')) {
        htmlContent = htmlContent.replace('<head>', '<head>\n  <script src="https://cdn.tailwindcss.com"></script>');
      } else if (htmlContent.includes('<html>')) {
        htmlContent = htmlContent.replace('<html>', '<html><head><script src="https://cdn.tailwindcss.com"></script></head>');
      } else {
        htmlContent = `<script src="https://cdn.tailwindcss.com"></script>\n` + htmlContent;
      }
    }

    // Inject Lucide icons if tags exist
    if (htmlContent.includes('data-lucide') && !htmlContent.includes('unpkg.com/lucide')) {
      const lucideScript = `<script src="https://unpkg.com/lucide@latest"></script><script>setTimeout(function(){ if(window.lucide) window.lucide.createIcons(); }, 100);</script>`;
      if (htmlContent.includes('</body>')) {
        htmlContent = htmlContent.replace('</body>', `${lucideScript}\n</body>`);
      } else {
        htmlContent += lucideScript;
      }
    }

    // Inject Inspect script if Inspect Mode is enabled
    if (isInspectMode) {
      if (htmlContent.includes('</body>')) {
        htmlContent = htmlContent.replace('</body>', `${inspectInjectionScript}\n</body>`);
      } else {
        htmlContent += inspectInjectionScript;
      }
    }

    return htmlContent;
  }, [rawCode, isReactJsx, preparedReactCode, isInspectMode, inspectInjectionScript, title]);

  // Listen for inspect selection postMessage from inside iframe
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'DEVNEXES_INSPECT_SELECT') {
        setSelectedElement({
          tagName: event.data.tagName,
          selector: event.data.selector,
          htmlSnippet: event.data.htmlSnippet,
          textSnippet: event.data.textSnippet
        });
        setSubmitSuccess(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Handle submit inspect prompt to AI
  const handleApplyInspectEdit = async (customPrompt) => {
    const promptText = (customPrompt || inspectPrompt).trim();
    if (!promptText || !selectedElement || !onSendMessage) return;

    setIsSubmitting(true);
    try {
      const formattedInstruction = `Canvas code me is specific element ko update karo:\n` +
        `Target Element: <${selectedElement.selector}>\n` +
        `Current Snippet: ${selectedElement.htmlSnippet}\n` +
        `User Requested Change: ${promptText}\n\n` +
        `Keep all existing structure, sections, and style intact and apply the changes precisely to this component.`;

      await onSendMessage(formattedInstruction);
      setSubmitSuccess(true);
      setInspectPrompt('');
      setTimeout(() => {
        setSelectedElement(null);
        setSubmitSuccess(false);
      }, 2500);
    } catch (err) {
      console.error('Failed to submit inspect instruction', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickChips = [
    { label: 'Gradient Color', prompt: 'Is element par vibrant modern gradient background aur text color set karo' },
    { label: 'Add Hover Glow', prompt: 'Is element par smooth hover scale (scale-105) aur colored glow shadow add karo' },
    { label: 'Rounded Corners', prompt: 'Is element ki border radius rounded-2xl aur subtle border outline do' },
    { label: 'Increase Size', prompt: 'Is element ki padding aur font size thora barhao' },
    { label: 'Dark Card Style', prompt: 'Is element ko sleek dark glassmorphism card style (backdrop-blur, border) do' }
  ];

  return (
    <div className="flex-1 w-full h-full flex flex-col bg-[#f1f5f9] dark:bg-[#07090e] overflow-hidden select-none relative font-sans">
      
      {/* ── Top Preview Toolbar ─────────────────────────────────────── */}
      <div className="h-10 px-3 bg-white dark:bg-[#0c101b] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 shadow-2xs z-20">
        
        {/* Left: Responsive Device Switcher */}
        <div className="flex items-center space-x-1">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setScreenMode('desktop')}
              className={`flex items-center space-x-1.5 px-2 py-1 rounded-md transition-all cursor-pointer ${
                screenMode === 'desktop'
                  ? 'bg-white dark:bg-slate-900 text-[#0066FF] dark:text-blue-400 font-semibold shadow-2xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Desktop View (100% Full Width)"
            >
              <Monitor size={13} />
              <span className="hidden sm:inline text-[11px]">Desktop</span>
            </button>

            <button
              onClick={() => setScreenMode('tablet')}
              className={`flex items-center space-x-1.5 px-2 py-1 rounded-md transition-all cursor-pointer ${
                screenMode === 'tablet'
                  ? 'bg-white dark:bg-slate-900 text-[#0066FF] dark:text-blue-400 font-semibold shadow-2xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Tablet View (768px Width)"
            >
              <Tablet size={13} />
              <span className="hidden sm:inline text-[11px]">Tablet</span>
            </button>

            <button
              onClick={() => setScreenMode('mobile')}
              className={`flex items-center space-x-1.5 px-2 py-1 rounded-md transition-all cursor-pointer ${
                screenMode === 'mobile'
                  ? 'bg-white dark:bg-slate-900 text-[#0066FF] dark:text-blue-400 font-semibold shadow-2xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Mobile View (375px Width)"
            >
              <Smartphone size={13} />
              <span className="hidden sm:inline text-[11px]">Mobile</span>
            </button>
          </div>

          {/* Dimension Tag */}
          <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 hidden md:inline ml-1.5">
            {screenMode === 'desktop' ? '100% Fluid' : screenMode === 'tablet' ? '768 × 1024' : '375 × 667'}
          </span>
        </div>

        {/* Center/Right: Visual Element Inspector & Refresh Controls */}
        <div className="flex items-center space-x-1.5">
          
          {/* Visual Element Inspector Toggle */}
          <button
            onClick={() => {
              setIsInspectMode(prev => !prev);
              if (isInspectMode) setSelectedElement(null);
            }}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
              isInspectMode
                ? 'bg-blue-50 dark:bg-blue-950/80 border-[#0066FF] text-[#0066FF] dark:text-blue-400 shadow-2xs'
                : 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
            title="Inspect & Click to Edit Element (v0 / Lovable style)"
          >
            <MousePointerClick size={13} className={isInspectMode ? 'animate-bounce' : ''} />
            <span className="text-[11px] font-semibold">
              {isInspectMode ? 'Inspecting...' : 'Inspect'}
            </span>
          </button>

          {/* Refresh Frame Button */}
          <button
            onClick={() => setReloadKey(prev => prev + 1)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Refresh Live Preview"
          >
            <RefreshCw size={13} />
          </button>

          {/* Fullscreen Button */}
          {onOpenFullscreen && (
            <button
              onClick={onOpenFullscreen}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Fullscreen Preview"
            >
              <Maximize2 size={13} />
            </button>
          )}

        </div>

      </div>

      {/* ── Main Preview Canvas Area ─────────────────────────────────── */}
      <div className={`flex-1 w-full h-full overflow-hidden flex items-center justify-center relative ${
        screenMode !== 'desktop' ? 'p-3 sm:p-5 bg-slate-900/10 dark:bg-black/40' : ''
      }`}>
        
        {/* Device Frame Wrapper */}
        <div 
          className={`h-full transition-all duration-300 flex flex-col overflow-hidden ${
            screenMode === 'desktop'
              ? 'w-full bg-white dark:bg-slate-950'
              : screenMode === 'tablet'
                ? 'w-[768px] max-w-full rounded-2xl shadow-2xl border-4 border-slate-700/60 dark:border-slate-700 bg-white dark:bg-slate-950'
                : 'w-[375px] max-w-full rounded-3xl shadow-2xl border-6 border-slate-800 dark:border-slate-700 bg-white dark:bg-slate-950'
          }`}
        >
          {/* Simulated Mobile Notch / Header Bar */}
          {screenMode === 'mobile' && (
            <div className="h-5 bg-slate-900 text-white flex items-center justify-between px-4 text-[9px] font-mono shrink-0 select-none">
              <span>9:41</span>
              <div className="w-12 h-2.5 bg-black rounded-full" />
              <div className="flex items-center space-x-1">
                <span>5G</span>
                <span>100%</span>
              </div>
            </div>
          )}

          {/* Simulated Tablet Header Bar */}
          {screenMode === 'tablet' && (
            <div className="h-3 bg-slate-800 flex items-center justify-center shrink-0">
              <div className="w-1.5 h-1.5 bg-slate-600 rounded-full" />
            </div>
          )}

          {/* Live Iframe */}
          <iframe
            key={reloadKey}
            ref={iframeRef}
            srcDoc={executableHtml}
            title={title || 'Canvas Live Preview'}
            sandbox="allow-scripts allow-modals allow-forms allow-same-origin"
            className="w-full flex-1 border-0 bg-white"
          />

          {/* Simulated Mobile Home Bar */}
          {screenMode === 'mobile' && (
            <div className="h-3.5 bg-white dark:bg-slate-900 flex items-center justify-center shrink-0">
              <div className="w-24 h-1 bg-slate-300 dark:bg-slate-600 rounded-full" />
            </div>
          )}
        </div>

      </div>

      {/* ── Visual Element Inspector Prompt Card (v0 / Lovable style) ── */}
      {selectedElement && (
        <div className="absolute inset-x-3 bottom-3 sm:inset-x-6 sm:bottom-5 z-40 bg-white/95 dark:bg-[#0f1422]/95 backdrop-blur-md border border-blue-500/40 dark:border-blue-500/50 rounded-2xl shadow-2xl p-3.5 sm:p-4 animate-slide-up font-sans">
          
          {/* Header Row */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center space-x-2 truncate">
              <span className="p-1 rounded-md bg-blue-50 dark:bg-blue-950/80 text-[#0066FF] dark:text-blue-400">
                <MousePointerClick size={14} />
              </span>
              <div className="truncate">
                <div className="flex items-center space-x-1.5">
                  <span className="text-[12px] font-bold text-slate-800 dark:text-slate-100">
                    Selected Element:
                  </span>
                  <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-blue-100/70 dark:bg-blue-900/40 text-[#0066FF] dark:text-blue-300 font-semibold truncate max-w-[200px] sm:max-w-[320px]">
                    &lt;{selectedElement.selector}&gt;
                  </span>
                </div>
                {selectedElement.textSnippet && (
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate max-w-sm">
                    "{selectedElement.textSnippet}"
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={() => setSelectedElement(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          {/* Quick Suggestion Chips */}
          <div className="flex items-center space-x-1.5 overflow-x-auto py-1 mb-2.5 custom-scrollbar">
            {quickChips.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setInspectPrompt(chip.prompt)}
                className="shrink-0 text-[10.5px] px-2 py-0.5 rounded-full bg-slate-100 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-blue-950/60 text-slate-700 dark:text-slate-300 hover:text-[#0066FF] dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer font-medium"
              >
                + {chip.label}
              </button>
            ))}
          </div>

          {/* Input Row */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleApplyInspectEdit();
            }}
            className="flex items-center space-x-2"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={inspectPrompt}
                onChange={(e) => setInspectPrompt(e.target.value)}
                placeholder="What change would you like? (e.g., make color blue gradient, add hover effect)..."
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-[#07090e] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#0066FF] focus:border-transparent transition-all"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={!inspectPrompt.trim() || isSubmitting}
              className="px-3 py-2 rounded-xl bg-[#0066FF] hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={12} className="animate-spin" />
                  <span>Applying...</span>
                </>
              ) : submitSuccess ? (
                <>
                  <Check size={12} className="text-white" />
                  <span>Sent!</span>
                </>
              ) : (
                <>
                  <Sparkles size={12} />
                  <span>Update with AI</span>
                </>
              )}
            </button>
          </form>

        </div>
      )}

    </div>
  );
}
