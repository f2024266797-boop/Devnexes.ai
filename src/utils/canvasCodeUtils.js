/**
 * Devnexes AI - Canvas Code Utilities & Sandbox Templates
 * Multi-file code splitter (HTML / CSS / JS tabs) and curated sandbox templates.
 */

/**
 * Split unified HTML document into separate virtual tabs:
 * 1. index.html (Markup only)
 * 2. style.css (Extracted styles)
 * 3. script.js (Extracted inline scripts)
 */
export function splitUnifiedCode(rawCode = '', language = 'html') {
  const clean = (rawCode || '').trim();
  const lang = (language || '').toLowerCase();

  // If not HTML or doesn't have HTML tags, return as single file
  if (!clean || (lang !== 'html' && lang !== 'htm' && !clean.includes('<html') && !clean.includes('<!DOCTYPE'))) {
    return {
      hasTabs: false,
      all: clean,
      html: clean,
      css: '',
      js: ''
    };
  }

  // Extract <style>...</style> content
  const styleMatches = [];
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let sMatch;
  while ((sMatch = styleRegex.exec(clean)) !== null) {
    if (sMatch[1] && sMatch[1].trim()) {
      styleMatches.push(sMatch[1].trim());
    }
  }
  const extractedCss = styleMatches.join('\n\n/* ── Next Style Block ── */\n\n');

  // Extract <script>...</script> content (excluding external src scripts)
  const scriptMatches = [];
  const scriptRegex = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let jMatch;
  while ((jMatch = scriptRegex.exec(clean)) !== null) {
    if (jMatch[1] && jMatch[1].trim()) {
      scriptMatches.push(jMatch[1].trim());
    }
  }
  const extractedJs = scriptMatches.join('\n\n// ── Next Script Block ──\n\n');

  // Extract clean HTML by replacing inline style and script blocks with linked comments
  let cleanHtml = clean
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '<!-- Styles separated in style.css -->')
    .replace(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi, '<!-- Scripts separated in script.js -->');

  return {
    hasTabs: true,
    all: clean,
    html: cleanHtml.trim(),
    css: extractedCss.trim(),
    js: extractedJs.trim()
  };
}

/**
 * Curated Sandbox Starter Templates
 */
export const SANDBOX_TEMPLATES = [
  {
    id: 'portfolio-tailwind',
    title: 'Modern Portfolio & Hero',
    category: 'Landing Page',
    language: 'html',
    description: 'Clean responsive developer portfolio with animated gradient hero, skill badges, and contact form.',
    code: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Alex Rivera — Creative Engineer</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
    }
    .animate-float { animation: float 4s ease-in-out infinite; }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 font-sans min-h-screen selection:bg-blue-600 selection:text-white">

  <!-- Navigation -->
  <nav class="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between border-b border-slate-800/80">
    <div class="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
      alex.dev
    </div>
    <div class="flex items-center space-x-6 text-sm font-medium text-slate-400">
      <a href="#about" class="hover:text-white transition-colors">About</a>
      <a href="#projects" class="hover:text-white transition-colors">Projects</a>
      <a href="#contact" class="px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all shadow-lg shadow-blue-500/25">Hire Me</a>
    </div>
  </nav>

  <!-- Hero Section -->
  <section class="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
    <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-950/70 border border-blue-800/60 text-blue-400 text-xs font-medium mb-6">
      <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
      Available for Q4 contracts & projects
    </div>
    <h1 class="text-5xl sm:text-7xl font-extrabold tracking-tight mb-6">
      Crafting Next-Gen <br/>
      <span class="bg-gradient-to-r from-blue-400 via-indigo-300 to-teal-300 bg-clip-text text-transparent">
        Web & AI Applications
      </span>
    </h1>
    <p class="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
      Full-stack engineer specializing in high-performance React architectures, agentic pipelines, and fluid human-grade interfaces.
    </p>
    <div class="flex items-center justify-center gap-4">
      <button class="px-7 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all transform hover:-translate-y-0.5 shadow-xl shadow-blue-600/30">
        View Work
      </button>
      <button class="px-7 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 font-semibold transition-all">
        Read Tech Notes
      </button>
    </div>
  </section>

  <!-- Featured Grid -->
  <section id="projects" class="max-w-6xl mx-auto px-6 py-12">
    <h2 class="text-2xl font-bold mb-8">Selected Projects</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-blue-500/50 transition-all group">
        <span class="text-xs font-mono text-blue-400">01 / PRODUCTION APP</span>
        <h3 class="text-xl font-bold mt-2 mb-2 group-hover:text-blue-400 transition-colors">Devnexes Agentic Studio</h3>
        <p class="text-slate-400 text-sm leading-relaxed mb-4">
          Autonomous multi-model coding studio with live AST rewriting and real-time execution canvas.
        </p>
        <div class="flex gap-2">
          <span class="text-xs px-2.5 py-1 rounded bg-slate-800 text-slate-300">React</span>
          <span class="text-xs px-2.5 py-1 rounded bg-slate-800 text-slate-300">Tailwind</span>
          <span class="text-xs px-2.5 py-1 rounded bg-slate-800 text-slate-300">Groq + Gemini</span>
        </div>
      </div>

      <div class="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-blue-500/50 transition-all group">
        <span class="text-xs font-mono text-indigo-400">02 / EMBEDDED ENGINE</span>
        <h3 class="text-xl font-bold mt-2 mb-2 group-hover:text-indigo-400 transition-colors">SearXNG Dual Search Hub</h3>
        <p class="text-slate-400 text-sm leading-relaxed mb-4">
          Resilient prioritized multi-engine search pipeline with automatic pool failover and source attribution.
        </p>
        <div class="flex gap-2">
          <span class="text-xs px-2.5 py-1 rounded bg-slate-800 text-slate-300">Node.js</span>
          <span class="text-xs px-2.5 py-1 rounded bg-slate-800 text-slate-300">REST API</span>
          <span class="text-xs px-2.5 py-1 rounded bg-slate-800 text-slate-300">Tavily</span>
        </div>
      </div>
    </div>
  </section>

</body>
</html>`
  },
  {
    id: 'react-interactive-tasks',
    title: 'React 18 Task Board',
    category: 'React Component',
    language: 'jsx',
    description: 'Interactive React application with state management, filter pills, animated completion toggle, and progress counter.',
    code: `import React, { useState } from 'react';

export default function App() {
  const [tasks, setTasks] = useState([
    { id: 1, text: 'Deploy SearXNG parallel pipeline', done: true, priority: 'high' },
    { id: 2, text: 'Add Canvas Responsive Switcher', done: true, priority: 'high' },
    { id: 3, text: 'Build Visual Element Inspector', done: false, priority: 'urgent' },
    { id: 4, text: 'Integrate React Babel Sandbox', done: false, priority: 'medium' }
  ]);
  const [filter, setFilter] = useState('all');
  const [inputVal, setInputVal] = useState('');

  const toggleTask = (id) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const addTask = (e) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    setTasks(prev => [
      ...prev,
      { id: Date.now(), text: inputVal.trim(), done: false, priority: 'medium' }
    ]);
    setInputVal('');
  };

  const deleteTask = (id) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const filteredTasks = tasks.filter(t => {
    if (filter === 'active') return !t.done;
    if (filter === 'completed') return t.done;
    return true;
  });

  const completedCount = tasks.filter(t => t.done).length;
  const progressPct = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 flex flex-col items-center font-sans">
      <div className="w-full max-w-lg bg-slate-800/90 border border-slate-700 rounded-3xl p-6 shadow-2xl backdrop-blur-xl">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Project Sprint</h1>
            <p className="text-xs text-slate-400 mt-1">Live React 18 Dynamic State</p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-blue-400">{progressPct}%</span>
            <p className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Completed</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-slate-700/60 rounded-full mb-6 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-500 rounded-full"
            style={{ width: \`\${progressPct}%\` }}
          />
        </div>

        {/* Input */}
        <form onSubmit={addTask} className="flex gap-2 mb-5">
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Add new milestone or task..."
            className="flex-1 bg-slate-900/90 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button
            type="submit"
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl transition-all shadow-md shadow-blue-600/30"
          >
            Add
          </button>
        </form>

        {/* Filter Pills */}
        <div className="flex gap-2 mb-4">
          {['all', 'active', 'completed'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={\`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all \${
                filter === f
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-700/50 text-slate-400 hover:text-slate-200'
              }\`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Task List */}
        <div className="space-y-2">
          {filteredTasks.map(task => (
            <div
              key={task.id}
              onClick={() => toggleTask(task.id)}
              className={\`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer \${
                task.done
                  ? 'bg-slate-900/40 border-slate-800 text-slate-500 line-through'
                  : 'bg-slate-900/80 border-slate-700/80 text-slate-200 hover:border-blue-500/60'
              }\`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={task.done}
                  onChange={() => toggleTask(task.id)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
                />
                <span className="text-sm font-medium">{task.text}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteTask(task.id);
                }}
                className="text-slate-500 hover:text-red-400 text-xs px-2 py-1 rounded transition-colors"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}`
  },
  {
    id: 'pricing-calculator',
    title: 'SaaS Pricing Calculator',
    category: 'Interactive Widget',
    language: 'html',
    description: 'Dynamic interactive pricing calculator with monthly/annual discount switch and user volume slider.',
    code: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dynamic SaaS Pricing</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-white font-sans min-h-screen flex items-center justify-center p-6">

  <div class="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
    
    <div class="text-center mb-8">
      <h2 class="text-3xl font-extrabold tracking-tight mb-2">Flexible Cloud Tier</h2>
      <p class="text-slate-400 text-sm">Scale dynamically with your monthly active users</p>
    </div>

    <!-- Billing Interval Toggle -->
    <div class="flex items-center justify-center gap-3 mb-8">
      <span class="text-xs font-semibold text-slate-300" id="labelMonthly">Monthly</span>
      <button 
        id="billingToggle" 
        class="w-14 h-8 bg-slate-800 rounded-full p-1 relative transition-colors focus:outline-none cursor-pointer"
      >
        <div id="toggleKnob" class="w-6 h-6 bg-blue-500 rounded-full transition-transform"></div>
      </button>
      <div class="flex items-center gap-1.5">
        <span class="text-xs font-semibold text-slate-400" id="labelAnnual">Annually</span>
        <span class="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full">Save 20%</span>
      </div>
    </div>

    <!-- Active Users Slider -->
    <div class="mb-8">
      <div class="flex justify-between items-center mb-3">
        <span class="text-sm text-slate-400 font-medium">Monthly Active Users</span>
        <span id="usersDisplay" class="text-lg font-bold text-blue-400 font-mono">10,000 MAU</span>
      </div>
      <input 
        id="userSlider" 
        type="range" 
        min="1000" 
        max="100000" 
        step="1000" 
        value="10000"
        class="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
      >
    </div>

    <!-- Total Price Card -->
    <div class="p-6 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between mb-8">
      <div>
        <span class="text-xs text-slate-500 uppercase font-mono">Estimated Investment</span>
        <div class="flex items-baseline gap-1 mt-1">
          <span class="text-4xl font-extrabold text-white" id="priceDisplay">$49</span>
          <span class="text-xs text-slate-400" id="periodDisplay">/ month</span>
        </div>
      </div>
      <button class="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-600/30">
        Start Free Trial
      </button>
    </div>

  </div>

  <script>
    let isAnnual = false;
    const slider = document.getElementById('userSlider');
    const usersDisplay = document.getElementById('usersDisplay');
    const priceDisplay = document.getElementById('priceDisplay');
    const periodDisplay = document.getElementById('periodDisplay');
    const toggle = document.getElementById('billingToggle');
    const knob = document.getElementById('toggleKnob');

    function calculatePrice() {
      const users = parseInt(slider.value, 10);
      usersDisplay.textContent = Number(users).toLocaleString() + ' MAU';

      // Base pricing: $29 base + $2 per 1k users
      let baseMonthly = 29 + Math.floor((users - 1000) / 1000) * 2;
      let finalPrice = isAnnual ? Math.round(baseMonthly * 0.8) : baseMonthly;

      priceDisplay.textContent = '$' + finalPrice;
      periodDisplay.textContent = isAnnual ? '/ month (billed yearly)' : '/ month';
    }

    slider.addEventListener('input', calculatePrice);

    toggle.addEventListener('click', () => {
      isAnnual = !isAnnual;
      if (isAnnual) {
        knob.style.transform = 'translateX(24px)';
        toggle.classList.replace('bg-slate-800', 'bg-blue-600/40');
      } else {
        knob.style.transform = 'translateX(0px)';
        toggle.classList.replace('bg-blue-600/40', 'bg-slate-800');
      }
      calculatePrice();
    });

    calculatePrice();
  </script>
</body>
</html>`
  }
];

