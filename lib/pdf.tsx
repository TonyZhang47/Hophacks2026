import React from "react";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { ShareSheetData } from "@/components/share/ShareSheetButton";
import type { ClinicResult, InteractionCard, Severity } from "@/lib/types";

/**
 * Server-only one-page share sheet (Feature 6). Built from the same validated JSON as the UI.
 * No LLM pass here. Plain, high-contrast print layout (not the MD3 system — see DESIGN_SYSTEM.md).
 *
 * Dose rule: only `status === "consistent"` doses print their lines. Anything else prints a
 * "check these directions with your pharmacist" line with NO numbers.
 */

const INK = "#111111";
const MUTED = "#444444";
const RULE = "#999999";

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 44, paddingHorizontal: 44, fontFamily: "Helvetica", fontSize: 11, lineHeight: 1.35, color: INK },
  title: { fontFamily: "Helvetica-Bold", fontSize: 16, marginBottom: 2 },
  subtitle: { fontSize: 10, color: MUTED, marginBottom: 10 },
  h2: { fontFamily: "Helvetica-Bold", fontSize: 13, marginTop: 10, marginBottom: 4, paddingBottom: 2, borderBottomWidth: 1, borderBottomColor: RULE },
  p: { marginBottom: 2 },
  muted: { color: MUTED },
  bold: { fontFamily: "Helvetica-Bold" },
  row: { flexDirection: "row", flexWrap: "wrap" },
  medChip: { borderWidth: 1, borderColor: INK, borderRadius: 3, paddingHorizontal: 6, paddingVertical: 2, marginRight: 6, marginBottom: 4 },
  card: { borderWidth: 1, borderColor: RULE, borderLeftWidth: 4, borderLeftColor: INK, padding: 6, marginBottom: 5 },
  cardHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  bullet: { flexDirection: "row", marginBottom: 2 },
  bulletDot: { width: 10 },
  bulletText: { flex: 1 },
  footer: { position: "absolute", left: 44, right: 44, bottom: 20, fontSize: 9, color: MUTED, borderTopWidth: 1, borderTopColor: RULE, paddingTop: 4 },
});

const SEVERITY_WORD: Record<Severity, string> = { major: "MAJOR", moderate: "MODERATE", minor: "MINOR", unknown: "UNKNOWN" };
const SEVERITY_ORDER: Record<Severity, number> = { major: 0, moderate: 1, minor: 2, unknown: 3 };

function cap(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function coverageWords(c: ClinicResult): string {
  const words: string[] = [];
  if (c.accepts_medicaid) words.push("Takes Medicaid");
  if (c.accepts_medicare) words.push("Takes Medicare");
  if (c.sliding_fee) words.push("Sliding-fee scale");
  for (const conf of c.communityConfirmed ?? []) {
    if (conf.yes > 0) words.push(`${conf.insurer}: ${conf.yes} ${conf.yes === 1 ? "person" : "people"} confirmed`);
  }
  return words.join(" · ");
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={s.bullet}>
      <Text style={s.bulletDot}>•</Text>
      <Text style={s.bulletText}>{children}</Text>
    </View>
  );
}

function InteractionBlock({ card }: { card: InteractionCard }) {
  return (
    <View style={s.card} wrap={false}>
      <View style={s.cardHead}>
        <Text style={s.bold}>
          {cap(card.drugA)} + {cap(card.drugB)}
        </Text>
        <Text style={s.bold}>{SEVERITY_WORD[card.severity] ?? "UNKNOWN"}</Text>
      </View>
      {card.whatHappens ? (
        <Text style={s.p}>
          <Text style={s.bold}>What can happen: </Text>
          {card.whatHappens}
        </Text>
      ) : null}
      {card.whatToDo ? (
        <Text style={s.p}>
          <Text style={s.bold}>What to do: </Text>
          {card.whatToDo}
        </Text>
      ) : null}
      {card.askYourClinician ? (
        <Text style={s.p}>
          <Text style={s.bold}>Ask: </Text>
          {card.askYourClinician}
        </Text>
      ) : null}
    </View>
  );
}

export function ShareSheetDocument({ data, date }: { data: ShareSheetData; date: Date }) {
  const meds = data.meds ?? [];
  const cards = [...(data.cards ?? [])].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3));
  const doses = data.doses ?? [];
  const clinic = data.clinic ?? null;

  const questions = new Set<string>();
  for (const c of cards) if (c.askYourClinician?.trim()) questions.add(c.askYourClinician.trim());
  for (const d of doses) if (d.result?.askYourPharmacist?.trim()) questions.add(d.result.askYourPharmacist.trim());

  const dateStr = date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <Document title="RxPlain share sheet" author="RxPlain" subject="Educational handout, not a medical record">
      <Page size="LETTER" style={s.page}>
        <Text style={s.title}>RxPlain share sheet — educational handout, not a medical record</Text>
        <Text style={s.subtitle}>
          Plain-language notes about the medicines listed below, to show a caregiver or bring to a visit. Generated {dateStr}.
        </Text>

        <Text style={s.h2}>My medicines</Text>
        {meds.length === 0 ? (
          <Text style={s.muted}>No medicines listed.</Text>
        ) : (
          <View style={s.row}>
            {meds.map((m, i) => (
              <View key={`${m.rxcui}-${i}`} style={s.medChip}>
                <Text>{cap(m.name)}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={s.h2}>Possible interactions to ask about</Text>
        {cards.length === 0 ? (
          <Text style={s.muted}>No interaction pairs were flagged for this list. That does not guarantee the medicines are safe together — ask your pharmacist.</Text>
        ) : (
          cards.map((c, i) => <InteractionBlock key={`${c.drugA}-${c.drugB}-${i}`} card={c} />)
        )}

        {doses.length > 0 ? (
          <View>
            <Text style={s.h2}>How much and when</Text>
            <Text style={[s.muted, { marginBottom: 3 }]}>These lines restate the directions you entered, checked against the official label. RxPlain never changes a dose.</Text>
            {doses.map((d, i) => {
              const name = cap(d.input?.drugName || "This medicine");
              if (d.result?.status === "consistent") {
                return (
                  <View key={i} style={{ marginBottom: 4 }} wrap={false}>
                    <Text style={s.bold}>{name}</Text>
                    {d.result.plainDose ? <Bullet>{d.result.plainDose}</Bullet> : null}
                    {d.result.maxPerDayLine ? <Bullet>{d.result.maxPerDayLine}</Bullet> : null}
                  </View>
                );
              }
              return (
                <View key={i} style={{ marginBottom: 4 }} wrap={false}>
                  <Text style={s.bold}>{name}: check these directions with your pharmacist</Text>
                </View>
              );
            })}
          </View>
        ) : null}

        {clinic ? (
          <View>
            <Text style={s.h2}>Nearest clinic</Text>
            <Text style={s.bold}>{clinic.name}</Text>
            <Text>
              {[clinic.address, clinic.city, clinic.state, clinic.zip].filter(Boolean).join(", ")}
            </Text>
            <Text>
              {clinic.phone ? `Phone: ${clinic.phone}` : ""}
              {clinic.phone && Number.isFinite(clinic.distanceMiles) ? " · " : ""}
              {Number.isFinite(clinic.distanceMiles) ? `About ${clinic.distanceMiles.toFixed(1)} miles away` : ""}
            </Text>
            {coverageWords(clinic) ? <Text style={s.muted}>{coverageWords(clinic)}</Text> : null}
          </View>
        ) : null}

        <Text style={s.h2}>Questions to ask</Text>
        {questions.size === 0 ? (
          <Bullet>Is there anything about these medicines together that I should watch for?</Bullet>
        ) : (
          [...questions].map((q, i) => <Bullet key={i}>{q}</Bullet>)
        )}

        <Text style={s.footer} fixed>
          RxPlain is an educational tool, not medical advice. It does not compute or recommend doses. Interaction severity comes from public
          data (DDInter) and may be incomplete. Talk with a pharmacist or doctor before starting, stopping or changing any medicine.
          {"\n"}Generated {dateStr} · rxplain
        </Text>
      </Page>
    </Document>
  );
}

/** Render the share sheet to PDF bytes. Server only. */
export async function buildShareSheetPdf(data: ShareSheetData, date: Date = new Date()): Promise<Buffer> {
  return renderToBuffer(<ShareSheetDocument data={data} date={date} />);
}
