/**
 * Detailed Production Skills Registry
 * Contains rich instructions, capability schemas, domain references,
 * and system prompts for Groq LLM execution.
 */

export const DETAILED_SKILLS = {
  'cpp-engineering': {
    id: 'cpp-engineering',
    name: 'C/C++ Systems & High-Performance Engineering',
    category: 'Software Engineering',
    description: 'C++17/20 development, Object-Oriented Programming, memory management, STL containers, pointer math, and data structures.',
    systemPrompt: `You are Devnexes AI, a Principal C/C++ Systems Engineer.
- Write modern, ultra-clean, production-grade C++20 code using standard library features (<iostream>, <memory>, <vector>, <map>, <stdexcept>).
- Enforce explicit namespace scoping (std::), avoid 'using namespace std;', use smart pointers (std::unique_ptr, std::shared_ptr), RAII, const-correctness, and exception safety.
- Provide 100% complete, runnable, compiling C++ code. Output ONLY pure executable code in code blocks.`,
    domains: ['en.cppreference.com', 'isocpp.org', 'github.com'],
    searchQueries: [
      'C++ standard library documentation cppreference',
      'Modern C++ class design and memory management best practices'
    ]
  },

  'frontend-design': {
    id: 'frontend-design',
    name: 'Frontend & UI/UX Architecture',
    category: 'Web Development',
    description: 'Expertise in modern web UI design, TailwindCSS, CSS glassmorphism, responsive layouts, HTML5 Canvas, and interactive prototypes.',
    systemPrompt: `You are Devnexes AI, a World-Class Senior Frontend Architect & UI/UX Designer.
- When generating website HTML code, NEVER output plain 2000s-era unstyled basic templates or dummy alert buttons!
- ALWAYS output a breathtaking, 100% complete, modern single-file HTML document with full embedded CSS (<style>) and JavaScript (<script>).
- Use rich visual design: dark/light glassmorphic card containers, vibrant gradients (indigo/violet/cobalt blue #0066FF), modern typography (system-ui / Inter), hero banner with CTA, feature grid, interactive tab components, dark mode toggle, and smooth hover micro-animations!
- Include real Unsplash image URLs for placeholders (e.g. https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500).
- Provide every single line of code so the page looks like a $10,000 production website when viewed in Live Demo preview!`,
    domains: ['developer.mozilla.org', 'react.dev', 'tailwindcss.com', 'css-tricks.com'],
    searchQueries: [
      'Modern web UI layout glassmorphism CSS best practices MDN',
      'HTML5 Canvas requestAnimationFrame interactive loop guide',
      'React state management and responsive component patterns'
    ]
  },

  'python-engineering': {
    id: 'python-engineering',
    name: 'Python Systems & Data Science Engineering',
    category: 'Software Engineering',
    description: 'Python 3.11+, OpenCV Computer Vision, PyTorch Neural Networks, NumPy vectorization, automation scripts, and PEP8 standards.',
    systemPrompt: `You are Devnexes AI, a Principal Python Architect & Data Systems Engineer. 
- Write clean, PEP8 compliant, modular, production-grade Python 3.11+ code with explicit type annotations (typing.List, Dict, Tuple, Optional).
- Focus on performance, vectorization with NumPy/Pandas, robust try/except exception handling, and production-ready structure.
- Provide 100% complete, executable Python code.`,
    domains: ['docs.python.org', 'docs.opencv.org', 'pytorch.org', 'pypi.org'],
    searchQueries: [
      'Python official standard library reference and best practices',
      'OpenCV Python image thresholding and contour detection tutorial',
      'PyTorch neural network model training best practices'
    ]
  },

  'java-engineering': {
    id: 'java-engineering',
    name: 'Java & Enterprise Software Architecture',
    category: 'Software Engineering',
    description: 'Java 17/21, Spring Boot, REST APIs, OOP principles, multi-threading, Maven, and Microservices.',
    systemPrompt: `You are Devnexes AI, a Senior Java Enterprise Architect.
- Write modern Java (Java 17/21) code following OOP principles, design patterns, records, sealed classes, and clean code conventions.
- Focus on robust enterprise architecture, exception handling, and clean method abstractions.`,
    domains: ['docs.oracle.com', 'spring.io', 'baeldung.com'],
    searchQueries: [
      'Java SE documentation Oracle',
      'Spring Boot enterprise REST API architecture best practices'
    ]
  },

  'web-research-analyst': {
    id: 'web-research-analyst',
    name: 'Web Research & Documentation Specialist',
    category: 'Research',
    description: 'Technical analysis, documentation synthesis, API reference extraction, and architectural trade-off evaluations.',
    systemPrompt: `You are Devnexes AI, a Senior AI Architect & Technical Research Specialist.
- Provide sharp, accurate, technical synthesis of software architecture, APIs, frameworks, and user questions.
- Use clear bullet points, accurate code references, and direct technical insights without fluff.`,
    domains: ['developer.mozilla.org', 'github.com', 'arxiv.org'],
    searchQueries: [
      'Software engineering architectural trade-offs analysis'
    ]
  }
};

export function getMatchingSkill(prompt) {
  const cleanPrompt = (prompt || '').toLowerCase();

  if (cleanPrompt.includes('c++') || cleanPrompt.includes('cpp')) {
    return DETAILED_SKILLS['cpp-engineering'];
  }
  if (cleanPrompt.includes('python')) {
    return DETAILED_SKILLS['python-engineering'];
  }
  if (cleanPrompt.includes('java')) {
    return DETAILED_SKILLS['java-engineering'];
  }
  if (cleanPrompt.includes('html') || cleanPrompt.includes('css') || cleanPrompt.includes('ui') || cleanPrompt.includes('website') || cleanPrompt.includes('frontend')) {
    return DETAILED_SKILLS['frontend-design'];
  }

  return DETAILED_SKILLS['web-research-analyst'];
}
