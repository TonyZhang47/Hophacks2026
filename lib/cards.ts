import "server-only";
import { createHash } from "crypto";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { chatJson, isXaiConfigured } from "@/lib/llm";
import type { InteractionCard, InteractionResult, Severity } from "@/lib/types";

/**
 * Plain-language cards. The LLM (when configured) only REWRITES the evidence we hand it;
 * severity is pinned to the database value and every card is safety-checked.
 * Without a key, or if the LLM fails, deterministic templates produce the text.
 */

export type CardLang = "en" | "es";

const SEVERITY_ORDER: Record<Severity, number> = { major: 0, moderate: 1, minor: 2, unknown: 3 };

/** Phrases a card may never contain in "what to do". */
const FORBIDDEN = /\b(stop taking|increase|decrease|double)\b/i;

export function pairHash(rxcuiA: string, rxcuiB: string, lang: CardLang): string {
  const key = `${[rxcuiA, rxcuiB].sort().join("+")}:${lang}`;
  return createHash("sha256").update(key).digest("hex");
}

// ---------- LLM path ----------

const SYSTEM_PROMPT =
  "You are a health explainer for access, not a prescriber. Use ONLY the provided evidence. " +
  "Never tell the person to start, stop, or change a medicine, and never suggest a dose. " +
  "Write short sentences with everyday words; explain any medical word right away. " +
  "If the severity is unknown, say the databases have no listed interaction for this pair and that this is not proof of safety. " +
  "Output ONLY a JSON object with keys: drugA, drugB, severity, whatHappens, howSerious, whatToDo, askYourClinician, citations (array of evidence ids you used).";

const LlmCardSchema = z.object({
  drugA: z.string(),
  drugB: z.string(),
  severity: z.enum(["major", "moderate", "minor", "unknown"]),
  whatHappens: z.string().min(1),
  howSerious: z.string().min(1),
  whatToDo: z.string().min(1),
  askYourClinician: z.string().min(1),
  citations: z.array(z.string()).optional(),
});
type LlmCard = z.infer<typeof LlmCardSchema>;

function buildUserPrompt(r: InteractionResult, lang: CardLang): string {
  const evidence = r.evidenceSnippets
    .map((s) => `- id: ${s.id} | source: ${s.source} | drug: ${s.drug} | section: ${s.section}\n  "${s.text}"`)
    .join("\n");
  return [
    `Language: ${lang === "es" ? "Spanish (everyday, neutral Latin American Spanish)" : "English"}`,
    `Drug A: ${r.a.name}`,
    `Drug B: ${r.b.name}`,
    `Severity from the interaction database (do not change it): ${r.severity}`,
    r.mechanism ? `Mechanism (DDInter): ${r.mechanism}` : "Mechanism: none listed",
    r.management ? `Management note (DDInter): ${r.management}` : "Management note: none listed",
    "",
    "Evidence snippets:",
    evidence || "(none)",
    "",
    "Write the four fields. whatHappens: 1-3 sentences. howSerious: 1-2 sentences naming the severity word. " +
      "whatToDo: 1-3 sentences that only point the person to their pharmacist or doctor and to warning signs to watch for. " +
      "askYourClinician: 1-3 questions the person can ask. Keep drugA and drugB exactly as given and severity exactly as given.",
  ].join("\n");
}

// ---------- Template path ----------

interface TemplateCtx {
  A: string;
  B: string;
  mechanism?: string;
  management?: string;
}

type Template = (c: TemplateCtx) => Omit<InteractionCard, "drugA" | "drugB" | "severity" | "citations">;

const withMech = (intro: string, mech?: string, fallback = "") =>
  mech ? `${intro} ${mech}` : `${intro} ${fallback}`.trim();

const askWithMgmt = (lead: string, mgmt: string | undefined, tail: string) =>
  mgmt ? `${lead} The interaction database also says: "${mgmt}" Ask whether that applies to you. ${tail}` : `${lead} ${tail}`;

const EN: Record<Severity, Template[]> = {
  major: [
    (c) => ({
      whatHappens: withMech(`Taking ${c.A} and ${c.B} together can cause a serious problem.`, c.mechanism, "The interaction database lists this pair as a major interaction."),
      howSerious: "This is listed as MAJOR. That is the highest level. It means the mix could cause real harm and is worth a phone call soon.",
      whatToDo: "Do not make any changes on your own. Call your pharmacist or doctor soon and tell them you take both. Watch for anything new or unusual and get help right away if you feel very unwell.",
      askYourClinician: askWithMgmt(`Ask: "Is it safe for me to take ${c.A} and ${c.B} together?"`, c.management, `Also ask: "What warning signs should I watch for?"`),
    }),
    (c) => ({
      whatHappens: withMech(`${c.A} and ${c.B} do not mix well.`, c.mechanism, "The database flags this as a major interaction."),
      howSerious: "Severity: MAJOR. This is the most serious level in the database. It does not mean harm is certain, but the risk is high enough to talk to someone soon.",
      whatToDo: "Keep this card handy and contact your pharmacist or doctor as soon as you can. They can look at your full list and your health. If something feels wrong, seek care right away.",
      askYourClinician: askWithMgmt(`Ask: "I take ${c.A} and ${c.B}. Is this a problem for me?"`, c.management, `Also ask: "Is there anything I should watch for?"`),
    }),
    (c) => ({
      whatHappens: withMech(`There is a known, serious interaction between ${c.A} and ${c.B}.`, c.mechanism, "Details are in the evidence below."),
      howSerious: "The database calls this MAJOR, the top level. Major means the combination has caused serious problems for some people.",
      whatToDo: "Please talk to a pharmacist or doctor soon and mention both medicines by name. Do not adjust anything on your own. If you notice new symptoms that worry you, get help right away.",
      askYourClinician: askWithMgmt(`Ask: "Do I need any extra checks because I take ${c.A} with ${c.B}?"`, c.management, `Also ask: "Who should I call if I notice a problem?"`),
    }),
    (c) => ({
      whatHappens: withMech(`Using ${c.A} with ${c.B} raises the chance of a serious side effect.`, c.mechanism, "See the evidence below for what the label says."),
      howSerious: "This pair is rated MAJOR. Of the four levels (major, moderate, minor, unknown), this is the one that most needs a conversation with a professional.",
      whatToDo: "Bring this to your pharmacist or doctor soon. A pharmacist is often the fastest person to reach. Do not change what you take until you have talked with them. Get help right away if you feel very unwell.",
      askYourClinician: askWithMgmt(`Ask: "Is there a safer option for me than taking ${c.A} and ${c.B} together?"`, c.management, `Also ask: "What should I do if I notice a side effect?"`),
    }),
  ],
  moderate: [
    (c) => ({
      whatHappens: withMech(`${c.A} and ${c.B} can affect each other.`, c.mechanism, "The database lists this as a moderate interaction."),
      howSerious: "This is listed as MODERATE. It is worth knowing about and worth a question, but it is not usually an emergency.",
      whatToDo: "Mention both medicines at your next pharmacy visit or appointment. Watch for anything new or unusual. Do not make changes on your own.",
      askYourClinician: askWithMgmt(`Ask: "I take ${c.A} and ${c.B}. Is there anything I should watch for?"`, c.management, `Also ask: "Does the timing of when I take them matter?"`),
    }),
    (c) => ({
      whatHappens: withMech(`When taken together, ${c.A} and ${c.B} may work differently or cause more side effects.`, c.mechanism, ""),
      howSerious: "Severity: MODERATE. Many people take pairs like this safely with a little extra attention. It still deserves a question.",
      whatToDo: "Ask your pharmacist about it next time you pick up a prescription, or bring it up with your doctor. Keep an eye out for new symptoms and write down anything you notice.",
      askYourClinician: askWithMgmt(`Ask: "Is it okay for me to take ${c.A} together with ${c.B}?"`, c.management, `Also ask: "Are there signs that would mean I should call you?"`),
    }),
    (c) => ({
      whatHappens: withMech(`There is a moderate interaction on record between ${c.A} and ${c.B}.`, c.mechanism, "See the evidence below."),
      howSerious: "MODERATE means the pair can matter but usually can be managed. It is the middle level of the four.",
      whatToDo: "Let your pharmacist or doctor know you take both. They can tell you whether it matters for you. Do not adjust anything on your own.",
      askYourClinician: askWithMgmt(`Ask: "What should I know about taking ${c.A} with ${c.B}?"`, c.management, `Also ask: "Should I take them at different times of day?"`),
    }),
    (c) => ({
      whatHappens: withMech(`${c.A} plus ${c.B} is a pair the database says to keep an eye on.`, c.mechanism, ""),
      howSerious: "This is rated MODERATE. Not an emergency, but a real thing to talk about with a pharmacist or doctor.",
      whatToDo: "Bring this card to your next visit or call your pharmacy. Keep taking notes on how you feel. Any changes should come from your care team, not from this card.",
      askYourClinician: askWithMgmt(`Ask: "Does taking ${c.A} and ${c.B} together change anything for me?"`, c.management, `Also ask: "Is there a check-up or test that would help?"`),
    }),
  ],
  minor: [
    (c) => ({
      whatHappens: withMech(`${c.A} and ${c.B} have a small, known interaction.`, c.mechanism, "The database lists this as minor."),
      howSerious: "This is listed as MINOR. Minor interactions rarely cause a problem, but it is still good to know.",
      whatToDo: "No urgent action is needed. Mention it the next time you talk to your pharmacist or doctor. Watch for anything unusual.",
      askYourClinician: askWithMgmt(`Ask: "Is the minor interaction between ${c.A} and ${c.B} something I should think about?"`, c.management, ""),
    }),
    (c) => ({
      whatHappens: withMech(`Taking ${c.A} with ${c.B} may have a small effect.`, c.mechanism, ""),
      howSerious: "Severity: MINOR. This is the lowest listed level. Most people notice nothing.",
      whatToDo: "You can bring it up at your next visit. There is no need to change anything on your own. Keep the list of everything you take up to date.",
      askYourClinician: askWithMgmt(`Ask: "I take ${c.A} and ${c.B}. Is there anything to watch for?"`, c.management, ""),
    }),
    (c) => ({
      whatHappens: withMech(`There is a minor interaction on record for ${c.A} and ${c.B}.`, c.mechanism, "See the evidence below."),
      howSerious: "MINOR is the lowest level of the four. It is listed for completeness and rarely matters day to day.",
      whatToDo: "Nothing urgent. A quick mention to your pharmacist is enough. Do not adjust anything on your own.",
      askYourClinician: askWithMgmt(`Ask: "Is there anything about ${c.A} and ${c.B} together that matters for me?"`, c.management, ""),
    }),
    (c) => ({
      whatHappens: withMech(`${c.A} and ${c.B} are listed together as a minor interaction.`, c.mechanism, ""),
      howSerious: "This is rated MINOR. Good to know, not something to worry about on its own.",
      whatToDo: "Keep this on your list to mention at your next visit. If you ever notice something new, tell your pharmacist or doctor.",
      askYourClinician: askWithMgmt(`Ask: "Should I take ${c.A} and ${c.B} at the same time or apart?"`, c.management, ""),
    }),
  ],
  unknown: [
    (c) => ({
      whatHappens: `The databases we checked have no listed interaction between ${c.A} and ${c.B}.`,
      howSerious: "Severity: UNKNOWN. No listing is not proof of safety. It only means nothing is on record in the sources we use.",
      whatToDo: "Keep both medicines on the list you show your pharmacist or doctor. Watch for anything new or unusual after starting either one. Do not make changes on your own.",
      askYourClinician: `Ask: "I take ${c.A} and ${c.B}. Is there anything I should know about taking them together?"`,
    }),
    (c) => ({
      whatHappens: `We did not find a recorded interaction for ${c.A} with ${c.B} in the sources we use.`,
      howSerious: "This shows as UNKNOWN. It is not a green light. It means the interaction databases have no entry for this pair.",
      whatToDo: "Bring your full medicine list to your pharmacist or doctor so they can check with what they have. Tell them about any new symptoms.",
      askYourClinician: `Ask: "Can you double-check ${c.A} and ${c.B} together with everything else I take?"`,
    }),
    (c) => ({
      whatHappens: `No interaction is listed for ${c.A} and ${c.B} in the DDInter data we use.`,
      howSerious: "UNKNOWN is different from safe. It means we could not find evidence either way.",
      whatToDo: "Share this pair with your pharmacist. They have more sources than we do. Do not adjust anything on your own.",
      askYourClinician: `Ask: "Is there any reason I should not take ${c.A} and ${c.B} at the same time?"`,
    }),
    (c) => ({
      whatHappens: `Nothing is on record for ${c.A} together with ${c.B} in the interaction databases we checked.`,
      howSerious: "This is UNKNOWN. That is not the same as no risk. It only means there is no listing.",
      whatToDo: "Keep an up-to-date list of everything you take and show it at every visit. If anything feels off, tell a pharmacist or doctor.",
      askYourClinician: `Ask: "Do you see any problem with me taking ${c.A} and ${c.B} together?"`,
    }),
  ],
};

const askConMgmt = (lead: string, mgmt: string | undefined, tail: string) =>
  mgmt ? `${lead} La base de datos de interacciones también dice: "${mgmt}" Pregunte si eso aplica a usted. ${tail}` : `${lead} ${tail}`;

const ES: Record<Severity, Template[]> = {
  major: [
    (c) => ({
      whatHappens: withMech(`Tomar ${c.A} y ${c.B} juntos puede causar un problema serio.`, c.mechanism, "La base de datos marca este par como una interacción mayor."),
      howSerious: "Está clasificada como MAYOR. Es el nivel más alto. Significa que la mezcla podría causar daño real y vale la pena llamar pronto.",
      whatToDo: "No haga cambios por su cuenta. Llame pronto a su farmacéutico o médico y dígales que toma los dos. Esté atento a cualquier cosa nueva o rara y busque ayuda de inmediato si se siente muy mal.",
      askYourClinician: askConMgmt(`Pregunte: "¿Es seguro para mí tomar ${c.A} y ${c.B} juntos?"`, c.management, `También pregunte: "¿Qué señales de alarma debo vigilar?"`),
    }),
    (c) => ({
      whatHappens: withMech(`${c.A} y ${c.B} no se combinan bien.`, c.mechanism, "La base de datos lo marca como interacción mayor."),
      howSerious: "Gravedad: MAYOR. Es el nivel más serio de la base de datos. No significa que el daño sea seguro, pero el riesgo es suficiente para hablar pronto con alguien.",
      whatToDo: "Guarde esta tarjeta y contacte a su farmacéutico o médico lo antes posible. Ellos pueden revisar su lista completa y su salud. Si algo se siente mal, busque atención de inmediato.",
      askYourClinician: askConMgmt(`Pregunte: "Tomo ${c.A} y ${c.B}. ¿Es un problema para mí?"`, c.management, `También pregunte: "¿Hay algo que deba vigilar?"`),
    }),
    (c) => ({
      whatHappens: withMech(`Existe una interacción seria conocida entre ${c.A} y ${c.B}.`, c.mechanism, "Los detalles están en la evidencia abajo."),
      howSerious: "La base de datos la llama MAYOR, el nivel más alto. Mayor significa que la combinación ha causado problemas serios a algunas personas.",
      whatToDo: "Hable pronto con un farmacéutico o médico y mencione los dos medicamentos por su nombre. No ajuste nada por su cuenta. Si nota síntomas nuevos que le preocupen, busque ayuda de inmediato.",
      askYourClinician: askConMgmt(`Pregunte: "¿Necesito algún control extra porque tomo ${c.A} con ${c.B}?"`, c.management, `También pregunte: "¿A quién llamo si noto un problema?"`),
    }),
    (c) => ({
      whatHappens: withMech(`Usar ${c.A} con ${c.B} aumenta la posibilidad de un efecto secundario serio.`, c.mechanism, "Vea la evidencia abajo para saber qué dice la etiqueta."),
      howSerious: "Este par está clasificado como MAYOR. De los cuatro niveles (mayor, moderada, menor, desconocida), este es el que más necesita una conversación con un profesional.",
      whatToDo: "Lleve esto pronto a su farmacéutico o médico. El farmacéutico suele ser la persona más rápida de contactar. No cambie lo que toma hasta hablar con ellos. Busque ayuda de inmediato si se siente muy mal.",
      askYourClinician: askConMgmt(`Pregunte: "¿Hay una opción más segura para mí que tomar ${c.A} y ${c.B} juntos?"`, c.management, `También pregunte: "¿Qué hago si noto un efecto secundario?"`),
    }),
  ],
  moderate: [
    (c) => ({
      whatHappens: withMech(`${c.A} y ${c.B} pueden afectarse entre sí.`, c.mechanism, "La base de datos lo lista como interacción moderada."),
      howSerious: "Está clasificada como MODERADA. Vale la pena saberlo y preguntar, pero normalmente no es una emergencia.",
      whatToDo: "Mencione los dos medicamentos en su próxima visita a la farmacia o cita. Esté atento a cualquier cosa nueva o rara. No haga cambios por su cuenta.",
      askYourClinician: askConMgmt(`Pregunte: "Tomo ${c.A} y ${c.B}. ¿Hay algo que deba vigilar?"`, c.management, `También pregunte: "¿Importa la hora en que los tomo?"`),
    }),
    (c) => ({
      whatHappens: withMech(`Tomados juntos, ${c.A} y ${c.B} pueden funcionar distinto o causar más efectos secundarios.`, c.mechanism, ""),
      howSerious: "Gravedad: MODERADA. Muchas personas toman pares como este sin problema con un poco de atención extra. Aun así merece una pregunta.",
      whatToDo: "Pregunte a su farmacéutico la próxima vez que recoja una receta, o coméntelo con su médico. Esté atento a síntomas nuevos y anote lo que note.",
      askYourClinician: askConMgmt(`Pregunte: "¿Está bien que tome ${c.A} junto con ${c.B}?"`, c.management, `También pregunte: "¿Hay señales que signifiquen que debo llamarle?"`),
    }),
    (c) => ({
      whatHappens: withMech(`Hay una interacción moderada registrada entre ${c.A} y ${c.B}.`, c.mechanism, "Vea la evidencia abajo."),
      howSerious: "MODERADA significa que el par puede importar pero normalmente se puede manejar. Es el nivel medio de los cuatro.",
      whatToDo: "Avise a su farmacéutico o médico que toma los dos. Ellos pueden decirle si importa en su caso. No ajuste nada por su cuenta.",
      askYourClinician: askConMgmt(`Pregunte: "¿Qué debo saber sobre tomar ${c.A} con ${c.B}?"`, c.management, `También pregunte: "¿Debo tomarlos a distintas horas del día?"`),
    }),
    (c) => ({
      whatHappens: withMech(`${c.A} más ${c.B} es un par que la base de datos dice que hay que vigilar.`, c.mechanism, ""),
      howSerious: "Está clasificada como MODERADA. No es una emergencia, pero sí algo real para hablar con un farmacéutico o médico.",
      whatToDo: "Lleve esta tarjeta a su próxima visita o llame a su farmacia. Siga anotando cómo se siente. Cualquier cambio debe venir de su equipo de salud, no de esta tarjeta.",
      askYourClinician: askConMgmt(`Pregunte: "¿Tomar ${c.A} y ${c.B} juntos cambia algo para mí?"`, c.management, `También pregunte: "¿Hay algún control o examen que ayude?"`),
    }),
  ],
  minor: [
    (c) => ({
      whatHappens: withMech(`${c.A} y ${c.B} tienen una interacción pequeña y conocida.`, c.mechanism, "La base de datos la lista como menor."),
      howSerious: "Está clasificada como MENOR. Las interacciones menores rara vez causan un problema, pero es bueno saberlo.",
      whatToDo: "No se necesita nada urgente. Menciónelo la próxima vez que hable con su farmacéutico o médico. Esté atento a cualquier cosa rara.",
      askYourClinician: askConMgmt(`Pregunte: "¿La interacción menor entre ${c.A} y ${c.B} es algo que deba considerar?"`, c.management, ""),
    }),
    (c) => ({
      whatHappens: withMech(`Tomar ${c.A} con ${c.B} puede tener un efecto pequeño.`, c.mechanism, ""),
      howSerious: "Gravedad: MENOR. Es el nivel más bajo listado. La mayoría de las personas no nota nada.",
      whatToDo: "Puede comentarlo en su próxima visita. No hace falta cambiar nada por su cuenta. Mantenga al día la lista de todo lo que toma.",
      askYourClinician: askConMgmt(`Pregunte: "Tomo ${c.A} y ${c.B}. ¿Hay algo que vigilar?"`, c.management, ""),
    }),
    (c) => ({
      whatHappens: withMech(`Hay una interacción menor registrada para ${c.A} y ${c.B}.`, c.mechanism, "Vea la evidencia abajo."),
      howSerious: "MENOR es el nivel más bajo de los cuatro. Se lista por completitud y rara vez importa en el día a día.",
      whatToDo: "Nada urgente. Basta con mencionarlo a su farmacéutico. No ajuste nada por su cuenta.",
      askYourClinician: askConMgmt(`Pregunte: "¿Hay algo de ${c.A} y ${c.B} juntos que importe en mi caso?"`, c.management, ""),
    }),
    (c) => ({
      whatHappens: withMech(`${c.A} y ${c.B} aparecen juntos como una interacción menor.`, c.mechanism, ""),
      howSerious: "Está clasificada como MENOR. Es bueno saberlo, no es algo de qué preocuparse por sí solo.",
      whatToDo: "Téngalo en su lista para mencionarlo en su próxima visita. Si alguna vez nota algo nuevo, dígaselo a su farmacéutico o médico.",
      askYourClinician: askConMgmt(`Pregunte: "¿Debo tomar ${c.A} y ${c.B} al mismo tiempo o separados?"`, c.management, ""),
    }),
  ],
  unknown: [
    (c) => ({
      whatHappens: `Las bases de datos que revisamos no tienen una interacción listada entre ${c.A} y ${c.B}.`,
      howSerious: "Gravedad: DESCONOCIDA. Que no aparezca no es prueba de seguridad. Solo significa que no hay nada registrado en las fuentes que usamos.",
      whatToDo: "Mantenga los dos medicamentos en la lista que muestra a su farmacéutico o médico. Esté atento a cualquier cosa nueva o rara. No haga cambios por su cuenta.",
      askYourClinician: `Pregunte: "Tomo ${c.A} y ${c.B}. ¿Hay algo que deba saber sobre tomarlos juntos?"`,
    }),
    (c) => ({
      whatHappens: `No encontramos una interacción registrada para ${c.A} con ${c.B} en las fuentes que usamos.`,
      howSerious: "Aparece como DESCONOCIDA. No es luz verde. Significa que las bases de datos de interacciones no tienen entrada para este par.",
      whatToDo: "Lleve su lista completa de medicamentos a su farmacéutico o médico para que la revisen con lo que ellos tienen. Cuénteles cualquier síntoma nuevo.",
      askYourClinician: `Pregunte: "¿Puede revisar ${c.A} y ${c.B} juntos con todo lo demás que tomo?"`,
    }),
    (c) => ({
      whatHappens: `No hay interacción listada para ${c.A} y ${c.B} en los datos de DDInter que usamos.`,
      howSerious: "DESCONOCIDA no es lo mismo que segura. Significa que no encontramos evidencia en ningún sentido.",
      whatToDo: "Comparta este par con su farmacéutico. Ellos tienen más fuentes que nosotros. No ajuste nada por su cuenta.",
      askYourClinician: `Pregunte: "¿Hay alguna razón por la que no deba tomar ${c.A} y ${c.B} al mismo tiempo?"`,
    }),
    (c) => ({
      whatHappens: `No hay nada registrado para ${c.A} junto con ${c.B} en las bases de datos de interacciones que revisamos.`,
      howSerious: "Es DESCONOCIDA. No es lo mismo que sin riesgo. Solo significa que no hay una entrada.",
      whatToDo: "Mantenga al día una lista de todo lo que toma y muéstrela en cada visita. Si algo se siente raro, dígaselo a un farmacéutico o médico.",
      askYourClinician: `Pregunte: "¿Ve algún problema en que tome ${c.A} y ${c.B} juntos?"`,
    }),
  ],
};

/** Pick a template variant deterministically from the pair hash so the same pair reads the same way. */
function templateCard(r: InteractionResult, lang: CardLang, hash: string): InteractionCard {
  const bank = (lang === "es" ? ES : EN)[r.severity];
  const idx = parseInt(hash.slice(0, 8), 16) % bank.length;
  const body = bank[idx]({ A: r.a.name, B: r.b.name, mechanism: r.mechanism, management: r.management });
  return {
    drugA: r.a.name,
    drugB: r.b.name,
    severity: r.severity,
    ...body,
    citations: [...r.sourceIds],
  };
}

async function llmCard(r: InteractionResult, lang: CardLang): Promise<InteractionCard | null> {
  try {
    const out: LlmCard = await chatJson<LlmCard>(SYSTEM_PROMPT, buildUserPrompt(r, lang), LlmCardSchema, {
      temperature: 0,
      maxTokens: 900,
      retries: 1,
    });
    return {
      drugA: r.a.name,
      drugB: r.b.name,
      severity: r.severity, // pinned: the model never decides severity
      whatHappens: out.whatHappens.trim(),
      howSerious: out.howSerious.trim(),
      whatToDo: out.whatToDo.trim(),
      askYourClinician: out.askYourClinician.trim(),
      citations: [...r.sourceIds],
    };
  } catch {
    return null;
  }
}

/** Safety post-check. A card fails if "what to do" contains a dose or start/stop instruction. */
export function cardIsSafe(card: InteractionCard): boolean {
  return !FORBIDDEN.test(card.whatToDo);
}

export async function buildCard(r: InteractionResult, lang: CardLang): Promise<InteractionCard> {
  const db = await getDb();
  const hash = pairHash(r.a.rxcui, r.b.rxcui, lang);

  try {
    const cached = await db.getCard(hash);
    if (cached && cached.severity === r.severity && cardIsSafe(cached)) {
      return { ...cached, drugA: r.a.name, drugB: r.b.name, citations: [...r.sourceIds] };
    }
  } catch {
    // cache miss on error
  }

  let card: InteractionCard | null = null;
  if (isXaiConfigured()) card = await llmCard(r, lang);
  if (!card || !cardIsSafe(card)) card = templateCard(r, lang, hash);
  if (!cardIsSafe(card)) {
    // Template text is fixed and safe; this only trips if the DDInter management quote in
    // askYourClinician leaks into whatToDo, which it never does. Belt and braces.
    card = { ...card, whatToDo: templateCard({ ...r, management: undefined }, lang, hash).whatToDo };
  }
  card.citations = [...r.sourceIds];

  try {
    await db.setCard(hash, card);
  } catch {
    // caching is best-effort
  }
  return card;
}

/** Build one card per result, sorted major → moderate → minor → unknown. */
export async function buildCards(results: InteractionResult[], lang: CardLang): Promise<InteractionCard[]> {
  const cards = await Promise.all(results.map((r) => buildCard(r, lang)));
  return cards.sort((x, y) => SEVERITY_ORDER[x.severity] - SEVERITY_ORDER[y.severity] || x.drugA.localeCompare(y.drugA));
}

/** One plain sentence for the top of the results. */
export function summarize(results: InteractionResult[], medCount: number, lang: CardLang): string {
  const counts: Record<Severity, number> = { major: 0, moderate: 0, minor: 0, unknown: 0 };
  for (const r of results) counts[r.severity]++;

  if (lang === "es") {
    const parts: string[] = [];
    if (counts.major) parts.push(`${counts.major} ${counts.major === 1 ? "mayor" : "mayores"}`);
    if (counts.moderate) parts.push(`${counts.moderate} ${counts.moderate === 1 ? "moderada" : "moderadas"}`);
    if (counts.minor) parts.push(`${counts.minor} ${counts.minor === 1 ? "menor" : "menores"}`);
    const meds = `${medCount} medicamentos`;
    if (!parts.length) {
      return `No encontramos interacciones listadas entre sus ${meds}. Esto no es prueba de seguridad; pregunte a su farmacéutico.`;
    }
    const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}` : parts[0];
    const total = counts.major + counts.moderate + counts.minor;
    return `Encontramos ${total} ${total === 1 ? "posible interacción" : "posibles interacciones"} entre sus ${meds}: ${list}.`;
  }

  const parts: string[] = [];
  if (counts.major) parts.push(`${counts.major} major`);
  if (counts.moderate) parts.push(`${counts.moderate} moderate`);
  if (counts.minor) parts.push(`${counts.minor} minor`);
  const meds = `${medCount} medicines`;
  if (!parts.length) {
    return `Found no listed interactions among your ${meds}. This is not proof of safety; ask your pharmacist.`;
  }
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
  const total = counts.major + counts.moderate + counts.minor;
  return `Found ${list} possible ${total === 1 ? "interaction" : "interactions"} among your ${meds}.`;
}
