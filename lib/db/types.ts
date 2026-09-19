import type {
  Clinic,
  ClinicConfirmationSummary,
  ClinicResult,
  CommunityPost,
  DoseLimit,
  InteractionCard,
  InteractionRow,
  LabelChunk,
  LabelSectionName,
  Med,
  TopTerm,
} from "@/lib/types";

export interface ClinicFilters {
  medicaid?: boolean;
  medicare?: boolean;
  slidingFee?: boolean;
  rural?: boolean; // site_type === RHC
}

export interface PostQuery {
  name?: string;
  rxcui?: string;
  term?: string;
  limit: number;
  offset: number;
}

/**
 * Data adapter. Snowflake when configured, otherwise in-memory seeds from /data.
 * Feature modules only ever talk to this interface.
 */
export interface Db {
  readonly kind: "snowflake" | "memory";

  // Interactions
  getInteraction(ingredientA: string, ingredientB: string): Promise<InteractionRow | null>;

  // Drug cache
  getDrugCache(rxcui: string): Promise<{ med: Med; label_snippets: unknown } | null>;
  setDrugCache(rxcui: string, med: Med, label_snippets: unknown): Promise<void>;

  // Label sections (RAG corpus)
  getLabelSections(rxcui: string, sections: LabelSectionName[]): Promise<LabelChunk[]>;
  upsertLabelSections(chunks: LabelChunk[]): Promise<void>;
  /** Semantic/keyword search scoped to rxcui + sections. Cortex Search when available. */
  searchLabel(rxcui: string, sections: LabelSectionName[], query: string, limit: number): Promise<LabelChunk[]>;

  // Dose limits
  getDoseLimit(ingredientName: string): Promise<DoseLimit | null>;

  // Card cache
  getCard(pairHash: string): Promise<InteractionCard | null>;
  setCard(pairHash: string, card: InteractionCard): Promise<void>;

  // Clinics
  zipCentroid(zip: string): Promise<{ lat: number; lon: number } | null>;
  nearestZip(lat: number, lon: number): Promise<string | null>;
  clinicsNear(lat: number, lon: number, radiusMiles: number, filters: ClinicFilters, limit: number): Promise<ClinicResult[]>;
  getClinic(clinicId: string): Promise<Clinic | null>;
  addClinicConfirmation(clinicId: string, insurer: string, confirmed: boolean): Promise<void>;
  getClinicConfirmations(clinicIds: string[]): Promise<Record<string, ClinicConfirmationSummary[]>>;

  // Community
  listPosts(q: PostQuery): Promise<CommunityPost[]>;
  createPost(post: CommunityPost): Promise<CommunityPost>;
  topTerms(rxcui: string | undefined, limit: number, name?: string): Promise<TopTerm[]>;
}
