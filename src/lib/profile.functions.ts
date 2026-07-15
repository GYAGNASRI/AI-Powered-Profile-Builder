import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { firecrawlSearch, firecrawlScrape, type SearchResultItem } from "./firecrawl.server";

/**
 * Agentic profile-generation workflow
 * ---------------------------------------------------------------
 * Step 1 — Search:     plan targeted queries, retrieve public sources
 * Step 2 — Extract:    LLM pulls structured basic details + flags gaps
 * Step 3 — Synthesize: LLM writes narrative sections grounded in sources
 * Step 4 — Structure:  merge, dedupe references, attach flags
 * ---------------------------------------------------------------
 */

const InputSchema = z.object({
  name: z.string().min(1).max(200),
  context: z.string().max(500).optional().default(""),
});

const ExtractedSchema = z.object({
  basicDetails: z.object({
    fullName: z.string().nullable(),
    nationality: z.string().nullable(),
    currentRole: z.string().nullable(),
    industry: z.string().nullable(),
    currentCity: z.string().nullable(),
    currentCountry: z.string().nullable(),
  }),
  estimatedNetWorth: z.object({
    value: z.string().nullable(),
    note: z.string().nullable(),
  }),
  photoUrl: z.string().nullable(),
  missingFields: z.array(z.string()),
  conflictingFields: z.array(z.string()),
});

const SynthesizedSchema = z.object({
  executiveSummary: z.string().nullable(),
  biography: z.string().nullable(),
  careerTimeline: z.array(z.object({ year: z.string(), event: z.string() })),
  education: z.array(z.string()),
  interests: z.array(z.string()),
  recentNews: z.array(z.string()),
});

const ProfileSchema = ExtractedSchema.merge(SynthesizedSchema).extend({
  references: z.array(z.object({ title: z.string(), url: z.string() })),
  conflictsOrGaps: z.array(z.string()),
});

export type Profile = z.infer<typeof ProfileSchema>;

export type WorkflowStepStatus = "in_progress" | "completed" | "failed";
export interface WorkflowStep {
  step: "search" | "extract" | "synthesize" | "structure";
  status: WorkflowStepStatus;
  detail?: string;
}

// ---------- JSON helpers ----------
function extractJSON(raw: string): unknown {
  let cleaned = raw
    .replace(/^```json\s*/im, "")
    .replace(/^```\s*/im, "")
    .replace(/```\s*$/im, "")
    .trim();
  if (!cleaned.startsWith("{") && !cleaned.startsWith("[")) {
    const objStart = cleaned.indexOf("{");
    const arrStart = cleaned.indexOf("[");
    const isArray = arrStart !== -1 && (objStart === -1 || arrStart < objStart);
    const start = isArray ? arrStart : objStart;
    const end = isArray ? cleaned.lastIndexOf("]") : cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) cleaned = cleaned.slice(start, end + 1);
    else throw new Error("No JSON object found in model output");
  }
  return JSON.parse(cleaned);
}

async function generateJson<T>(
  model: ReturnType<ReturnType<typeof createLovableAiGatewayProvider>>,
  schema: z.ZodType<T>,
  prompt: string,
): Promise<T> {
  const { text } = await generateText({
    model,
    prompt: `${prompt}\n\nReturn ONLY a single JSON object matching the required shape. No prose, no markdown fences.`,
  });
  const parsed = extractJSON(text);
  return schema.parse(parsed);
}

// ---------- Step 1: Search ----------
async function searchStep(
  model: ReturnType<ReturnType<typeof createLovableAiGatewayProvider>>,
  subject: string,
  steps: WorkflowStep[],
): Promise<{ sources: SearchResultItem[]; corpus: string }> {
  steps.push({ step: "search", status: "in_progress" });
  try {
    const { text: planText } = await generateText({
      model,
      prompt: `You are a research planner. Produce 6 focused Google-style search queries to build a public profile of "${subject}". Cover: biography and career, education, current role & company, estimated net worth, recent news (past 12 months), interests/hobbies. Return only queries, one per line, no numbering.`,
    });
    const queries = planText
      .split("\n")
      .map((l) => l.replace(/^[-*\d.)\s]+/, "").trim())
      .filter((l) => l.length > 3)
      .slice(0, 6);

    const results = await Promise.all(
      queries.map((q) =>
        firecrawlSearch(q, { limit: 4 }).catch(() => [] as SearchResultItem[]),
      ),
    );

    const seen = new Set<string>();
    const sources: SearchResultItem[] = [];
    results.flat().forEach((r) => {
      if (!r.url || seen.has(r.url)) return;
      seen.add(r.url);
      sources.push(r);
    });

    // Scrape top-priority sources for richer grounding
    const priorityHosts = /wikipedia\.org|forbes\.com|bloomberg\.com|reuters\.com|britannica\.com|nytimes\.com|ft\.com|cnbc\.com/i;
    const toScrape = sources.filter((s) => priorityHosts.test(s.url)).slice(0, 4);
    const scraped = await Promise.all(
      toScrape.map((s) =>
        firecrawlScrape(s.url)
          .then((r) => ({ url: s.url, title: s.title, md: r.markdown ?? "" }))
          .catch(() => ({ url: s.url, title: s.title, md: "" })),
      ),
    );

    const corpus = scraped
      .filter((s) => s.md)
      .map((s) => `## ${s.title ?? s.url}\nURL: ${s.url}\n\n${s.md.slice(0, 6000)}`)
      .join("\n\n---\n\n");

    steps[steps.length - 1] = {
      step: "search",
      status: "completed",
      detail: `${queries.length} queries → ${sources.length} sources, ${scraped.filter((s) => s.md).length} scraped`,
    };
    return { sources, corpus };
  } catch (err) {
    steps[steps.length - 1] = {
      step: "search",
      status: "failed",
      detail: (err as Error).message,
    };
    throw err;
  }
}

// ---------- Step 2: Extract ----------
async function extractStep(
  model: ReturnType<ReturnType<typeof createLovableAiGatewayProvider>>,
  subject: string,
  sources: SearchResultItem[],
  corpus: string,
  steps: WorkflowStep[],
): Promise<z.infer<typeof ExtractedSchema>> {
  steps.push({ step: "extract", status: "in_progress" });
  const empty: z.infer<typeof ExtractedSchema> = {
    basicDetails: {
      fullName: null, nationality: null, currentRole: null,
      industry: null, currentCity: null, currentCountry: null,
    },
    estimatedNetWorth: { value: null, note: null },
    photoUrl: null,
    missingFields: ["all"],
    conflictingFields: [],
  };
  try {
    const sourcesBlock = sources
      .slice(0, 20)
      .map(
        (s, i) =>
          `[S${i + 1}] ${s.title ?? "(untitled)"}\nURL: ${s.url}\nSnippet: ${(s.description ?? "").slice(0, 400)}`,
      )
      .join("\n\n");

    const prompt = `Extract structured basic identity data for "${subject}" using ONLY the public sources below. Do not fabricate.

Rules:
- Set unknown string fields to null (JSON null, not the string "null").
- List every field you could NOT confidently determine in "missingFields".
- If sources contradict each other on a fact, add a short description to "conflictingFields".
- photoUrl: include only if a source clearly links an official/Wikipedia image URL; else null.
- estimatedNetWorth.value: human string like "US$1.5–2.0 Billion" or null.

Required JSON shape (all keys required):
{
  "basicDetails": {
    "fullName": string|null,
    "nationality": string|null,
    "currentRole": string|null,
    "industry": string|null,
    "currentCity": string|null,
    "currentCountry": string|null
  },
  "estimatedNetWorth": { "value": string|null, "note": string|null },
  "photoUrl": string|null,
  "missingFields": string[],
  "conflictingFields": string[]
}

SEARCH SNIPPETS:
${sourcesBlock}

${corpus ? `FULL PAGE CONTENT:\n${corpus}` : ""}`;

    const result = await generateJson(model, ExtractedSchema, prompt);
    steps[steps.length - 1] = {
      step: "extract",
      status: "completed",
      detail: `${result.missingFields.length} gaps, ${result.conflictingFields.length} conflicts`,
    };
    return result;
  } catch (err) {
    steps[steps.length - 1] = {
      step: "extract",
      status: "failed",
      detail: (err as Error).message.slice(0, 200),
    };
    return empty;
  }
}

// ---------- Step 3: Synthesize ----------
async function synthesizeStep(
  model: ReturnType<ReturnType<typeof createLovableAiGatewayProvider>>,
  subject: string,
  sources: SearchResultItem[],
  corpus: string,
  extracted: z.infer<typeof ExtractedSchema>,
  steps: WorkflowStep[],
): Promise<z.infer<typeof SynthesizedSchema>> {
  steps.push({ step: "synthesize", status: "in_progress" });
  const empty: z.infer<typeof SynthesizedSchema> = {
    executiveSummary: null,
    biography: null,
    careerTimeline: [],
    education: [],
    interests: [],
    recentNews: [],
  };
  try {
    const sourcesBlock = sources
      .slice(0, 20)
      .map(
        (s, i) =>
          `[S${i + 1}] ${s.title ?? "(untitled)"}\nURL: ${s.url}\nSnippet: ${(s.description ?? "").slice(0, 400)}`,
      )
      .join("\n\n");

    const prompt = `You are a factual biographer writing a profile of "${subject}".
Use ONLY the sources below plus the already-extracted basics. Do not fabricate. Where sources are insufficient, use null (for strings) or an empty array.

Required JSON shape (all keys required):
{
  "executiveSummary": string|null,   // 2-3 sentences on who they are and their significance
  "biography": string|null,          // 3-5 sentences of career/background narrative
  "careerTimeline": [{ "year": string, "event": string }],  // chronological, e.g. "2014" or "2014–Present"
  "education": string[],             // degrees + institutions
  "interests": string[],             // known interests, hobbies, causes
  "recentNews": string[]             // recent (past ~12 months) activities or news
}

ALREADY-EXTRACTED BASICS:
${JSON.stringify(extracted.basicDetails, null, 2)}

SEARCH SNIPPETS:
${sourcesBlock}

${corpus ? `FULL PAGE CONTENT:\n${corpus}` : ""}`;

    const result = await generateJson(model, SynthesizedSchema, prompt);
    steps[steps.length - 1] = {
      step: "synthesize",
      status: "completed",
      detail: `${result.careerTimeline.length} timeline entries, ${result.education.length} edu, ${result.recentNews.length} news`,
    };
    return result;
  } catch (err) {
    steps[steps.length - 1] = {
      step: "synthesize",
      status: "failed",
      detail: (err as Error).message.slice(0, 200),
    };
    return empty;
  }
}

// ---------- Step 4: Structure ----------
function structureStep(
  extracted: z.infer<typeof ExtractedSchema>,
  synthesized: z.infer<typeof SynthesizedSchema>,
  sources: SearchResultItem[],
  steps: WorkflowStep[],
): Profile {
  steps.push({ step: "structure", status: "in_progress" });

  const priorityHosts = /wikipedia\.org|forbes\.com|bloomberg\.com|reuters\.com|linkedin\.com|britannica\.com|nytimes\.com|ft\.com|cnbc\.com|microsoft\.com|apple\.com|meta\.com|google\.com/i;
  const prioritized = [
    ...sources.filter((s) => priorityHosts.test(s.url)),
    ...sources.filter((s) => !priorityHosts.test(s.url)),
  ].slice(0, 10);

  const references = prioritized.map((s) => {
    let host = s.url;
    try { host = new URL(s.url).hostname.replace(/^www\./, ""); } catch { /* ignore */ }
    return { title: s.title || host, url: s.url };
  });

  const conflictsOrGaps: string[] = [];
  extracted.missingFields.forEach((f) => conflictsOrGaps.push(`Missing: ${f}`));
  extracted.conflictingFields.forEach((f) => conflictsOrGaps.push(`Conflict: ${f}`));

  const profile: Profile = {
    ...extracted,
    ...synthesized,
    references,
    conflictsOrGaps,
  };

  steps[steps.length - 1] = {
    step: "structure",
    status: "completed",
    detail: `${references.length} references`,
  };
  return profile;
}

// ---------- Orchestrator ----------
export const generateProfile = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => InputSchema.parse(raw))
  .handler(async ({ data }): Promise<{ profile: Profile; steps: WorkflowStep[] }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-3-flash-preview");

    const steps: WorkflowStep[] = [];
    const subject = data.context ? `${data.name} (${data.context})` : data.name;

    const { sources, corpus } = await searchStep(model, subject, steps);
    const extracted = await extractStep(model, subject, sources, corpus, steps);
    const synthesized = await synthesizeStep(model, subject, sources, corpus, extracted, steps);
    const profile = structureStep(extracted, synthesized, sources, steps);

    return { profile, steps };
  });
