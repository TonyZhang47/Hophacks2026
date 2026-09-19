export type Severity = "major" | "moderate" | "minor" | "unknown";

export interface Med {
  name: string;
  rxcui: string;
  ingredientName?: string;
}

export interface InteractionRow {
  drug_a: string; // ingredient, lowercase
  drug_b: string;
  severity: Severity;
  mechanism?: string;
  management?: string;
  source: string;
}

export interface EvidenceSnippet {
  id: string;
  source: "openfda" | "ddinter" | "seed";
  drug: string;
  section: string;
  text: string;
}

export interface InteractionResult {
  a: Med;
  b: Med;
  severity: Severity;
  evidenceSnippets: EvidenceSnippet[];
  sourceIds: string[];
  mechanism?: string;
  management?: string;
}

export interface InteractionCard {
  drugA: string;
  drugB: string;
  severity: Severity;
  whatHappens: string;
  howSerious: string;
  whatToDo: string;
  askYourClinician: string;
  citations: string[];
}

export type LabelSectionName =
  | "dosage_and_administration"
  | "overdosage"
  | "boxed_warning"
  | "warnings"
  | "adverse_reactions"
  | "indications_and_usage";

export interface LabelChunk {
  rxcui: string;
  ingredient_name: string;
  section: LabelSectionName;
  chunk_id: string;
  text: string;
  set_id?: string;
  effective_time?: string;
}

export interface DoseLimit {
  ingredient_name: string;
  max_daily_mg: number | null;
  max_daily_mg_per_kg: number | null;
  route: string;
  source: string;
  notes?: string;
}

export interface DoseInput {
  drugName: string;
  rxcui: string;
  strengthMg: number | null;
  unitsPerDose: number | null;
  unitLabel: "tablet" | "capsule" | "mL" | "puff" | "drop" | "patch" | "unit";
  timesPerDay: number | null;
  /** Frequency phrase copied from the bottle, e.g. "6 to 8 times a day". */
  howOftenText: string;
  route: "oral" | "topical" | "inhaled" | "other";
  withFood: boolean | null;
  asNeeded: boolean;
  userText: string;
}

export type DoseStatus = "consistent" | "above_label_max" | "inconsistent" | "unverified";

export interface DoseResult {
  status: DoseStatus;
  plainDose: string;
  maxPerDayLine: string;
  timing: string[];
  missedDoseLine: string;
  labelQuotes: { chunkId: string; text: string }[];
  numbersUsed: number[];
  askYourPharmacist: string;
  /** Why the card failed closed (only when status !== consistent). */
  reason?: string;
  ceilingChecked: boolean;
  guardrailLog: string[];
}

export type SiteType = "FQHC" | "LOOKALIKE" | "RHC";

export interface Clinic {
  clinic_id: string;
  name: string;
  site_type: SiteType;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lon: number;
  phone: string;
  npi?: string;
  accepts_medicaid: boolean;
  accepts_medicare: boolean;
  sliding_fee: boolean;
  source: string;
  updated_at?: string;
}

export interface ClinicConfirmation {
  clinic_id: string;
  insurance_label: string;
  confirmed: boolean;
  created_at: string;
}

export interface ClinicConfirmationSummary {
  insurer: string;
  yes: number;
  no: number;
}

export interface ClinicResult extends Clinic {
  distanceMiles: number;
  communityConfirmed: ClinicConfirmationSummary[];
}

export const SIDE_EFFECT_TAGS = [
  "nausea",
  "dizziness",
  "sleep",
  "appetite",
  "headache",
  "stomach",
  "mood",
  "other",
] as const;
export type SideEffectTag = (typeof SIDE_EFFECT_TAGS)[number];

export interface CommunityPost {
  post_id: string;
  rxcui?: string;
  drug_name: string;
  body: string;
  side_effect_tags: SideEffectTag[];
  moderation_status: "approved" | "rejected";
  created_at: string;
  anon_handle: string;
}

export interface TopTerm {
  term: string;
  count: number;
}
