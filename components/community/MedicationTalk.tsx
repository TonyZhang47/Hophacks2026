"use client";

import {
  useCallback,
  useEffect,
  useId,
  useState,
  useRef,
  type FormEvent,
} from "react";
import { MedicinePicker } from "@/components/community/MedicinePicker";
import { useLang, type Lang } from "@/components/LanguageContext";
import { MessageSquare, Send } from "lucide-react";
import commonMeds from "@/data/common_meds.json";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { ListenButton } from "@/components/ui/ListenButton";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { PlainText } from "@/components/ui/PlainText";
import { TextArea } from "@/components/ui/TextField";
import { shortName } from "@/lib/plainNames";
import {
  SIDE_EFFECT_TAGS,
  type CommunityPost,
  type Med,
  type SideEffectTag,
  type TopTerm,
} from "@/lib/types";

const HANDLE_KEY = "rxplain.community.handle";
const MEDWATCH =
  "https://www.fda.gov/safety/medwatch-fda-safety-information-and-adverse-event-reporting-program";
const POST_MAX = 500;

/** Medicines with seeded posts; listed first in the filter. */
const SEEDED_RXCUI = [
  "6809",
  "5640",
  "11289",
  "29046",
  "36437",
  "17767",
  "83367",
  "7646",
];

/** Generic entries from data/common_meds.json (brand rows look like "Advil (ibuprofen)"). */
const ALL_MEDS: Med[] = (commonMeds as Med[]).filter((m) => !/\(/.test(m.name));
const MED_OPTIONS: { withPosts: Med[]; others: Med[] } = {
  withPosts: SEEDED_RXCUI.map((rx) =>
    ALL_MEDS.find((m) => m.rxcui === rx),
  ).filter((m): m is Med => !!m),
  others: ALL_MEDS.filter((m) => !SEEDED_RXCUI.includes(m.rxcui)).sort((a, b) =>
    a.name.localeCompare(b.name),
  ),
};
const findMed = (rxcui: string) =>
  ALL_MEDS.find((m) => m.rxcui === rxcui) ?? null;

/** "Ibuprofen (Advil, Motrin)" for <option> text, where styling isn't possible. */
function optionLabel(m: Med) {
  const s = shortName(m);
  return s.brands.length ? `${s.generic} (${s.brands.join(", ")})` : s.generic;
}

/** Generic capitalized, brand aliases muted. */
function MedName({
  med,
  brands = true,
}: {
  med: Pick<Med, "name" | "rxcui" | "ingredientName">;
  brands?: boolean;
}) {
  const s = shortName(med);
  return (
    <>
      <span>{s.generic}</span>
      {brands && s.brands.length > 0 && (
        <span className="text-md-on-surface-variant font-normal">
          {" "}
          · {s.brands.join(", ")}
        </span>
      )}
    </>
  );
}

const ADJECTIVES = [
  "quiet",
  "gentle",
  "brave",
  "sunny",
  "mellow",
  "calm",
  "steady",
  "patient",
  "humble",
  "hopeful",
  "tender",
  "bright",
  "cozy",
  "wandering",
  "kind",
];
const ANIMALS = [
  "otter",
  "heron",
  "sparrow",
  "badger",
  "fox",
  "walrus",
  "crane",
  "moose",
  "lynx",
  "finch",
  "owl",
  "tortoise",
  "beaver",
  "elk",
  "seal",
];

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

function relativeTime(iso: string, lang: Lang): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60_000);
  if (lang === "es") {
    if (min < 1) return "ahora mismo";
    if (min < 60) return `hace ${min} ${min === 1 ? "minuto" : "minutos"}`;
    const h = Math.round(min / 60);
    if (h < 24) return `hace ${h} ${h === 1 ? "hora" : "horas"}`;
    const d = Math.round(h / 24);
    if (d < 7) return `hace ${d} ${d === 1 ? "día" : "días"}`;
    const w = Math.round(d / 7);
    if (w < 9) return `hace ${w} ${w === 1 ? "semana" : "semanas"}`;
    const mo = Math.round(d / 30);
    return `hace ${mo} ${mo === 1 ? "mes" : "meses"}`;
  }
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

const TAG_LABEL: Record<Lang, Record<SideEffectTag, string>> = {
  en: {
    nausea: "Nausea",
    dizziness: "Dizziness",
    sleep: "Sleep",
    appetite: "Appetite",
    headache: "Headache",
    stomach: "Stomach",
    mood: "Mood",
    other: "Other",
  },
  es: {
    nausea: "Náuseas",
    dizziness: "Mareo",
    sleep: "Sueño",
    appetite: "Apetito",
    headache: "Dolor de cabeza",
    stomach: "Estómago",
    mood: "Ánimo",
    other: "Otro",
  },
};

const T = {
  en: {
    title: "Medication talk",
    subtitle: "What people say about their own side effects. Experiences, not advice.",
    listen: "Listen",
    selectedMed: "Selected medicine",
    topTerms: (name: string) => `Top terms for ${name}`,
    allMeds: "your selected medicine",
    loading: "Loading…",
    noTerms: "No community terms for this medicine yet. Choose another medicine or share your experience.",
    termsAria: "Most mentioned terms. Choose one to filter posts.",
    mentioned: (n: number) => `mentioned in ${n} ${n === 1 ? "post" : "posts"}`,
    selected: ", selected",
    showing: (term: string) => `Showing posts that mention “${term}”.`,
    showAll: "Show all",
    fromLabel: "From the label",
    listenLabel: "Listen: from the label",
    officialFor: (name: string) => `From the official label for ${name}:`,
    thisMed: "this medicine",
    noLabelYet: "No label text on file for this medicine yet.",
    pickMed: "Pick a medicine to see what its official label lists as common side effects.",
    source: "Source: openFDA drug label, adverse reactions section.",
    ifWorries: "If a side effect worries you, call your pharmacist or clinic.",
    report: "Report a side effect to FDA MedWatch",
    whatPeople: "What people say",
    loadError: "We couldn't load posts right now. Please try again in a moment.",
    noPosts: "No posts here yet. Be the first to share how it went for you.",
    tags: "Tags",
    share: "Share how it went for you",
    postMed: "Medicine for your post",
    whatHappened: "What happened for you?",
    placeholder:
      "What happened for you? e.g. Nausea the first two weeks, then it settled once I took it with dinner.",
    hint: (n: number) => `${n} left. Your own experience only — no dose advice, no names, no contact details.`,
    tagsLegend: "Tags (optional)",
    postingAs: "Posting as",
    about: "about",
    thanks: "Thanks — your post is up.",
    sharing: "Sharing…",
    shareBtn: "Share",
    pickMedErr: "Pick the medicine you're talking about.",
    sayMore: "Say a little more — at least 10 characters.",
    postFail: "We couldn't post that. Please try again.",
    postNet: "We couldn't post that. Check your connection and try again.",
    topTermsListen: (scope: string, line: string) => `Top terms ${scope}: ${line}.`,
    noPostsListen: (scope: string) => `No posts yet ${scope}.`,
    forMed: (name: string) => `for ${name}`,
    forAll: "for all medicines",
    postN: (i: number, drug: string, when: string, body: string) =>
      `Post ${i}, about ${drug}, ${when}: ${body}`,
    notAdvice: "These are other people's experiences, not medical advice.",
    panel: "Medication talk",
  },
  es: {
    title: "Conversación sobre medicamentos",
    subtitle: "Lo que las personas dicen de sus propios efectos secundarios. Experiencias, no consejos.",
    listen: "Escuchar",
    selectedMed: "Medicamento seleccionado",
    topTerms: (name: string) => `Términos más mencionados para ${name}`,
    allMeds: "el medicamento seleccionado",
    loading: "Cargando…",
    noTerms: "Aún no hay términos de la comunidad para este medicamento. Elija otro o comparta su experiencia.",
    termsAria: "Términos más mencionados. Elija uno para filtrar las publicaciones.",
    mentioned: (n: number) => `mencionado en ${n} ${n === 1 ? "publicación" : "publicaciones"}`,
    selected: ", seleccionado",
    showing: (term: string) => `Mostrando publicaciones que mencionan “${term}”.`,
    showAll: "Mostrar todas",
    fromLabel: "De la etiqueta",
    listenLabel: "Escuchar: de la etiqueta",
    officialFor: (name: string) => `De la etiqueta oficial de ${name}:`,
    thisMed: "este medicamento",
    noLabelYet: "Aún no hay texto de etiqueta registrado para este medicamento.",
    pickMed: "Elija un medicamento para ver los efectos secundarios comunes de su etiqueta oficial.",
    source: "Fuente: etiqueta de medicamentos de openFDA, sección de reacciones adversas.",
    ifWorries: "Si un efecto secundario le preocupa, llame a su farmacéutico o clínica.",
    report: "Informar un efecto secundario a FDA MedWatch",
    whatPeople: "Lo que dice la gente",
    loadError: "No pudimos cargar las publicaciones ahora. Inténtelo de nuevo en un momento.",
    noPosts: "Aún no hay publicaciones. Sea la primera persona en contar cómo le fue.",
    tags: "Etiquetas",
    share: "Cuente cómo le fue",
    postMed: "Medicamento de su publicación",
    whatHappened: "¿Qué le pasó a usted?",
    placeholder:
      "¿Qué le pasó? ej. Náuseas las primeras dos semanas; luego se calmaron cuando lo tomé con la cena.",
    hint: (n: number) => `${n} restantes. Solo su experiencia — sin consejos de dosis, sin nombres, sin datos de contacto.`,
    tagsLegend: "Etiquetas (opcional)",
    postingAs: "Publicando como",
    about: "sobre",
    thanks: "Gracias — su publicación ya está visible.",
    sharing: "Compartiendo…",
    shareBtn: "Compartir",
    pickMedErr: "Elija el medicamento del que habla.",
    sayMore: "Cuente un poco más — al menos 10 caracteres.",
    postFail: "No pudimos publicar eso. Inténtelo de nuevo.",
    postNet: "No pudimos publicar eso. Revise su conexión e inténtelo de nuevo.",
    topTermsListen: (scope: string, line: string) => `Términos más mencionados ${scope}: ${line}.`,
    noPostsListen: (scope: string) => `Aún no hay publicaciones ${scope}.`,
    forMed: (name: string) => `para ${name}`,
    forAll: "para todos los medicamentos",
    postN: (i: number, drug: string, when: string, body: string) =>
      `Publicación ${i}, sobre ${drug}, ${when}: ${body}`,
    notAdvice: "Estas son experiencias de otras personas, no consejos médicos.",
    panel: "Conversación sobre medicamentos",
  },
} as const;

export function MedicationTalk({ className = "" }: { className?: string }) {
  const { lang } = useLang();
  const t = T[lang];
  const handle = useAnonHandle();
  const [selectedMed, setSelectedMed] = useState<Med | null>(findMed("6809"));
  const [term, setTerm] = useState<string | null>(null);
  const [terms, setTerms] = useState<TopTerm[]>([]);
  const [official, setOfficial] = useState<string | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const ids = useId();
  const requestVersion = useRef(0);

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setTerms([]);
    setPosts([]);
    setOfficial(null);
    setLoadError("");
    const rx =
      selectedMed?.rxcui && !selectedMed.rxcui.startsWith("manual:")
        ? selectedMed.rxcui
        : undefined;
    const tp = new URLSearchParams();
    if (rx) {
      tp.set("rxcui", rx);
      tp.set("name", selectedMed?.ingredientName ?? selectedMed?.name ?? "");
    }
    if (!rx && selectedMed)
      tp.set("name", selectedMed.ingredientName || selectedMed.name);
    const pp = new URLSearchParams();
    if (!rx && selectedMed)
      pp.set("name", selectedMed.ingredientName || selectedMed.name);
    if (rx) pp.set("rxcui", rx);
    if (term) pp.set("term", term);
    pp.set("limit", "30");
    try {
      const [tRes, pRes] = await Promise.all([
        fetch(`/api/community/terms?${tp}`),
        fetch(`/api/community/posts?${pp}`),
      ]);
      if (!tRes.ok || !pRes.ok) throw new Error("load");
      const t = (await tRes.json()) as {
        terms: TopTerm[];
        official: string | null;
      };
      const p = (await pRes.json()) as { posts: CommunityPost[] };
      if (version !== requestVersion.current) return;
      setTerms(t.terms);
      setOfficial(t.official);
      setPosts(p.posts);
    } catch {
      if (version !== requestVersion.current) return;
      setLoadError(t.loadError);
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [selectedMed, term, t.loadError]);

  useEffect(() => {
    void load();
    return () => {
      requestVersion.current++;
    };
  }, [load]);

  const selectedGeneric = selectedMed ? shortName(selectedMed).generic : null;

  const listenText = () => {
    const scope = selectedGeneric ? t.forMed(selectedGeneric) : t.forAll;
    const termLine = terms.length
      ? t.topTermsListen(
          scope,
          terms
            .slice(0, 8)
            .map((x) => `${x.term}, ${x.count}`)
            .join("; "),
        )
      : t.noPostsListen(scope);
    const postLines = posts
      .slice(0, 3)
      .map((p, i) =>
        t.postN(
          i + 1,
          shortName({ name: p.drug_name, rxcui: p.rxcui ?? "", ingredientName: p.drug_name }).generic,
          relativeTime(p.created_at, lang),
          p.body,
        ),
      );
    return [termLine, ...postLines, t.notAdvice].join(" ");
  };

  return (
    <Panel className={className} aria-label={t.panel}>
      <PanelHeader
        icon={MessageSquare}
        title={t.title}
        subtitle={t.subtitle}
        actions={
          <>
            <MedicinePicker
              label={t.selectedMed}
              value={selectedMed}
              onChange={(m) => {
                setSelectedMed(m);
                setTerm(null);
              }}
            />
            <ListenButton
              getText={listenText}
              text=""
              size="sm"
              variant="outlined"
              label={t.listen}
            />
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Left: top terms + official label */}
        <div className="lg:col-span-2 space-y-5 min-w-0">
          <section aria-labelledby={`${ids}-terms-h`} className="space-y-2">
            <h3 id={`${ids}-terms-h`} className="eyebrow">
              {t.topTerms(selectedGeneric || t.allMeds)}
            </h3>
            {terms.length === 0 ? (
              <p className="text-meta text-md-on-surface-variant">
                {loading ? t.loading : t.noTerms}
              </p>
            ) : (
              <ul
                className="flex flex-wrap gap-2 list-none p-0 m-0"
                aria-label={t.termsAria}
              >
                {terms.map((item) => (
                  <li key={item.term}>
                    <Chip
                      selected={term === item.term}
                      onClick={() =>
                        setTerm((cur) => (cur === item.term ? null : item.term))
                      }
                      aria-label={`${item.term}, ${t.mentioned(item.count)}${term === item.term ? t.selected : ""}`}
                    >
                      {item.term}
                      <span
                        className={
                          term === item.term
                            ? "text-md-on-primary/70"
                            : "text-md-on-surface-variant"
                        }
                      >
                        · {item.count}
                      </span>
                    </Chip>
                  </li>
                ))}
              </ul>
            )}
            {term && (
              <p className="text-meta text-md-on-surface-variant">
                {t.showing(term)}{" "}
                <button
                  type="button"
                  onClick={() => setTerm(null)}
                  className="text-md-tertiary underline underline-offset-4 rounded"
                >
                  {t.showAll}
                </button>
              </p>
            )}
          </section>

          <section
            aria-labelledby={`${ids}-official-h`}
            className="bg-md-surface-container-low rounded-xl p-4 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 id={`${ids}-official-h`} className="eyebrow">
                {t.fromLabel}
              </h3>
              {official && (
                <ListenButton
                  text={`${t.officialFor(selectedGeneric ?? t.thisMed)} ${official}`}
                  label={t.listenLabel}
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
                {selectedMed ? t.noLabelYet : t.pickMed}
              </p>
            )}
            <p className="text-meta text-md-on-surface-variant">
              {t.source}
            </p>
          </section>
        </div>

        {/* Right: post form + list */}
        <div className="lg:col-span-3 space-y-4 min-w-0">
          <PostForm handle={handle} selectedMed={selectedMed} onPosted={load} lang={lang} />

          <p className="text-meta text-md-on-surface-variant">
            {t.ifWorries}{" "}
            <a
              href={MEDWATCH}
              target="_blank"
              rel="noreferrer"
              className="text-md-tertiary underline underline-offset-4"
            >
              {t.report}
            </a>
            .
          </p>

          <section
            aria-labelledby={`${ids}-posts-h`}
            aria-live="polite"
            aria-busy={loading}
            className="space-y-2"
          >
            <h3 id={`${ids}-posts-h`} className="eyebrow">
              {t.whatPeople}
            </h3>
            {loadError && (
              <p role="alert" className="text-meta text-md-error">
                {loadError}
              </p>
            )}
            {!loading && !loadError && posts.length === 0 && (
              <p className="text-meta text-md-on-surface-variant">
                {t.noPosts}
              </p>
            )}
            {posts.length > 0 && (
              <ul className="space-y-3 list-none p-0 m-0 max-h-[60vh] overflow-y-auto pr-1">
                {posts.map((p) => (
                  <Card as="li" key={p.post_id} dense className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-meta text-md-on-surface-variant">
                      <Chip asSpan className="h-7 px-2.5">
                        {
                          shortName({
                            name: p.drug_name,
                            rxcui: p.rxcui ?? "",
                            ingredientName: p.drug_name,
                          }).generic
                        }
                      </Chip>
                      <span className="font-medium text-md-on-background">
                        {p.anon_handle}
                      </span>
                      <span aria-hidden="true">·</span>
                      <time dateTime={p.created_at}>
                        {relativeTime(p.created_at, lang)}
                      </time>
                    </div>
                    <PlainText as="p" text={p.body} className="text-body" />
                    {p.side_effect_tags.length > 0 && (
                      <ul
                        className="flex flex-wrap gap-2 list-none p-0 m-0"
                        aria-label={t.tags}
                      >
                        {p.side_effect_tags.map((tag) => (
                          <li key={tag}>
                            <Chip
                              asSpan
                              className="h-7 px-2.5 bg-md-surface-container-low"
                            >
                              {TAG_LABEL[lang][tag] ?? tag}
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

function PostForm({
  handle,
  selectedMed,
  onPosted,
  lang,
}: {
  handle: string;
  selectedMed: Med | null;
  onPosted: () => void;
  lang: Lang;
}) {
  const t = T[lang];
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
      setErr(t.pickMedErr);
      return;
    }
    const text = body.trim();
    if (text.length < 10) {
      setErr(t.sayMore);
      return;
    }
    setState("sending");
    try {
      const res = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rxcui: med.rxcui.startsWith("manual:") ? undefined : med.rxcui,
          drugName: med.ingredientName || med.name,
          body: text,
          tags,
          anonHandle: handle,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        // 422 carries the moderation reason as a plain sentence; shown inline under the text area.
        setErr(data.error ?? t.postFail);
        setState("idle");
        return;
      }
      setBody("");
      setTags([]);
      setState("sent");
      onPosted();
    } catch {
      setErr(t.postNet);
      setState("idle");
    }
  };

  const remaining = POST_MAX - body.length;

  return (
    <form onSubmit={submit} className="space-y-3" aria-labelledby={`${ids}-h`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`${ids}-h`} className="eyebrow">
          {t.share}
        </h3>
        <MedicinePicker
          label={t.postMed}
          value={med}
          onChange={setMed}
        />
      </div>

      <TextArea
        label={t.whatHappened}
        hideLabel
        placeholder={t.placeholder}
        value={body}
        maxLength={POST_MAX}
        onChange={(e) => setBody(e.target.value.slice(0, POST_MAX))}
        hint={t.hint(remaining)}
        error={err || undefined}
        className="[&_textarea]:min-h-20"
      />

      <fieldset>
        <legend className="sr-only">{t.tagsLegend}</legend>
        <div className="flex flex-wrap gap-2">
          {SIDE_EFFECT_TAGS.map((tag) => {
            const on = tags.includes(tag);
            return (
              <label
                key={tag}
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-meta font-medium cursor-pointer border transition-all duration-200 ease-md active:scale-95 focus-within:ring-2 focus-within:ring-md-primary focus-within:ring-offset-2 ${
                  on
                    ? "bg-md-primary text-md-on-primary border-md-primary"
                    : "bg-md-surface-container text-md-on-background border-md-outline hover:bg-md-secondary-container"
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={on}
                  onChange={() =>
                    setTags((cur) =>
                      on ? cur.filter((x) => x !== tag) : [...cur, tag],
                    )
                  }
                />
                <span aria-hidden="true">{on ? "✓" : "+"}</span>
                {TAG_LABEL[lang][tag]}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-meta text-md-on-surface-variant">
          {t.postingAs}{" "}
          <span className="font-medium text-md-on-background">{handle}</span>
          {med && (
            <>
              {" "}
              {t.about} <MedName med={med} brands={false} />
            </>
          )}
        </p>
        <div className="flex items-center gap-3">
          <p role="status" className="text-meta text-md-on-surface-variant">
            {state === "sent" && !err ? t.thanks : ""}
          </p>
          <Button type="submit" size="sm" disabled={state === "sending"}>
            <Send className="h-4 w-4" aria-hidden="true" />
            {state === "sending" ? t.sharing : t.shareBtn}
          </Button>
        </div>
      </div>
    </form>
  );
}
