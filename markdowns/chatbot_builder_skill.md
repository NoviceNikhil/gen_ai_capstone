---
name: chatbot-builder-skill
description: Technical instructions and patterns for constructing and modifying the Schedully AI Chatbot pipeline. Includes intent classification, conversation orchestrator, grounding verifier checks, direct tool call layers, and fallback direct formatting rules.
license: MIT
---

# Chatbot Builder Skill

Guidelines and patterns for building or refactoring the Schedully AI Chatbot orchestrator and generation pipeline.

## 1. Intent Classification & Caching (`planner.py`)
Incoming user queries must first be classified to decide routing:
- **Intents**: Support `knowledge_base`, `live_data`, `document_qa`, `compound` (hybrid), `needs_clarification`, and `out_of_scope` (refuse non-scheduling questions).
- **Core LLM**: Invoke Groq `llama-3.1-8b-instant` with structured system instructions to return JSON.
- **Cache**: Implement a local query-hash plan cache with a **5-minute TTL** to reduce latency.
- **Keyword Fallback**: Implement a robust regex-based matching engine (`_keyword_plan`) to handle routing if the LLM API is offline.
- **Prompt Injection Filter**: Run queries against a regex instruction override block (e.g. `"ignore previous instructions"`) and return a canned refusal on match.

## 2. Conversational Orchestration & Modes (`orchestrator.py`)
- **Conversational Short-Circuit**: Match generic greeting, farewell, and thank-you inputs against canned templates to bypass RAG execution.
- **Fast-Path Commands**: Map high-frequency phrases (e.g. `"upcoming appointments"`, `"dentists in Hyderabad"`) to tools directly to skip LLM classification latency.
- **Context Management**: Scrape and include session conversation history (memory turns) to maintain context.
- **Repair Loop**: Widen search parameters (`top_k += 4`) and retry up to 2 times if the grounding check evaluates the retrieved context as `"weak"`.

## 3. Tool Execution Layer (`tool_layer.py`)
- **API GET Operations Only**: Restrict tool layer commands to read-only API calls (using the user's bearer token) mapping database entities (appointments, slots, providers, reviews, profiles).
- **Security Sanitization**: Scrub sensitive fields (emails, phone numbers, secret keys, passwords) from raw JSON payloads before feeding them to prompt generation.
- **Context Compression**: Prune list sizes (e.g., limit appointments to 15, reviews to 5) to save token usage.

## 4. Verification Check (`verifier.py`)
Before compiling a response, evaluate context relevance:
1. **Grounding Check**: Token overlap Jaccard score between the query and context.
2. **Contradiction Check**: Scan for heavy double negation patterns across chunks.
3. **Coverage Check**: Assess if the highest single-chunk overlap meets a minimum Jaccard threshold.
- Combined Score: $\text{Grounding} \times 0.4 + \text{Contradiction} \times 0.3 + \text{Coverage} \times 0.3$. If the score is **< 0.5**, trigger a repair retry loop.

## 5. Answer Generation (`generator.py`)
- **Groq/LLM Instructions**: Generate answers strictly using the provided context. Cite sources as `[Source 1]`, `[Source 2]` for KB/document Q&A.
- **Metric Enforcement**: When showing rating/review profiles to providers, always display all four metrics: *Average Rating, Total Reviews, Highest Rating, and Lowest Rating*.
- **Direct Formatting Fallback**: If the generation API fails, use template formatting code to render raw JSON payloads directly into markdown bullet lists, keeping the chat interface interactive and functional.
