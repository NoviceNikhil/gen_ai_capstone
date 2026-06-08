# Schedully Chatbot Implementation

This document details the exact technical implementation, state machine routing, intent classification, verification checks, and generation pipeline used in Schedully's AI Chatbot.

---

## 1. Intent Classification & Query Decomposition (`planner.py`)
When a user submits a message, it is analyzed by a custom planning agent to determine intent.

### Intent Classes
- `knowledge_base` (general how-tos, platform instructions, navigation, small talk).
- `live_data` (requires querying live platform databases or services).
- `document_qa` (queries about uploaded/ingested documents).
- `compound` (requires a mix of uploaded document contents and live database records).
- `needs_clarification` (triggers a clarifying question prompt).
- `out_of_scope` (refuses tasks unrelated to Schedex, such as generic coding, math, recipes, or science).

### Classifier Mechanics
- **Primary Method**: Groq API using the `llama-3.1-8b-instant` model. The prompt instructs the model to return a structured JSON response identifying the intent, sub-queries (split searches), and tool hints (e.g., `get_appointments`, `get_providers`).
- **Caching Layer**: Queries are normalized and cached locally (hash map of query to plan) with a **5-minute Time-To-Live (TTL)** to minimize latency and API costs.
- **Pruning & Role Filtering**: If the user is a client (customer), any administrative or provider-only tool hints (e.g., dashboard, setting availability) are automatically filtered out before routing.
- **Fallback Keyword Engine**: If the Groq API fails or is rate-limited, the system falls back to a regex-based keyword parser (`_keyword_plan`) matching specific pattern boundaries (e.g., `"upcoming" + "appointment"`, `"my ratings"`, `"recipes"`, `"binary search"`).
- **Prompt Injection Guard**: Scans incoming text against known injection patterns (e.g., `"ignore previous instructions"`, `"reveal system prompt"`) and immediately short-circuits to a canned refusal message.

---

## 2. Orchestration & Flow Routing (`orchestrator.py`)
The orchestrator drives the lifecycle of a chat turn from query input to final response generation.

```
                  ┌────────────────────────┐
                  │   User Message Input   │
                  └───────────┬────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
    [Conversational Match]            [Fast Path Match]
   - Hello / Bye / Thanks            - "upcoming appointments"
   - Returns canned response         - "dentists in Hyderabad"
              │                               │
              │ (Bypasses LLM)                │ (Bypasses LLM)
              ▼                               ▼
     ┌─────────────────┐             ┌─────────────────┐
     │ Canned Response │             │ Executed Plan   │
     └─────────────────┘             └────────┬────────┘
                                              │
         ┌────────────────────────────────────┴────────────────────────────────────┐
         ▼                                    ▼                                    ▼
  [Intent: KB/Document]             [Intent: Live Data]                   [Intent: Compound]
         │                                    │                                    │
         ▼                                    ▼                                    ▼
   Widen Retrieval                      Invoke Tool Layers                   Perform Both Parallel
  (BM25 & FAISS search)                (Async GET endpoints)                 (Hybrid context list)
         │                                    │                                    │
         └────────────────────────────────────┼────────────────────────────────────┘
                                              │
                                              ▼
                                   ┌──────────────────────┐
                                   │ Context Verification │
                                   └──────────┬───────────┘
                                              │
                                    [Score >= 0.5?]
                                     /            \
                                  Yes              No
                                  /                  \
                                 ▼                    ▼
                           [Generation]         [Repair Loop]
                       - Inject Context Chunks  - top_k += 4 (up to 2 times)
                       - Call Groq Llama-3.1    - Re-retrieve and check
```

### Conversational Short-Circuiting
Before hitting the planner, the message is checked against common conversational phrases (greetings, identity inquiries, thanks, goodbyes). If matched, it returns a canned response instantly to save computational resources.

### Fast-Path Query Mapping
Common high-frequency queries are parsed using fast-path hardcoded rules to bypass LLM planning latency:
- `"upcoming appointments"` or `"my appointments"` $\rightarrow$ `get_appointments`
- `"dentist in Hyderabad"` $\rightarrow$ `get_providers` with location `"Hyderabad"` and query `"dentist"`
- `"cardiologist in Mumbai"` $\rightarrow$ `get_providers` with location `"Mumbai"` and query `"cardiologist"`

### Mode Switching
Depending on the client view mode:
- **Normal Mode**: Maps `document_qa` inputs to generic `knowledge_base` indices, and `compound` queries to `live_data` tools.
- **RAG Mode**: Forces `live_data` queries to `knowledge_base` retrieval, and `compound` queries to `document_qa` chunks.

---

## 3. Tool Execution Layer (`tool_layer.py`)
Retrieves live database information via async HTTP requests using the user's active JSON Web Token (JWT).

### Integrated Platform Endpoints
- **Appointments**: `GET /api/provider/appointments` or `/api/customer/appointments` (filters by status and parses date offsets like `"today"`, `"tomorrow"`, `"next week"`).
- **Providers**: `GET /api/customer/providers` (filters by location and category ID).
- **Slots**: `GET /api/customer/providers/{provider_id}/slots` or `/api/provider/slots` (queries availability dates).
- **Profile / Reviews**: `GET /api/provider/profile` and `GET /api/provider/reviews`.

### Data Pre-Processing & Security
- **PII Scrubbing**: Sanitizes sensitive fields (`email`, `phone`, `cvv`, `password`, payment tokens) from raw API responses before feeding them to the generation prompt.
- **Payload Pruning**: Truncates list responses (e.g., limits appointments to 15, reviews to 5) to fit within LLM input window tokens.

---

## 4. Grounding Verification (`verifier.py`)
Scores context relevance before generation. If the combined score is **< 0.5**, it is marked as `"weak"`, which triggers the orchestrator to expand retrieval parameters (`top_k += 4`) and recheck the context.

### Score Metrics
1. **Grounding Check**: Measures word token overlap (Jaccard similarity index) between the user's query and retrieved context chunks. Returns `1.0` if $\ge 2$ strong matches are found, `0.6` if 1 matches, `0.4` if low overlap but context exists, and `0.0` if empty.
2. **Contradiction Check**: Scans for negation conflicts (such as `"not"`, `"never"`, `"cannot"`) occurring within adjacent context chunks. Drops score to `0.3` if contradictions are suspected.
3. **Coverage Check**: Checks whether the highest Jaccard overlap between the query and any single context block is $\ge 0.15$ (`1.0`), $\ge 0.08$ (`0.6`), or below (`0.2`). Live tool results are given an automatic `1.0` rating.
- **Weight Allocation**: $\text{Combined\_Score} = (G \times 0.4) + (C \times 0.3) + (\text{Cov} \times 0.3)$.

---

## 5. Answer Generation (`generator.py`)
Generates the final response based on the compiled facts.

- **Groq LLM**: `llama-3.1-8b-instant` configured with a temperature of `0.2`.
- **Formatting Constraints**: Responses must display source citations (`[Source 1]`, `[Source 2]`) for KB/RAG queries.
- **Hard Metric Constraints**: If a provider queries their rating summaries, the response must display all of the following 4 metrics:
  1. Average Rating
  2. Total Reviews
  3. Highest Rating
  4. Lowest Rating
- **Offline Direct Renderer**: If the Groq API is unavailable, the system runs a headless rendering engine. It converts JSON database envelopes into formatted markdown bullet lists directly, ensuring the chatbot remains operational.
