# Schedully AI: Chatbot & RAG Architecture

This documentation details the design, engineering principles, and implementation specifics of the Schedully AI system built for **Schedex**. It acts as both a standard conversational assistant (answering scheduling queries, profile specs, and dashboard stats) and a secure tenant-isolated Document Q&A (RAG) system.

---

## 1. High-Level Concepts: Chatbot vs. RAG

At a basic level, the system serves two distinct purposes using a single unified pipeline:

| Feature | The Normal Chatbot (`mode="normal"`) | The Tenant RAG (`mode="rag"`) |
| :--- | :--- | :--- |
| **Primary Goal** | Help users navigate the platform, view their bookings, inspect ratings, and check live business stats. | Answer specific queries using corporate knowledge ingested from tenant-uploaded files (PDFs, Excel sheets, docs). |
| **Data Source** | Live database via platform APIs + global Schedex feature FAQs. | Ingested text chunks from documents associated with a specific `tenant_id`. |
| **Security Scope** | Global platform constraints. Customers can only see their own details; providers see their own profiles. | Strict multi-tenant isolation. Users cannot retrieve or query documents belonging to other tenants. |

---

## 2. Pipeline Execution Flow

Every query sent to the Schedully AI system follows this synchronous phase-based lifecycle:

```
[User Message] 
       │
       ▼
 1. SECURITY   ──► Prompt Injection Guard (Regex filtering)
       │
       ▼
 2. SHORTCUT   ──► Conversational Bypass & Fast-Path matching (Regex & canned lists)
       │
       ▼
 3. PLANNER    ──► Intent Classification (Groq LLM ──[Fallback]──► Keyword Classifier)
       │
       ▼
 4. MODE MAP   ──► Intent adjustment based on mode ("normal" vs "rag")
       │
       ▼
 5. EXECUTION  ──► Dispatch Retrieval & Live API calls in parallel
       │
       ▼
 6. VERIFY     ──► Grounding & Negation Verification ──[Combined Score < 0.5]──► [Widen top_k & REPAIR]
       │                                                                                  │
       ▼                                                                                  ◄┘
 7. GENERATOR  ──► LLM Response formulation ──[Fallback]──► Raw Data Formatting (No-LLM)
       │
       ▼
 8. MEMORY     ──► In-Process Turn Logging + File Persistence (sessions.json)
```

---

## 3. Step-by-Step Technical Implementation

### Step 1: Security (Prompt Injection Guard)
To prevent adversarial jailbreaking and prompt leak instructions, the query is passed through a list of pre-compiled regular expressions in `planner.py` -> `is_prompt_injection()`. 
* **Monitored Patterns**: Phrases matching `ignore previous instructions`, `DAN mode`, `reveal your system prompt`, or `pretend you are`.
* **Action**: If triggered, execution halts immediately and returns a safe, hardcoded refusal message, bypassing the LLM completely.

---

### Step 2: Shortcut Check (Conversational Bypass & Fast Paths)
Not all queries need expensive LLM reasoning:
1. **Conversational Bypass (`_match_conversational`)**: Screens queries against greeting, appreciation, identity, and parting regexes (e.g. `hi`, `thanks`, `who are you`). It returns randomized canned replies and saves turns to memory.
2. **Fast-Path Plan (`_fast_path_plan`)**: Recognizes standard query structures directly. For example, queries containing `"my appointments"` or `"dentist in hyderabad"` are directly mapped to a live data plan bypassing the LLM classifier.

---

### Step 3: Intent Classification & Planning
If a query is not caught by shortcuts, it goes to the **Planner**:
* **Cache Lookup**: Uses a stripped, lowercase representation of the query's first 100 characters as a cache key. Cache values are held in memory with a Time-To-Live (TTL) of **300 seconds (5 minutes)**.
* **LLM Planning**: Calls the Groq API utilizing the `llama-3.1-8b-instant` model. The prompt instructs the model to categorize the query into one of six intents (`knowledge_base`, `live_data`, `document_qa`, `compound`, `needs_clarification`, `out_of_scope`), extract `sub_queries`, highlight API `tool_hints`, and output strictly as a JSON string.
* **Fallback (Keyword Planner)**: If Groq experiences an outage or rate limit (HTTP 429), a local keyword analyzer (`_keyword_plan`) uses pre-compiled regexes (`_LIVE_RE`, `_DOC_RE`, `_OOS_RE`) to generate the plan structure locally.
* **Role Permissions Filter**: In `customer` role contexts, tool hints are stripped of sensitive operations, restricting them only to customer-safe queries (`get_appointments`, `get_providers`, `get_slots`, `get_dashboard`, `get_reviews`).

---

### Step 4: Mode Routing Adaptation
Once the plan is created, its intents are mapped depending on the active `mode`:
* **Normal Mode (`"normal"`)**:
  * `INTENT_DOCUMENT` $\rightarrow$ downgraded to `INTENT_KB` (Global FAQs).
  * `INTENT_COMPOUND` $\rightarrow$ downgraded to `INTENT_LIVE`.
* **RAG Mode (`"rag"`)**:
  * `INTENT_LIVE` $\rightarrow$ upgraded to `INTENT_KB`.
  * `INTENT_COMPOUND` $\rightarrow$ upgraded to `INTENT_DOCUMENT` (Private file chunks).

---

### Step 5: Data Fetching (Retrieval & Tools)
Execution branches run concurrently using `asyncio`:
1. **Hybrid Retrieval**: For KB or Document intents, the system calls `hybrid_retrieve()` in a worker thread. If `"normal"` mode is active, it queries `SHARED_KB_TENANT`. If `"rag"` mode is active, it restricts searches to the caller's specific `tenant_id`. Results are fused and reranked using BM25 and Vector scores (`fuse_and_rerank()`).
2. **Live Tool Layer (`run_tools()`)**: Dispatches async GET queries to Schedex's backend using the caller's own Bearer token:
   * **Route Mapping**:
     * `get_appointments` $\rightarrow$ `GET /api/{role}/appointments` (filters by status and date keywords like "today"/"tomorrow" parsed from the query).
     * `get_providers` $\rightarrow$ `GET /api/{role}/providers` (automatically parses locations, e.g., "in mumbai").
     * `get_slots` $\rightarrow$ Queries provider specific slots.
     * `get_availability` $\rightarrow$ `GET /api/availability` (maps weekdays `0`-`6` to human names like "Monday").
     * `get_profile` $\rightarrow$ `GET /api/provider/profile` (fetches the reviews history in parallel to calculate rating boundaries).
   * **Sanitization**: All API responses are recursively stripped of keys matching `email`, `phone`, `password`, `razorpay_order_id`, and other identifiers (`_sanitize_data`).
   * **Token Pruning**: To prevent token limit errors (HTTP 413), payloads are capped at the source: reviews are capped at **5**, appointments at **15**, and providers at **20**.

---

### Step 6: The Verification & Repair Loop
Before generating the final answer, context items are evaluated using `verify()` to compute a weighted reliability score:

$$\text{Combined Score} = (\text{Grounding} \times 0.4) + (\text{Contradiction} \times 0.3) + (\text{Coverage} \times 0.3)$$

1. **Grounding Check ($G$)**: Compares word overlaps. If $\ge 2$ context items contain query terms, score is `1.0`. If 1 item, `0.6`. If low overlap, `0.4`. If empty, `0.0`.
2. **Contradiction Check ($C$)**: Scans negation keywords (`not`, `never`, `cannot`). If multiple contradictory contexts are detected, score is reduced to `0.3`, otherwise `1.0`.
3. **Coverage Check ($Cov$)**: For live data, this is always `1.0` (as API results are authoritative). For KB, Jaccard overlaps are scored based on thresholds (`>= 0.15` $\rightarrow$ `1.0`, `>= 0.08` $\rightarrow$ `0.6`, else `0.2`).
4. **Repair Check**: If the combined score is **$< 0.5$**, the context is marked as **weak**. The loop increments the repair count (up to **2** times) and widens the search space ($\text{top\_k} = \text{top\_k} + 4$) before refetching.

---

### Step 7: Response Generation
* **LLM Generation**: Prompt is built containing conversation history, sanitized live tool data, reranked KB chunks, and rules (e.g. refuses general coding/math help, formats bullet lists, and includes the four required provider rating stats: *Average Rating, Total Reviews, Highest Rating, and Lowest Rating*).
* **Direct Format Fallback (No-LLM)**: If Groq throws errors, the generation step falls back to `_answer_from_tool_results` or `_format_kb_chunks`. This formats the structured dictionaries into lists or tables directly, keeping the agent operational even without an active LLM connection.
* **Watermarking**: If the verification checks ended in a "weak" state, the response is prepended with a warning icon: `⚠️ I couldn't find strong source material.`.

---

### Step 8: Memory & Eviction
* **JSON File Store**: Session states are locked (`threading.Lock`) and appended to `sessions.json` under `/schedully/backend/sessions.json`.
* **Memory Limits**: Session history is capped at **20 turns** to keep performance fast.
* **Eviction**: A background garbage collector (`evict_stale_sessions()`) finds and evicts sessions with inactivity exceeding **1 hour (3600s)**.

---

## 4. Key Configurations & Settings

The backend coordinates are read from the parent application settings:
* **API Key**: Parsed from the core backend environment file `backend/.env` under the key `GROQ_API_KEY`.
* **Platform URL**: `PLATFORM_BASE_URL` (default: `http://localhost:5000`).
* **Cache TTLs**: Intent Cache = `300s`, Generation Cache = `120s`.
