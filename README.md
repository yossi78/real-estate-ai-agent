# --------------------------------------------------------------------------------------------------------
#   REAL-ESTATE-AI-AGENT
# --------------------------------------------------------------------------------------------------------

**Madlan Deal Valuation & Opportunity Evaluator** — a production-structured full-stack service that ingests Israeli residential transaction CSVs, computes strict statistical metrics in Node.js, and asks a **local** Ollama LLM (`llama3:8b` or `mistral`) only for Hebrew narrative interpretation.

The LLM never sees raw bulk rows. Numbers are always calculated in-process. If Ollama is down, slow, or returns invalid JSON, a deterministic fallback engine answers immediately.

---



# --------------------------------------------------------------------------------------------------------
#   ARCHITECTURE
# --------------------------------------------------------------------------------------------------------

```
CSV ──► Parser/Cleaner ──► Calculation Engine (deterministic)
                                    │
                                    ▼
                         Aggregated stats JSON
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
              Redis cache                    Ollama (temp 0.1)
              (24h TTL)                      JSON schema only
                    ▲                               │
                    └──────── insight merge ────────┘
                                    │
                                    ▼
                         Express API  +  React RTL dashboard
```

| Layer | Responsibility |
| --- | --- |
| `backend/src/services/csv` | Parse + clean Israeli deal CSVs (Hebrew/English headers, NIS formatting) |
| `backend/src/services/stats` | Price/sqm, median, stddev, street/neighborhood variance, historical CAGR |
| `backend/src/services/llm` | Prompt builder, schema validation, 120s timeout, rule-based fallback |
| `backend/src/services/cache` | Redis for neighborhood aggregates and repeated insight queries |
| `frontend` | Hebrew RTL dashboard with **מדויק מהנתונים** vs **ניתוח AI** badges |

---

# --------------------------------------------------------------------------------------------------------
#   DETERMINISTIC LOGIC VS LLM
# --------------------------------------------------------------------------------------------------------


**Calculated in Node.js (never guessed):**

- Price per SQM (`priceNis / sqm`)
- Mean / median price and PPSQM
- Sample standard deviation
- % variance vs street baseline and neighborhood baseline
- Year-over-year PPSQM trend and CAGR
- Deal counts, min/max, data-confidence score
- Opportunity score derived from those facts

**Sent to the LLM (aggregated JSON only):**

- Neighborhood/street summaries
- Target deal vs baselines
- Trend + volatility numbers
- Request: Hebrew narrative, pros/cons, risks, buyer tips, verdict

**Never sent:** raw CSV rows, PII-like address dumps, or unconstrained free text that could invent prices.

---

# --------------------------------------------------------------------------------------------------------
#   LLM RELIABILITY (anti-hallucination)
# --------------------------------------------------------------------------------------------------------

1. **Temperature `0.1`** — low randomness, stick to supplied facts.
2. **`format: "json"`** on the Ollama chat API plus a strict Zod schema.
3. **Prompt contract** — the model is forbidden from inventing numbers not present in the payload; it must quote provided metrics.
4. **Timeout 120s** — `AbortController`; `llama3:8b` on CPU often needs ~80s to finish Hebrew JSON, then fallback so the UI is not blocked.
5. **Fallback engine** — malformed JSON, network errors, schema failures, or timeout → rule-based Hebrew insight with `source: "fallback"`.
6. **Response tagging** — API always returns `insightSource: "llm" | "fallback"` so the UI can label **ניתוח AI** vs deterministic copy.

---

# --------------------------------------------------------------------------------------------------------
#   CACHEING & PRECOMPUTATION (redis)
# --------------------------------------------------------------------------------------------------------


| Key pattern | Value | Default TTL |
| --- | --- | --- |
| `corpus:deals` | Cleaned deal corpus (hydrated on boot) | none |
| `stats:neighborhood:{city}:{neighborhood}` | Aggregated neighborhood metrics | 24h (`CACHE_TTL_SECONDS`) |
| `stats:global` | Portfolio-wide rollup | 24h |
| `insight:{sha256}` | LLM/fallback insight for an identical stats payload | 24h |

Repeated evaluations of the same neighborhood/deal context are served from Redis without calling Ollama.

Browse keys in Redis Commander: http://localhost:8081 (`docker compose up redis-ui -d`).

---

# --------------------------------------------------------------------------------------------------------
#   SCALING : 10K AND 100K REQUEST PER DAY
# --------------------------------------------------------------------------------------------------------

| Load | Workers | Rate limit (default window 15 min) | Notes |
| --- | --- | --- | --- |
| **~10K req/day** (~7 rpm avg, spikes higher) | `CLUSTER_WORKERS=2` | `RATE_LIMIT_MAX=200` | Single Ollama instance; Redis cache absorbs repeat insight calls |
| **~100K req/day** (~70 rpm avg) | `CLUSTER_WORKERS=0` (all CPUs) | `RATE_LIMIT_MAX=800` + Redis store | LLM concurrency cap (`OLLAMA_MAX_CONCURRENCY=2`) protects the GPU/CPU; raise Redis memory; consider a dedicated Ollama host |

Implemented patterns:

- **Node.js cluster** — primary forks workers; each worker runs Express (`backend/src/index.ts`).
- **`express-rate-limit` + Redis store** — consistent limits across workers.
- **LLM semaphore** — in-process concurrency limit so 100K traffic cannot stampede Ollama.
- **Cache-first insights** — identical payloads never re-hit the model within TTL.

Horizontal scale: run more `backend` replicas behind a load balancer; they share Redis and Ollama.

---

# --------------------------------------------------------------------------------------------------------
#   REPOSITORY LAYOUT
# --------------------------------------------------------------------------------------------------------


```
real-estate-ai-agent/
├── docker-compose.yml          # Redis + Redis Commander + Ollama + backend + frontend
├── README.md
├── backend/
│   ├── src/
│   │   ├── index.ts            # cluster entry
│   │   ├── app.ts              # Express app factory
│   │   ├── config/
│   │   ├── middleware/         # rate limit, errors
│   │   ├── routes/
│   │   ├── services/
│   │   │   ├── csv/            # parse + clean
│   │   │   ├── stats/          # calculation engine
│   │   │   ├── llm/            # prompts, client, fallback
│   │   │   ├── cache/          # Redis
│   │   │   └── valuation/      # orchestration
│   │   ├── store/              # in-memory deal corpus
│   │   └── data/sample-deals.csv
│   └── tests/unit/
└── frontend/                   # Vite + React + Tailwind, dir=rtl
```

---



# --------------------------------------------------------------------------------------------------------
#   DOCKER (full stack)
# --------------------------------------------------------------------------------------------------------

```bash
cp .env.example .env
docker compose up --build
```

- Dashboard: http://localhost:8080  
- API: http://localhost:3001  
- Redis UI: http://localhost:8081  

`ollama-init` pulls `llama3:8b` (falls back to `mistral`). First pull is large (~4.7GB); subsequent starts reuse the `ollama-data` volume. If insights still show the deterministic fallback, the model is missing — run `docker exec real-estate-ollama ollama pull llama3:8b`.

---


# --------------------------------------------------------------------------------------------------------
#   API
# --------------------------------------------------------------------------------------------------------


| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Liveness + Redis/Ollama status |
| `GET` | `/api/deals` | Paginated cleaned transactions (`?neighborhood=&street=&page=&limit=`) |
| `POST` | `/api/deals/upload` | Multipart `file` CSV; replaces in-memory corpus and busts stats cache |
| `GET` | `/api/metrics` | Global + per-neighborhood calculated metrics |
| `GET` | `/api/metrics/neighborhoods/:name` | Neighborhood rollup + street breakdown |
| `POST` | `/api/insights/evaluate` | Body `{ dealId?: string, neighborhood?: string }` → stats + Hebrew insight |
| `POST` | `/api/cache/flush` | Clears the Redis database (`FLUSHDB`) — stats and insight cache |

Insight payload always includes:

```json
{
  "metricsSource": "calculated",
  "insightSource": "llm",
  "fallbackUsed": false,
  "insight": { "summary": "...", "verdict": "buy", "pros": [], "cons": [] }
}
```

---


# --------------------------------------------------------------------------------------------------------
#   TESTS
# --------------------------------------------------------------------------------------------------------

```bash
cd backend
npm test
```

Jest covers:

- CSV parsing and cleaning (Hebrew headers, invalid rows, NIS formatting)
- Calculation engine (PPSQM, median, stddev, variance, CAGR)
- Prompt builder (no raw rows, schema instructions, temperature contract)
- Fallback engine (rule thresholds)
- Insight service (timeout / malformed JSON → fallback, Redis cache hit)

---


# --------------------------------------------------------------------------------------------------------
#   CONFIGURATION
# --------------------------------------------------------------------------------------------------------

See `.env.example` (root) and `backend/.env.example`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `OLLAMA_MODEL` | `llama3:8b` | Local model name |
| `OLLAMA_TIMEOUT_MS` | `120000` | Hard LLM deadline (120s) |
| `OLLAMA_TEMPERATURE` | `0.1` | Low-entropy generation |
| `CACHE_TTL_SECONDS` | `86400` | Redis TTL (24h) |
| `CLUSTER_WORKERS` | `0` | `0` = CPU count |
| `RATE_LIMIT_MAX` | `300` | Max requests per window per IP |

---


# --------------------------------------------------------------------------------------------------------
#   CSV CONTRACT
# --------------------------------------------------------------------------------------------------------


English headers (aliases in parentheses):

`dealId, date, city, neighborhood, street, rooms, floor, sqm, priceNis, propertyType, yearBuilt`

Hebrew headers supported: `מזהה, תאריך, עיר, שכונה, רחוב, חדרים, קומה, שטח, מחיר, סוג_נכס, שנת_בניה`

Dates: `YYYY-MM-DD` or `DD/MM/YYYY`. Prices: `1850000` or `1,850,000`.

---



# --------------------------------------------------------------------------------------------------------
#   PREREQUISITES
# --------------------------------------------------------------------------------------------------------

- Node.js 20+
- npm 10+
- Docker Desktop (for Redis + Ollama + full stack)

Local LLM without Docker: install [Ollama](https://ollama.com) and run `ollama pull llama3:8b` (or `mistral`).

---



# --------------------------------------------------------------------------------------------------------
#   HOW TO RUN THE SERVICE
# --------------------------------------------------------------------------------------------------------

```bash
# 1. Redis + Redis Commander + Ollama
docker compose up redis redis-ui ollama ollama-init -d

# 2. Backend
cd backend
cp .env.example .env
npm install
npm run dev

# 3. Frontend (other terminal)
cd frontend
npm install
npm run dev
```

- UI: http://localhost:5173  
- API: http://localhost:3001  
- Health: http://localhost:3001/health  
- Redis UI: http://localhost:8081  

Public URL (ngrok — laptop must stay on, with backend + frontend running). A watchdog checks the tunnel every second, restarts it if it drops, and rewrites the URLs below:

```bash
python3 scripts/ngrok-watchdog.py          # daemon
python3 scripts/ngrok-watchdog.py --stop
```

- Dashboard: https://syntypic-hailee-nonintoxicatingly.ngrok-free.dev  
- Health: https://syntypic-hailee-nonintoxicatingly.ngrok-free.dev/health  

First visit shows an ngrok interstitial — click **Visit Site**. The watchdog updates these URLs if the hostname changes.

On first boot the backend loads `backend/src/data/sample-deals.csv` (Tel Aviv / Ramat Gan sample corpus).

---


# --------------------------------------------------------------------------------------------------------
#    END
# --------------------------------------------------------------------------------------------------------


