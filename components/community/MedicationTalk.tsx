"use client";

import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { MessageSquare, Send } from "lucide-react";
import commonMeds from "@/data/common_meds.json";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { ListenButton } from "@/components/ui/ListenButton";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { PlainText } from "@/components/ui/PlainText";
import { Select, TextArea } from "@/components/ui/TextField";
import { shortName } from "@/lib/plainNames";
import { SIDE_EFFECT_TAGS, type CommunityPost, type Med, type SideEffectTag, type TopTerm } from "@/lib/types";

const HANDLE_KEY = "rxplain.community.handle";
const MEDWATCH = "https://www.fda.gov/safety/medwatch-fda-safety-information-and-adverse-event-reporting-program";
const POST_MAX = 500;

/** Medicines with seeded posts; listed first in the filter. */
const SEEDED_RXCUI = ["6809", "5640", "11289", "29046", "36437", "17767", "83367", "7646"];

/** Generic entries from data/common_meds.json (brand rows look like "Advil (ibuprofen)"). */
const ALL_MEDS: Med[] = (commonMeds as Med[]).filter((m) => !/\(/.test(m.name));
const MED_OPTIONS: { withPosts: Med[]; others: Med[] } = {
  withPosts: SEEDED_RXCUI.map((rx) => ALL_MEDS.find((m) => m.rxcui === rx)).filter((m): m is Med => !!m),
  others: ALL_MEDS.filter((m) => !SEEDED_RXCUI.includes(m.rxcui)).sort((a, b) => a.name.localeCompare(b.name)),
};
const findMed = (rxcui: string) => ALL_MEDS.find((m) => m.rxcui === rxcui) ?? null;

/** "Ibuprofen (Advil, Motrin)" for <option> text, where styling isn't possible. */
function optionLabel(m: Med) {
  const s = shortName(m);
  return s.brands.length ? `${s.generic} (${s.brands.join(", ")})` : s.generic;
}

/** Generic capitalized, brand aliases muted. */
function MedName({ med, brands = true }: { med: Pick<Med, "name" | "rxcui" | "ingredientName">; brands?: boolean }) {
  const s = shortName(med);
  return (
    <>
      <span>{s.generic}</span>
      {brands && s.brands.length > 0 && <span className="text-md-on-surface-variant font-normal"> · {s.brands.join(", ")}</span>}
    </>
  );
}

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

export function MedicationTalk({ className = "" }: { className?: string }) {
  const handle = useAnonHandle();
  const [selectedMed, setSelectedMed] = useState<Med | null>(null);
  const [term, setTerm] = useState<string | null>(null);
  const [terms, setTerms] = useState<TopTerm[]>([]);
  const [official, setOfficial] = useState<string | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const ids = useId();

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

  const selectedGeneric = selectedMed ? shortName(selectedMed).generic : null;

  const listenText = () => {
    const scope = selectedGeneric ? `for ${selectedGeneric}` : "for all medicines";
    const termLine = terms.length
      ? `Top terms ${scope}: ${terms.slice(0, 8).map((t) => `${t.term}, ${t.count}`).join("; ")}.`
      : `No posts yet ${scope}.`;
    const postLines = posts
      .slice(0, 3)
      .map(
        (p, i) =>
          `Post ${i + 1}, about ${shortName({ name: p.drug_name, rxcui: p.rxcui ?? "", ingredientName: p.drug_name }).generic}, ${relativeTime(p.created_at)}: ${p.body}`,
      );
    return [termLine, ...postLines, "These are other people's experiences, not medical advice."].join(" ");
  };

  return (
    <Panel className={className} aria-label="Medication talk">
      <PanelHeader
        icon={MessageSquare}
        title="Medication talk"
        subtitle="What people say about their own side effects. Experiences, not advice."
        actions={
          <>
            <Select
              label="Show posts about"
              hideLabel
              value={selectedMed?.rxcui ?? ""}
              onChange={(e) => {
                setSelectedMed(findMed(e.target.value));
                setTerm(null);
              }}
              className="max-w-[14rem]"
            >
              <option value="">All medicines</option>
              <optgroup label="With posts">
                {MED_OPTIONS.withPosts.map((m) => (
                  <option key={m.rxcui} value={m.rxcui}>
                    {optionLabel(m)}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Other common medicines">
                {MED_OPTIONS.others.map((m) => (
                  <option key={m.rxcui} value={m.rxcui}>
                    {optionLabel(m)}
                  </option>
                ))}
              </optgroup>
            </Select>
            <ListenButton getText={listenText} text="" size="sm" variant="outlined" label="Listen" />
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Left: top terms + official label */}
        <div className="lg:col-span-2 space-y-5 min-w-0">
          <section aria-labelledby={`${ids}-terms-h`} className="space-y-2">
            <h3 id={`${ids}-terms-h`} className="eyebrow">
              Top terms{selectedGeneric ? ` · ${selectedGeneric}` : ""}
            </h3>
            {terms.length === 0 ? (
              <p className="text-meta text-md-on-surface-variant">{loading ? "Loading…" : "No posts yet, so no terms to show."}</p>
            ) : (
              <ul className="flex flex-wrap gap-2 list-none p-0 m-0" aria-label="Most mentioned terms. Choose one to filter posts.">
                {terms.map((t) => (
                  <li key={t.term}>
                    <Chip
                      selected={term === t.term}
                      onClick={() => setTerm((cur) => (cur === t.term ? null : t.term))}
                      aria-label={`${t.term}, mentioned in ${t.count} ${t.count === 1 ? "post" : "posts"}${term === t.term ? ", selected" : ""}`}
                    >
                      {t.term}
                      <span className={term === t.term ? "text-md-on-primary/70" : "text-md-on-surface-variant"}>· {t.count}</span>
                    </Chip>
                  </li>
                ))}
              </ul>
            )}
            {term && (
              <p className="text-meta text-md-on-surface-variant">
                Showing posts that mention &ldquo;{term}&rdquo;.{" "}
                <button type="button" onClick={() => setTerm(null)} className="text-md-tertiary underline underline-offset-4 rounded">
                  Show all
                </button>
              </p>
            )}
          </section>

          <section aria-labelledby={`${ids}-official-h`} className="bg-md-surface-container-low rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 id={`${ids}-official-h`} className="eyebrow">
                From the label
              </h3>
              {official && (
                <ListenButton
                  text={`From the official label for ${selectedGeneric ?? "this medicine"}: ${official}`}
                  label="Listen: from the label"
                  iconOnly
                  size="sm"
                  variant="outlined"
                />
              )}
            </div>
            {official ? (
              <PlainText as="p" text={official} className="text-body" />
            ) : (
              <p className="text-meta text-md-on-surface-variant">
                {selectedMed ? "No label text on file for this medicine yet." : "Pick a medicine to see what its official label lists as common side effects."}
              </p>
            )}
            <p className="text-meta text-md-on-surface-variant">Source: openFDA drug label, adverse reactions section.</p>
          </section>
        </div>

        {/* Right: post form + list */}
        <div className="lg:col-span-3 space-y-4 min-w-0">
          <PostForm handle={handle} selectedMed={selectedMed} onPosted={load} />

          <p className="text-meta text-md-on-surface-variant">
            If a side effect worries you, call your pharmacist or clinic.{" "}
            <a href={MEDWATCH} target="_blank" rel="noreferrer" className="text-md-tertiary underline underline-offset-4">
              Report a side effect to FDA MedWatch
            </a>
            .
          </p>

          <section aria-labelledby={`${ids}-posts-h`} aria-live="polite" aria-busy={loading} className="space-y-2">
            <h3 id={`${ids}-posts-h`} className="eyebrow">
              What people say
            </h3>
            {loadError && (
              <p role="alert" className="text-meta text-md-error">
                {loadError}
              </p>
            )}
            {!loading && !loadError && posts.length === 0 && (
              <p className="text-meta text-md-on-surface-variant">No posts here yet. Be the first to share how it went for you.</p>
            )}
            {posts.length > 0 && (
              <ul className="space-y-3 list-none p-0 m-0 max-h-[60vh] overflow-y-auto pr-1">
                {posts.map((p) => (
                  <Card as="li" key={p.post_id} dense className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-meta text-md-on-surface-variant">
                      <Chip asSpan className="h-7 px-2.5">
                        {shortName({ name: p.drug_name, rxcui: p.rxcui ?? "", ingredientName: p.drug_name }).generic}
                      </Chip>
                      <span className="font-medium text-md-on-background">{p.anon_handle}</span>
                      <span aria-hidden="true">·</span>
                      <time dateTime={p.created_at}>{relativeTime(p.created_at)}</time>
                    </div>
                    <PlainText as="p" text={p.body} className="text-body" />
                    {p.side_effect_tags.length > 0 && (
                      <ul className="flex flex-wrap gap-2 list-none p-0 m-0" aria-label="Tags">
                        {p.side_effect_tags.map((t) => (
                          <li key={t}>
                            <Chip asSpan className="h-7 px-2.5 bg-md-surface-container-low">
                              {TAG_LABEL[t] ?? t}
                            </Chip>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </Panel>
  );
}

function PostForm({ handle, selectedMed, onPosted }: { handle: string; selectedMed: Med | null; onPosted: () => void }) {
  const [med, setMed] = useState<Med | null>(selectedMed);
  const [body, setBody] = useState("");
  const [tags, setTags] = useState<SideEffectTag[]>([]);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [err, setErr] = useState("");
  const ids = useId();

  useEffect(() => {
    if (selectedMed) setMed(selectedMed);
  }, [selectedMed]);

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
        body: JSON.stringify({ rxcui: med.rxcui, drugName: med.ingredientName || med.name, body: text, tags, anonHandle: handle }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        // 422 carries the moderation reason as a plain sentence; shown inline under the text area.
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
    <form onSubmit={submit} className="space-y-3" aria-labelledby={`${ids}-h`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`${ids}-h`} className="eyebrow">
          Share how it went for you
        </h3>
        <Select label="Medicine" hideLabel required value={med?.rxcui ?? ""} onChange={(e) => setMed(findMed(e.target.value))} className="max-w-[14rem]">
          <option value="">Choose a medicine</option>
          <optgroup label="With posts">
            {MED_OPTIONS.withPosts.map((m) => (
              <option key={m.rxcui} value={m.rxcui}>
                {optionLabel(m)}
              </option>
            ))}
          </optgroup>
          <optgroup label="Other common medicines">
            {MED_OPTIONS.others.map((m) => (
              <option key={m.rxcui} value={m.rxcui}>
                {optionLabel(m)}
              </option>
            ))}
          </optgroup>
        </Select>
      </div>

      <TextArea
        label="What happened for you?"
        hideLabel
        placeholder="What happened for you? e.g. Nausea the first two weeks, then it settled once I took it with dinner."
        value={body}
        maxLength={POST_MAX}
        onChange={(e) => setBody(e.target.value.slice(0, POST_MAX))}
        hint={`${remaining} left. Your own experience only — no dose advice, no names, no contact details.`}
        error={err || undefined}
        className="[&_textarea]:min-h-20"
      />

      <fieldset>
        <legend className="sr-only">Tags (optional)</legend>
        <div className="flex flex-wrap gap-2">
          {SIDE_EFFECT_TAGS.map((t) => {
            const on = tags.includes(t);
            return (
              <label
                key={t}
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-meta font-medium cursor-pointer border transition-all duration-200 ease-md active:scale-95 focus-within:ring-2 focus-within:ring-md-primary focus-within:ring-offset-2 ${
                  on ? "bg-md-primary text-md-on-primary border-md-primary" : "bg-md-surface-container text-md-on-background border-md-outline hover:bg-md-secondary-container"
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-meta text-md-on-surface-variant">
          Posting as <span className="font-medium text-md-on-background">{handle}</span>
          {med && (
            <>
              {" "}
              about <MedName med={med} brands={false} />
            </>
          )}
        </p>
        <div className="flex items-center gap-3">
          <p role="status" className="text-meta text-md-on-surface-variant">
            {state === "sent" && !err ? "Thanks — your post is up." : ""}
          </p>
          <Button type="submit" size="sm" disabled={state === "sending"}>
            <Send className="h-4 w-4" aria-hidden="true" />
            {state === "sending" ? "Sharing…" : "Share"}
          </Button>
        </div>
      </div>
    </form>
  );
}
