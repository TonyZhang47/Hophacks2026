"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { BookOpenText, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { ListenButton } from "@/components/ui/ListenButton";
import { TextArea } from "@/components/ui/TextField";
import { SIDE_EFFECT_TAGS, type CommunityPost, type Med, type SideEffectTag, type TopTerm } from "@/lib/types";

const HANDLE_KEY = "rxplain.community.handle";
const MEDWATCH = "https://www.fda.gov/safety/medwatch-fda-safety-information-and-adverse-event-reporting-program";
const POST_MAX = 500;

/** Used when /api/meds/search is unavailable; matches the seeded posts. */
const FALLBACK_MEDS: Med[] = [
  { name: "metformin", rxcui: "6809", ingredientName: "metformin" },
  { name: "ibuprofen", rxcui: "5640", ingredientName: "ibuprofen" },
  { name: "warfarin", rxcui: "11289", ingredientName: "warfarin" },
  { name: "lisinopril", rxcui: "29046", ingredientName: "lisinopril" },
  { name: "sertraline", rxcui: "36437", ingredientName: "sertraline" },
];

const ADJECTIVES = ["quiet", "gentle", "brave", "sunny", "mellow", "calm", "steady", "patient", "humble", "hopeful", "tender", "bright", "cozy", "wandering", "kind"];
const ANIMALS = ["otter", "heron", "sparrow", "badger", "fox", "walrus", "crane", "moose", "lynx", "finch", "owl", "tortoise", "beaver", "elk", "seal"];

function pick<T>(arr: T[]): T {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return arr[buf[0] % arr.length];
}

/** adjective-animal, generated once per browser session. */
function useAnonHandle(): string {
  const [handle, setHandle] = useState("quiet-visitor");
  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(HANDLE_KEY);
      if (saved && /^[a-z]+-[a-z]+$/.test(saved)) {
        setHandle(saved);
        return;
      }
      const h = `${pick(ADJECTIVES)}-${pick(ANIMALS)}`;
      window.sessionStorage.setItem(HANDLE_KEY, h);
      setHandle(h);
    } catch {
      setHandle(`${pick(ADJECTIVES)}-${pick(ANIMALS)}`);
    }
  }, []);
  return handle;
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} ${min === 1 ? "minute" : "minutes"} ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ${h === 1 ? "hour" : "hours"} ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} ${d === 1 ? "day" : "days"} ago`;
  const w = Math.round(d / 7);
  if (w < 9) return `${w} ${w === 1 ? "week" : "weeks"} ago`;
  const mo = Math.round(d / 30);
  return `${mo} ${mo === 1 ? "month" : "months"} ago`;
}

const TAG_LABEL: Record<SideEffectTag, string> = {
  nausea: "Nausea",
  dizziness: "Dizziness",
  sleep: "Sleep",
  appetite: "Appetite",
  headache: "Headache",
  stomach: "Stomach",
  mood: "Mood",
  other: "Other",
};

export function MedicationTalk() {
  const handle = useAnonHandle();
  const [meds, setMeds] = useState<Med[]>(FALLBACK_MEDS);
  const [medQuery, setMedQuery] = useState("");
  const [selectedMed, setSelectedMed] = useState<Med | null>(null);
  const [term, setTerm] = useState<string | null>(null);
  const [terms, setTerms] = useState<TopTerm[]>([]);
  const [official, setOfficial] = useState<string | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const searchTimer = useRef<number | null>(null);
  const ids = useId();

  // Med search-as-you-type; falls back to the seeded five when the route is missing.
  useEffect(() => {
    const q = medQuery.trim();
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    if (q.length < 2) {
      setMeds(FALLBACK_MEDS);
      return;
    }
    searchTimer.current = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/meds/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { results?: Med[] };
        const found = (body.results ?? []).filter((m) => m.rxcui && m.name).slice(0, 12);
        setMeds(found.length ? found : FALLBACK_MEDS.filter((m) => m.name.includes(q.toLowerCase())));
      } catch {
        setMeds(FALLBACK_MEDS.filter((m) => m.name.includes(q.toLowerCase())));
      }
    }, 250);
    return () => {
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
    };
  }, [medQuery]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    const rx = selectedMed?.rxcui;
    const tp = new URLSearchParams();
    if (rx) {
      tp.set("rxcui", rx);
      tp.set("name", selectedMed?.ingredientName ?? selectedMed?.name ?? "");
    }
    const pp = new URLSearchParams();
    if (rx) pp.set("rxcui", rx);
    if (term) pp.set("term", term);
    pp.set("limit", "30");
    try {
      const [tRes, pRes] = await Promise.all([fetch(`/api/community/terms?${tp}`), fetch(`/api/community/posts?${pp}`)]);
      if (!tRes.ok || !pRes.ok) throw new Error("load");
      const t = (await tRes.json()) as { terms: TopTerm[]; official: string | null };
      const p = (await pRes.json()) as { posts: CommunityPost[] };
      setTerms(t.terms);
      setOfficial(t.official);
      setPosts(p.posts);
    } catch {
      setLoadError("We couldn't load posts right now. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, [selectedMed, term]);

  useEffect(() => {
    void load();
  }, [load]);

  const medOptions = useMemo(() => {
    const list = [...meds];
    if (selectedMed && !list.some((m) => m.rxcui === selectedMed.rxcui)) list.unshift(selectedMed);
    return list;
  }, [meds, selectedMed]);

  const listenText = useMemo(() => {
    const scope = selectedMed ? `for ${selectedMed.name}` : "for all medicines";
    const termLine = terms.length
      ? `Top terms ${scope}: ${terms.slice(0, 8).map((t) => `${t.term}, ${t.count}`).join("; ")}.`
      : `No posts yet ${scope}.`;
    const postLines = posts.slice(0, 3).map((p, i) => `Post ${i + 1}, about ${p.drug_name}, ${relativeTime(p.created_at)}: ${p.body}`);
    return [termLine, ...postLines, "These are other people's experiences, not medical advice."].join(" ");
  }, [terms, posts, selectedMed]);

  const medSelectId = `${ids}-med`;
  const medSearchId = `${ids}-medq`;

  return (
    <div className="space-y-6">
      {/* Med filter */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={medSearchId} className="block text-label text-md-on-surface-variant mb-1">
            Search a medicine
          </label>
          <input
            id={medSearchId}
            type="search"
            value={medQuery}
            onChange={(e) => setMedQuery(e.target.value)}
            placeholder="metformin"
            autoComplete="off"
            className="w-full h-14 rounded-t-lg rounded-b-none bg-md-surface-container-low px-4 text-body text-md-on-background placeholder:text-md-on-background/50 border-b-2 border-md-outline focus:border-md-primary transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary focus-visible:ring-offset-2"
          />
        </div>
        <div>
          <label htmlFor={medSelectId} className="block text-label text-md-on-surface-variant mb-1">
            Show posts about
          </label>
          <select
            id={medSelectId}
            value={selectedMed?.rxcui ?? ""}
            onChange={(e) => {
              const m = medOptions.find((x) => x.rxcui === e.target.value) ?? null;
              setSelectedMed(m);
              setTerm(null);
            }}
            className="w-full h-14 rounded-t-lg rounded-b-none bg-md-surface-container-low px-4 text-body text-md-on-background border-b-2 border-md-outline focus:border-md-primary transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary focus-visible:ring-offset-2"
          >
            <option value="">All medicines</option>
            {medOptions.map((m) => (
              <option key={m.rxcui} value={m.rxcui}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Top terms + official label */}
      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(16rem,20rem)]">
        <section aria-labelledby={`${ids}-terms-h`} className="space-y-3">
          <h3 id={`${ids}-terms-h`} className="text-label text-md-on-surface-variant">
            Top terms {selectedMed ? `for ${selectedMed.name}` : "across all posts"} · tap one to filter
          </h3>
          {terms.length === 0 ? (
            <p className="text-body text-md-on-surface-variant">{loading ? "Loading…" : "No posts yet, so no terms to show."}</p>
          ) : (
            <ul className="flex flex-wrap gap-2 list-none p-0 m-0" aria-label="Most mentioned terms">
              {terms.map((t, i) => (
                <li key={t.term}>
                  <Chip
                    selected={term === t.term}
                    onClick={() => setTerm((cur) => (cur === t.term ? null : t.term))}
                    className={i < 3 ? "font-bold" : i < 8 ? "font-medium" : "font-normal"}
                    aria-label={`${t.term}, mentioned in ${t.count} ${t.count === 1 ? "post" : "posts"}${term === t.term ? ", selected" : ""}`}
                  >
                    {t.term} · {t.count}
                  </Chip>
                </li>
              ))}
            </ul>
          )}
          {term && (
            <p className="text-meta text-md-on-surface-variant">
              Showing posts that mention &ldquo;{term}&rdquo;.{" "}
              <button type="button" onClick={() => setTerm(null)} className="text-md-primary underline underline-offset-4 rounded">
                Show all
              </button>
            </p>
          )}
        </section>

        <aside
          aria-labelledby={`${ids}-official-h`}
          className="rounded-3xl border border-md-outline p-5 space-y-3 self-start"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 id={`${ids}-official-h`} className="inline-flex items-center gap-2 text-label text-md-on-surface-variant">
              <BookOpenText className="h-5 w-5" aria-hidden="true" />
              From the label
            </h3>
            {official && <ListenButton text={`From the official label for ${selectedMed?.name ?? "this medicine"}: ${official}`} size="sm" variant="tonal" />}
          </div>
          {official ? (
            <p className="text-body">{official}</p>
          ) : (
            <p className="text-body text-md-on-surface-variant">
              {selectedMed ? "No label text on file for this medicine yet." : "Pick a medicine to see what its official label lists as common side effects."}
            </p>
          )}
          <p className="text-meta text-md-on-surface-variant">Source: openFDA drug label, adverse reactions section.</p>
        </aside>
      </div>

      {/* Post list */}
      <section aria-labelledby={`${ids}-posts-h`} className="space-y-4" aria-live="polite" aria-busy={loading}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id={`${ids}-posts-h`} className="text-title">
            What people say
          </h3>
          <ListenButton text={listenText} label="Listen to this" size="sm" />
        </div>
        {loadError && (
          <p role="alert" className="text-body text-md-error">
            {loadError}
          </p>
        )}
        {!loading && !loadError && posts.length === 0 && (
          <p className="text-body text-md-on-surface-variant">No posts here yet. Be the first to share how it went for you.</p>
        )}
        <ul className="space-y-4 list-none p-0 m-0">
          {posts.map((p) => (
            <Card as="li" key={p.post_id} className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-meta text-md-on-surface-variant">
                <span className="font-medium text-md-on-background">{p.anon_handle}</span>
                <span aria-hidden="true">·</span>
                <time dateTime={p.created_at}>{relativeTime(p.created_at)}</time>
                <Chip asSpan className="h-8 px-3 text-meta">
                  {p.drug_name}
                </Chip>
              </div>
              <p className="text-body">{p.body}</p>
              {p.side_effect_tags.length > 0 && (
                <ul className="flex flex-wrap gap-2 list-none p-0 m-0" aria-label="Tags">
                  {p.side_effect_tags.map((t) => (
                    <li key={t}>
                      <Chip asSpan className="h-8 px-3 text-meta bg-md-surface-container-low text-md-on-background">
                        {TAG_LABEL[t] ?? t}
                      </Chip>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </ul>
      </section>

      <PostForm handle={handle} selectedMed={selectedMed} medOptions={medOptions} onPosted={load} />

      <aside className="rounded-3xl bg-md-secondary-container text-md-on-secondary-container p-5 space-y-2">
        <p className="text-body">
          These are other people&rsquo;s experiences, not medical advice. If a side effect worries you, call your pharmacist or clinic.
        </p>
        <a href={MEDWATCH} target="_blank" rel="noreferrer" className="inline-block text-label text-md-primary underline underline-offset-4">
          Report a side effect to FDA MedWatch
        </a>
      </aside>
    </div>
  );
}

function PostForm({
  handle,
  selectedMed,
  medOptions,
  onPosted,
}: {
  handle: string;
  selectedMed: Med | null;
  medOptions: Med[];
  onPosted: () => void;
}) {
  const [med, setMed] = useState<Med | null>(selectedMed);
  const [body, setBody] = useState("");
  const [tags, setTags] = useState<SideEffectTag[]>([]);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [err, setErr] = useState("");
  const ids = useId();

  useEffect(() => {
    if (selectedMed) setMed(selectedMed);
  }, [selectedMed]);

  const options = useMemo(() => {
    const list = [...medOptions];
    if (med && !list.some((m) => m.rxcui === med.rxcui)) list.unshift(med);
    return list;
  }, [medOptions, med]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!med) {
      setErr("Pick the medicine you're talking about.");
      return;
    }
    const text = body.trim();
    if (text.length < 10) {
      setErr("Say a little more — at least 10 characters.");
      return;
    }
    setState("sending");
    try {
      const res = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rxcui: med.rxcui, drugName: med.name, body: text, tags, anonHandle: handle }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(data.error ?? "We couldn't post that. Please try again.");
        setState("idle");
        return;
      }
      setBody("");
      setTags([]);
      setState("sent");
      onPosted();
    } catch {
      setErr("We couldn't post that. Check your connection and try again.");
      setState("idle");
    }
  };

  const remaining = POST_MAX - body.length;

  return (
    <form onSubmit={submit} className="rounded-3xl bg-md-surface-container p-6 space-y-4 shadow-sm" aria-labelledby={`${ids}-h`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`${ids}-h`} className="text-title">
          Share how it went for you
        </h3>
        <p className="text-meta text-md-on-surface-variant">
          Posting as <span className="font-medium text-md-on-background">{handle}</span>
        </p>
      </div>

      <div>
        <label htmlFor={`${ids}-med`} className="block text-label text-md-on-surface-variant mb-1">
          Medicine
        </label>
        <select
          id={`${ids}-med`}
          required
          value={med?.rxcui ?? ""}
          onChange={(e) => setMed(options.find((m) => m.rxcui === e.target.value) ?? null)}
          className="w-full h-14 rounded-t-lg rounded-b-none bg-md-surface-container-low px-4 text-body text-md-on-background border-b-2 border-md-outline focus:border-md-primary transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-md-primary focus-visible:ring-offset-2"
        >
          <option value="">Choose a medicine</option>
          {options.map((m) => (
            <option key={m.rxcui} value={m.rxcui}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      <TextArea
        label="What happened for you?"
        placeholder="Nausea the first two weeks, then it settled once I took it with dinner."
        value={body}
        maxLength={POST_MAX}
        onChange={(e) => setBody(e.target.value.slice(0, POST_MAX))}
        hint={`${remaining} characters left. Your own experience only — no dose advice, no names, no contact details.`}
        error={err || undefined}
      />

      <fieldset>
        <legend className="text-label text-md-on-surface-variant mb-2">Tags (optional)</legend>
        <div className="flex flex-wrap gap-2">
          {SIDE_EFFECT_TAGS.map((t) => {
            const on = tags.includes(t);
            return (
              <label
                key={t}
                className={`inline-flex items-center gap-2 h-10 px-4 rounded-full text-label cursor-pointer transition-all duration-200 ease-md active:scale-95 hover:shadow-sm focus-within:ring-2 focus-within:ring-md-primary focus-within:ring-offset-2 ${
                  on ? "bg-md-primary text-md-on-primary" : "bg-md-secondary-container text-md-on-secondary-container"
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={on}
                  onChange={() => setTags((cur) => (on ? cur.filter((x) => x !== t) : [...cur, t]))}
                />
                <span aria-hidden="true">{on ? "✓" : "+"}</span>
                {TAG_LABEL[t]}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={state === "sending"}>
          <Send className="h-5 w-5" aria-hidden="true" />
          {state === "sending" ? "Sharing…" : "Share"}
        </Button>
        <p role="status" className="text-meta text-md-on-surface-variant">
          {state === "sent" && !err ? "Thanks — your post is up." : ""}
        </p>
      </div>
    </form>
  );
}
