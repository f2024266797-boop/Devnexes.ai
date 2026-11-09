# Devnexes AI: Production Setup

## Dual-Engine Architecture

Devnexes AI runs a high-performance dual-engine setup:

1. **Groq Cloud (Llama 3.3 70B & 8B)**:
   - Handles all text generation, fast conversation, autonomous DAG planning, analysis, terminal/CMD commands, and final synthesis.
   - Built-in **3-Key Automatic Failover**: If Key #1 hits rate limits (HTTP 429) or token limits, the engine rotates immediately to Key #2 and Key #3.

2. **Google Gemini (Gemini 2.5 Flash / 2.0 Flash)**:
   - Dedicated exclusively to **100% of Code Generation**, Interactive HTML/CSS/JS Canvas, and multi-language artifacts (C++, Python, Java, SQL, etc.).
   - Built-in **3-Key Automatic Failover**: Automatically rotates across 3 Gemini keys when token quotas or rate limits are reached.

---

## Configuration

You can provide keys in `.env` or paste them directly in the UI via **Settings → API Keys**:

### In `.env`:
```env
# Groq Keys (Text & Planning)
GROQ_API_KEY_1=gsk_...
GROQ_API_KEY_2=gsk_...
GROQ_API_KEY_3=gsk_...
GROQ_MODEL=llama-3.3-70b-versatile

# Gemini Keys (Code Generation)
GEMINI_API_KEY_1=AIzaSy_...
GEMINI_API_KEY_2=AIzaSy_...
GEMINI_API_KEY_3=AIzaSy_...
GEMINI_MODEL=gemini-2.5-flash

# Tavily Real-Time Web Search
TAVILY_API_KEY=tvly-...
```

---

## Runtime Behavior & Resilience

- **Failover & Cooldown**: When any key encounters an HTTP 429 or quota limit, it enters a temporary cooldown while the next available key immediately picks up the request.
- **Concurrent DAG Execution**: Independent nodes execute in parallel; sequential dependencies remain ordered.
- **UI Animation Frames**: Output updates are coalesced to single paint frames using `requestAnimationFrame`, preventing UI lag during high-frequency token generation.
