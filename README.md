# AI Profile Research: Affluent Individual Profile Generator

An automated, multi-agent AI research pipeline that takes a name and basic context, dynamically plans targeted web searches, gathers public data, and synthesizes a highly detailed, fully cited dossier.

This project is designed for researchers, wealth managers, and development officers who need compliant, accurate, and deeply researched background profiles without spending hours on manual search engines.

---

## 🚀 Key Features

*   **Autonomous Query Planning:** An LLM agent analyzes the target's name and context to generate a series of highly targeted, diverse search queries (e.g., philanthropic history, business associations, board memberships).
*   **Intelligent Web Scraping:** Gathers and parses public records, news articles, and corporate filings from across the web.
*   **Multi-Source Synthesis:** Merges conflicting or duplicate data points, resolves discrepancies, and structures the final output into a clean, readable profile.
*   **100% Traceable Citations:** Every claim, net worth estimate, or bio detail in the generated profile is accompanied by an inline citation and direct link back to the source.

---

## 🛠️ The Architecture Pipeline

To ensure maximum accuracy and minimize AI hallucinations, the system uses a strict pipeline workflow:
[ User Input ] (Name + Context)
│
▼
┌──────────────────────────┐
│   1. Query Planner Agent │ ──► Generates 5-10 hyper-specific queries
└──────────────────────────┘
│
▼
┌──────────────────────────┐
│   2. Web Search & Scrape │ ──► Fetches raw HTML & extracts body text
└──────────────────────────┘
│
▼
┌──────────────────────────┐
│  3. Information Extractor│ ──► Isolates key facts, dates, and source URLs
└──────────────────────────┘
│
▼
┌──────────────────────────┐
│   4. Synthesizer Agent   │ ──► Resolves conflicts & compiles the dossier
└──────────────────────────┘
│
▼
[ Final Profile Output ] 
