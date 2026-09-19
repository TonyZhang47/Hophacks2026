"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  useRef,
  type FormEvent,
} from "react";
import { MedicinePicker } from "@/components/community/MedicinePicker";
import { useTranslated } from "@/components/community/useTranslated";
import { useLang, type Lang } from "@/components/LanguageContext";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { ListenButton } from "@/components/ui/ListenButton";
import { Panel } from "@/components/ui/Panel";
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

/** Generic name, capitalized. Brand aliases are never shown on this page. */
function MedName({
  med,
}: {
  med: Pick<Med, "name" | "rxcui" | "ingredientName">;
  /** Kept for callers; brands are no longer rendered. */
  brands?: boolean;
}) {
  return <span>{shortName(med).generic}</span>;
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
    title: "Community",
    subtitle: "What people say about their own side effects. Experiences, not advice.",
    listen: "Listen",
    selectedMed: "Which medicine's posts?",
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
    seeMore: "See more",
    seeLess: "See less",
    summarizeNow: "Summarize now",
    summarizing: "Summarizing…",
    summarizeError: "We couldn't summarize that right now. The label text is still below.",
    aiDisclaimer: "This summary is written by AI and may not be accurate. It is not medical advice.",
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
    hint: (n: number) => `${n} characters left. Your own experience only — no dose advice, no names, no contact details.`,
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
    panel: "Community",
    seeOriginal: "See original",
    seeTranslation: "See translation",
    autoTranslated: "Automatic translation. It may contain errors — see the original if in doubt.",
  },
  es: {
    title: "Comunidad",
    subtitle: "Lo que las personas dicen de sus propios efectos secundarios. Experiencias, no consejos.",
    listen: "Escuchar",
    selectedMed: "¿De qué medicamento quiere ver publicaciones?",
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
    seeMore: "Ver más",
    seeLess: "Ver menos",
    summarizeNow: "Resumir ahora",
    summarizing: "Resumiendo…",
    summarizeError: "No pudimos resumir eso ahora. El texto de la etiqueta sigue abajo.",
    aiDisclaimer: "Este resumen lo escribe una IA y puede no ser exacto. No es consejo médico.",
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
    hint: (n: number) => `${n} caracteres restantes. Solo su experiencia — sin consejos de dosis, sin nombres, sin datos de contacto.`,
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
    panel: "Comunidad",
    seeOriginal: "Ver original",
    seeTranslation: "Ver traducción",
    autoTranslated: "Traducción automática. Puede contener errores — vea el original si tiene dudas.",
  },
} as const;

export function MedicationTalk({ className = "" }: { className?: string }) {
  const { lang } = useLang();
  const t = T[lang];
  const handle = useAnonHandle();
  const [selectedMed, setSelectedMed] = useState<Med | null>(null);
  const [term, setTerm] = useState<string | null>(null);
  const [terms, setTerms] = useState<TopTerm[]>([]);
  const [official, setOfficial] = useState<string | null>(null);
  const [officialFull, setOfficialFull] = useState<string | null>(null);
  const [officialHasMore, setOfficialHasMore] = useState(false);
  const [labelExpanded, setLabelExpanded] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  /** Language the summary was generated in (the API already honours `lang`). */
  const [summaryLang, setSummaryLang] = useState<Lang>("en");
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  /** Item ids ("label", "summary", "post:<id>") the reader flipped back to the English original. */
  const [showOriginal, setShowOriginal] = useState<Set<string>>(() => new Set());
  const ids = useId();
  const requestVersion = useRef(0);

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setTerms([]);
    setOfficial(null);
    setOfficialFull(null);
    setOfficialHasMore(false);
    setLabelExpanded(false);
    setSummary(null);
    setSummarizing(false);
    setSummaryError("");
    setPosts([]);
    setLoadError("");
    if (!selectedMed) {
      setLoading(false);
      return;
    }
    setLoading(true);
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
    tp.set("limit", "5");
    try {
      const [tRes, pRes] = await Promise.all([
        fetch(`/api/community/terms?${tp}`),
        fetch(`/api/community/posts?${pp}`),
      ]);
      if (!tRes.ok || !pRes.ok) throw new Error("load");
      const termsJson = (await tRes.json()) as {
        terms: TopTerm[];
        official: string | null;
        officialFull?: string | null;
        officialHasMore?: boolean;
      };
      const p = (await pRes.json()) as { posts: CommunityPost[] };
      if (version !== requestVersion.current) return;
      setTerms((termsJson.terms ?? []).slice(0, 5));
      const preview =
        typeof termsJson.official === "string" && termsJson.official.trim()
          ? termsJson.official.trim()
          : null;
      let full =
        typeof termsJson.officialFull === "string" && termsJson.officialFull.trim()
          ? termsJson.officialFull.trim()
          : null;
      let hasMore =
        !!termsJson.officialHasMore && !!preview && !!(full && full.length > preview.length);
      if (termsJson.officialHasMore && preview && !full) {
        const extra = new URLSearchParams(tp);
        extra.set("full", "1");
        const fRes = await fetch(`/api/community/terms?${extra}`);
        if (fRes.ok) {
          const more = (await fRes.json()) as { official?: string | null; officialFull?: string | null };
          const got =
            (typeof more.officialFull === "string" && more.officialFull.trim()) ||
            (typeof more.official === "string" && more.official.trim()) ||
            "";
          if (got && version === requestVersion.current) {
            full = got;
            hasMore = got.length > preview.length;
          }
        }
      }
      if (version !== requestVersion.current) return;
      setOfficial(preview);
      setOfficialFull(full);
      setOfficialHasMore(hasMore || !!(full && preview && full.length > preview.length));
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
  const visibleOfficial =
    (labelExpanded && officialFull ? officialFull : official) || null;

  // --- Spanish view of dynamic English content (posts, label text, summary) ---
  const es = lang === "es";
  // A summary requested while in Spanish is already Spanish; only translate an English one.
  const summaryNeedsTr = !!summary && summaryLang === "en";
  const trStrings = useMemo(() => {
    if (!es) return [];
    const out: string[] = [];
    if (official) out.push(official);
    if (officialFull && officialFull !== official) out.push(officialFull);
    if (summaryNeedsTr && summary) out.push(summary);
    for (const p of posts) out.push(p.body);
    return out;
  }, [es, official, officialFull, summary, summaryNeedsTr, posts]);
  const { get: tr } = useTranslated(trStrings, es);

  /**
   * What to show for one item: the Spanish translation when we have one and the reader has
   * not asked for the original; otherwise the English text (also while a translation is pending).
   */
  const view = (id: string, text: string) => {
    const translated = es ? tr(text) : undefined;
    const original = !translated || showOriginal.has(id);
    return {
      text: original ? text : translated,
      hasTranslation: !!translated,
      /** True when the displayed text is the English source (glossary applies). */
      isEnglish: original,
    };
  };
  const toggleOriginal = (id: string) =>
    setShowOriginal((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const labelView = visibleOfficial ? view("label", visibleOfficial) : null;
  const summaryView = summary ? view("summary", summary) : null;

  const listenText = () => {
    const scope = selectedGeneric ? t.forMed(selectedGeneric) : t.forAll;
    const officialLine = labelView
      ? `${t.officialFor(selectedGeneric || t.thisMed)} ${labelView.text}`
      : selectedMed
        ? t.noLabelYet
        : t.pickMed;
    const termLine = terms.length
      ? t.topTermsListen(
          scope,
          terms
            .slice(0, 5)
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
          view(`post:${p.post_id}`, p.body).text,
        ),
      );
    return [officialLine, termLine, ...postLines, t.notAdvice].join(" ");
  };

  const requestSummary = async () => {
    if (!selectedMed || summarizing) return;
    setSummarizing(true);
    setSummaryError("");
    try {
      const rx =
        selectedMed.rxcui && !selectedMed.rxcui.startsWith("manual:")
          ? selectedMed.rxcui
          : undefined;
      const res = await fetch("/api/community/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rxcui: rx,
          name: selectedMed.ingredientName || selectedMed.name,
          lang,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        summary?: string;
        error?: string;
      };
      if (!res.ok || !data.summary?.trim()) {
        setSummaryError(data.error || t.summarizeError);
        return;
      }
      setSummary(data.summary.trim());
      setSummaryLang(lang);
    } catch {
      setSummaryError(t.summarizeError);
    } finally {
      setSummarizing(false);
    }
  };

  const shownTerms = terms.slice(0, 5);

  return (
    <div className={`space-y-6 ${className ?? ""}`} aria-label={t.panel}>
      <Panel>
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
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
          </div>

          <div
            aria-labelledby={`${ids}-label-h`}
            className="rounded-lg bg-md-surface-container-low border border-md-outline px-4 py-3 space-y-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id={`${ids}-label-h`} className="eyebrow">
                {t.fromLabel}
              </h3>
              {labelView && (
                <ListenButton
                  text={`${t.officialFor(selectedGeneric || t.thisMed)} ${labelView.text}`}
                  label={t.listenLabel}
                  size="sm"
                  variant="outlined"
                />
              )}
            </div>
            {loading ? (
              <p className="text-meta text-md-on-surface-variant">{t.loading}</p>
            ) : labelView ? (
              <>
                <p className="text-meta text-md-on-surface-variant">
                  {t.officialFor(selectedGeneric || t.thisMed)}
                </p>
                <p className="text-body text-md-on-background">{labelView.text}</p>
                {labelView.hasTranslation && !labelView.isEnglish && (
                  <p className="text-meta text-md-on-surface-variant">{t.autoTranslated}</p>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  {officialHasMore && (
                    <button
                      type="button"
                      onClick={() => setLabelExpanded((on) => !on)}
                      className="text-meta font-medium text-md-tertiary underline underline-offset-4 rounded"
                    >
                      {labelExpanded ? t.seeLess : t.seeMore}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void requestSummary()}
                    disabled={summarizing}
                    className="text-meta font-medium text-md-tertiary underline underline-offset-4 rounded disabled:opacity-50"
                  >
                    {summarizing ? t.summarizing : t.summarizeNow}
                  </button>
                  {labelView.hasTranslation && (
                    <Button
                      variant="text"
                      size="sm"
                      onClick={() => toggleOriginal("label")}
                      aria-pressed={labelView.isEnglish}
                      className="-mx-2 text-md-tertiary"
                    >
                      {labelView.isEnglish ? t.seeTranslation : t.seeOriginal}
                    </Button>
                  )}
                </div>
                {summaryView && (
                  <div className="rounded-lg border border-md-outline bg-md-surface-container px-3 py-2 space-y-1.5">
                    <p className="text-body text-md-on-background">{summaryView.text}</p>
                    <p className="text-meta text-md-on-surface-variant">{t.aiDisclaimer}</p>
                    {summaryView.hasTranslation && (
                      <Button
                        variant="text"
                        size="sm"
                        onClick={() => toggleOriginal("summary")}
                        aria-pressed={summaryView.isEnglish}
                        className="-mx-2 text-md-tertiary"
                      >
                        {summaryView.isEnglish ? t.seeTranslation : t.seeOriginal}
                      </Button>
                    )}
                  </div>
                )}
                {summaryError && (
                  <p role="alert" className="text-meta text-md-error">
                    {summaryError}
                  </p>
                )}
                <p className="text-meta text-md-on-surface-variant">{t.source}</p>
              </>
            ) : (
              <p className="text-meta text-md-on-surface-variant">
                {selectedMed ? t.noLabelYet : t.pickMed}
              </p>
            )}
          </div>
        </section>
      </Panel>

      <Panel>
        <PostForm handle={handle} selectedMed={selectedMed} onPosted={load} lang={lang} />
        <p className="text-meta text-md-on-surface-variant mt-4">
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
      </Panel>

      <Panel>
        <section
          aria-labelledby={`${ids}-posts-h`}
          aria-live="polite"
          aria-busy={loading}
          className="space-y-2"
        >
          <h3 id={`${ids}-posts-h`} className="eyebrow">
            {t.whatPeople}
          </h3>
          <div aria-labelledby={`${ids}-terms-h`} className="space-y-2">
            <h3 id={`${ids}-terms-h`} className="eyebrow">
              {t.topTerms(selectedGeneric || t.allMeds)}
            </h3>
            {shownTerms.length === 0 ? (
              loading || selectedMed ? (
                <p className="text-meta text-md-on-surface-variant">
                  {loading ? t.loading : t.noTerms}
                </p>
              ) : null
            ) : (
              <ul
                className="flex flex-wrap gap-2 list-none p-0 m-0"
                aria-label={t.termsAria}
              >
                {shownTerms.map((item) => (
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
          </div>
          {loadError && (
            <p role="alert" className="text-meta text-md-error">
              {loadError}
            </p>
          )}
          {!loading && !loadError && posts.length === 0 && selectedMed && (
            <p className="text-meta text-md-on-surface-variant">
              {t.noPosts}
            </p>
          )}
          {es && posts.some((p) => !!tr(p.body)) && (
            <p className="text-meta text-md-on-surface-variant">{t.autoTranslated}</p>
          )}
          {posts.length > 0 && (
            <ul className="space-y-3 list-none p-0 m-0">
              {posts.map((p) => {
                const id = `post:${p.post_id}`;
                const pv = view(id, p.body);
                return (
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
                  {pv.isEnglish ? (
                    <PlainText as="p" text={pv.text} className="text-body" />
                  ) : (
                    <p className="text-body">{pv.text}</p>
                  )}
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
                  {pv.hasTranslation && (
                    <Button
                      variant="text"
                      size="sm"
                      onClick={() => toggleOriginal(id)}
                      aria-pressed={pv.isEnglish}
                      className="-mx-2 text-md-tertiary"
                    >
                      {pv.isEnglish ? t.seeTranslation : t.seeOriginal}
                    </Button>
                  )}
                </Card>
                );
              })}
            </ul>
          )}
        </section>
      </Panel>
    </div>
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
      <h3 id={`${ids}-h`} className="eyebrow">
        {t.share}
      </h3>

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
