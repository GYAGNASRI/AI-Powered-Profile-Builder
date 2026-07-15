import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { generateProfile, type Profile, type WorkflowStep } from "@/lib/profile.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  UserRound,
  IdCard,
  User,
  BarChart3,
  GraduationCap,
  Heart,
  DollarSign,
  Newspaper,
  Link2,
  AlertTriangle,
  Loader2,
  Sparkles,
  Search,
  FileSearch,
  PenLine,
  LayoutGrid,
  CheckCircle2,
  XCircle,
  Circle,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Affluent Profile Generator — AI-powered public profiles" },
      {
        name: "description",
        content:
          "Generate structured, cited profiles of affluent individuals from publicly available sources using an AI research workflow.",
      },
      { property: "og:title", content: "Affluent Profile Generator" },
      {
        property: "og:description",
        content: "AI-powered structured profiles from public sources.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const call = useServerFn(generateProfile);
  const router = useRouter();
  const [name, setName] = useState("Satya Nadella");
  const [context, setContext] = useState("CEO of Microsoft");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setProfile(null);
    setSteps([]);
    try {
      const res = await call({ data: { name, context } });
      setProfile(res.profile);
      setSteps(res.steps);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      router.invalidate();
    }
  }

  return (
    <div className="min-h-screen bg-[color:var(--page-bg)]">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <header className="mb-8">
          <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--brand)]">
            <Sparkles className="h-4 w-4" />
            AI Profile Research
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[color:var(--brand-dark)]">
            Affluent Individual Profile Generator
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter a name and context. An AI research pipeline plans queries, gathers public sources
            via web search, and synthesizes a cited profile.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border bg-card p-5 shadow-sm mb-8"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Satya Nadella"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="context">Context</Label>
              <Input
                id="context"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="CEO of Microsoft"
                className="mt-1"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Researching…
                </>
              ) : (
                "Generate Profile"
              )}
            </Button>
            {loading && (
              <span className="text-xs text-muted-foreground">
                Planning queries → searching the web → synthesizing…
              </span>
            )}
          </div>
        </form>

        {error && (
          <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {(loading || steps.length > 0) && <WorkflowProgress steps={steps} loading={loading} />}

        {profile && <ProfileView profile={profile} />}
      </div>
      <style>{`
        :root {
          --page-bg: #f6f8fc;
          --brand: #1e40af;
          --brand-dark: #172554;
          --brand-soft: #eff3fb;
        }
      `}</style>
    </div>
  );
}

const STEP_META: Record<
  WorkflowStep["step"],
  { label: string; description: string; icon: React.ComponentType<{ className?: string }> }
> = {
  search: {
    label: "Search",
    description: "Plan queries & retrieve public sources",
    icon: Search,
  },
  extract: {
    label: "Extract",
    description: "Pull structured details, flag gaps",
    icon: FileSearch,
  },
  synthesize: {
    label: "Synthesize",
    description: "Write cited narrative sections",
    icon: PenLine,
  },
  structure: {
    label: "Structure",
    description: "Assemble final profile & references",
    icon: LayoutGrid,
  },
};

function WorkflowProgress({ steps, loading }: { steps: WorkflowStep[]; loading: boolean }) {
  const order: WorkflowStep["step"][] = ["search", "extract", "synthesize", "structure"];
  const byStep = new Map(steps.map((s) => [s.step, s]));

  return (
    <div className="mb-6 rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[color:var(--brand-dark)]">
        <Sparkles className="h-4 w-4 text-[color:var(--brand)]" />
        AI workflow
        {loading && <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      <ol className="grid gap-3 sm:grid-cols-4">
        {order.map((key) => {
          const meta = STEP_META[key];
          const state = byStep.get(key);
          const status: WorkflowStep["status"] | "pending" = state?.status ?? "pending";
          const Icon = meta.icon;
          return (
            <li
              key={key}
              className={
                "rounded-lg border p-3 " +
                (status === "completed"
                  ? "border-emerald-200 bg-emerald-50/60"
                  : status === "in_progress"
                    ? "border-[color:var(--brand)]/40 bg-[color:var(--brand-soft)]"
                    : status === "failed"
                      ? "border-destructive/40 bg-destructive/10"
                      : "border-dashed bg-muted/30")
              }
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-[color:var(--brand)]" />
                <span className="text-sm font-semibold">{meta.label}</span>
                <span className="ml-auto">
                  {status === "completed" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : status === "in_progress" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-[color:var(--brand)]" />
                  ) : status === "failed" ? (
                    <XCircle className="h-4 w-4 text-destructive" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/40" />
                  )}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{meta.description}</p>
              {state?.detail && (
                <p className="mt-1 text-xs font-medium text-foreground/70">{state.detail}</p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--brand-soft)] text-[color:var(--brand)]">
        <Icon className="h-4 w-4" />
      </span>
      <h2 className="text-sm font-bold uppercase tracking-wide text-[color:var(--brand)]">
        {title}
      </h2>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-md border bg-white">
      <div className="border-b bg-[color:var(--brand-soft)] px-3 py-1.5 text-xs font-semibold text-[color:var(--brand-dark)]">
        {label}
      </div>
      <div className="px-3 py-2 text-sm text-foreground">
        {value ?? <span className="text-muted-foreground italic">Not publicly available</span>}
      </div>
    </div>
  );
}

function ProfileView({ profile }: { profile: Profile }) {
  const b = profile.basicDetails;
  return (
    <article className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      {/* Title bar */}
      <div className="border-b-2 border-[color:var(--brand-dark)] px-6 py-4">
        <h2 className="text-center text-2xl font-bold tracking-wide text-[color:var(--brand-dark)]">
          PROFILE: {(b.fullName ?? "").toUpperCase() || "UNKNOWN"}
        </h2>
      </div>

      <div className="space-y-6 p-6">
        {/* Executive Summary + Photo */}
        <section className="grid gap-6 md:grid-cols-[180px_1fr]">
          <div className="flex h-44 w-full items-center justify-center overflow-hidden rounded-md border bg-[color:var(--brand-soft)]">
            {profile.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.photoUrl}
                alt={b.fullName ?? "Profile photo"}
                className="h-full w-full object-cover"
              />
            ) : (
              <UserRound className="h-16 w-16 text-[color:var(--brand)]/40" />
            )}
          </div>
          <div>
            <SectionHeader icon={UserRound} title="Executive Summary" />
            <p className="text-sm leading-relaxed text-foreground">
              {profile.executiveSummary ?? (
                <span className="italic text-muted-foreground">
                  Not enough public information for a summary.
                </span>
              )}
            </p>
          </div>
        </section>

        <hr />

        {/* Basic Details */}
        <section>
          <SectionHeader icon={IdCard} title="Basic Details" />
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            <Field label="Full Name" value={b.fullName} />
            <Field label="Nationality" value={b.nationality} />
            <Field label="Current Role / Occupation" value={b.currentRole} />
            <Field label="Industry" value={b.industry} />
            <Field label="Current City" value={b.currentCity} />
            <Field label="Current Country" value={b.currentCountry} />
          </div>
        </section>

        <hr />

        {/* Biography */}
        <section>
          <SectionHeader icon={User} title="Biography / Summary" />
          <p className="text-sm leading-relaxed text-foreground">
            {profile.biography ?? (
              <span className="italic text-muted-foreground">Not publicly available.</span>
            )}
          </p>
        </section>

        <hr />

        <div className="grid gap-8 md:grid-cols-2">
          <section>
            <SectionHeader icon={BarChart3} title="Career Timeline" />
            {profile.careerTimeline.length ? (
              <ol className="space-y-2 border-l-2 border-[color:var(--brand)]/30 pl-4">
                {profile.careerTimeline.map((e, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[21px] top-1.5 h-3 w-3 rounded-full bg-[color:var(--brand)]" />
                    <div className="text-sm">
                      <span className="font-semibold text-[color:var(--brand)]">{e.year}</span>
                      <span className="ml-3 text-foreground">{e.event}</span>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm italic text-muted-foreground">Not publicly available.</p>
            )}
          </section>

          <section className="space-y-6">
            <div>
              <SectionHeader icon={GraduationCap} title="Education" />
              {profile.education.length ? (
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {profile.education.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm italic text-muted-foreground">Not publicly available.</p>
              )}
            </div>
            <div>
              <SectionHeader icon={Heart} title="Interests" />
              {profile.interests.length ? (
                <ul className="grid list-disc grid-cols-2 gap-x-4 pl-5 text-sm">
                  {profile.interests.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm italic text-muted-foreground">Not publicly available.</p>
              )}
            </div>
          </section>
        </div>

        <hr />

        <div className="grid gap-4 md:grid-cols-3">
          <section className="rounded-lg border bg-emerald-50/60 p-4">
            <SectionHeader icon={DollarSign} title="Net Worth" />
            <div className="text-lg font-bold text-emerald-800">
              {profile.estimatedNetWorth.value ?? "Not publicly available"}
            </div>
            {profile.estimatedNetWorth.note && (
              <p className="mt-1 text-xs text-muted-foreground">
                {profile.estimatedNetWorth.note}
              </p>
            )}
          </section>

          <section className="rounded-lg border bg-amber-50/60 p-4">
            <SectionHeader icon={Newspaper} title="Recent News / Public Activities" />
            {profile.recentNews.length ? (
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {profile.recentNews.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm italic text-muted-foreground">Not publicly available.</p>
            )}
          </section>

          <section className="rounded-lg border bg-sky-50/60 p-4">
            <SectionHeader icon={Link2} title="References / Sources" />
            {profile.references.length ? (
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {profile.references.map((r, i) => (
                  <li key={i}>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[color:var(--brand)] underline underline-offset-2 hover:opacity-80"
                    >
                      {r.title || r.url}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm italic text-muted-foreground">No sources.</p>
            )}
          </section>
        </div>

        {profile.conflictsOrGaps.length > 0 && (
          <section className="rounded-lg border border-amber-300 bg-amber-50/60 p-4">
            <SectionHeader icon={AlertTriangle} title="Conflicts & Gaps" />
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {profile.conflictsOrGaps.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </section>
        )}


        <p className="pt-2 text-center text-xs italic text-muted-foreground">
          Information is compiled from publicly available sources and is subject to change.
        </p>
      </div>
    </article>
  );
}
