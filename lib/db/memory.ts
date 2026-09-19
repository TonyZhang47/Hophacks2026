import type { ClinicFilters, Db, PostQuery } from "@/lib/db/types";
import { haversineMiles, tokenize } from "@/lib/db/util";
import type {
  Clinic,
  ClinicConfirmation,
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

import interactionsSeed from "@/data/interactions.json";
import labelSeed from "@/data/label_sections.json";
import doseLimitsSeed from "@/data/dose_limits.json";
import clinicsSeed from "@/data/clinics.json";
import zipSeed from "@/data/zip_centroids.json";
import postsSeed from "@/data/posts.json";

/**
 * In-memory adapter backed by /data seeds. Used when Snowflake env vars are absent
 * (local dev, demo mode). Writes live for the life of the process only.
 */
export class MemoryDb implements Db {
  readonly kind = "memory" as const;

  private interactions = interactionsSeed as InteractionRow[];
  private labels: LabelChunk[] = [...(labelSeed as LabelChunk[])];
  private doseLimits = doseLimitsSeed as DoseLimit[];
  private clinics = clinicsSeed as Clinic[];
  private zips = zipSeed as { zip: string; lat: number; lon: number }[];
  private posts: CommunityPost[] = [...(postsSeed as CommunityPost[])];
  private confirmations: ClinicConfirmation[] = [];
  private drugCache = new Map<string, { med: Med; label_snippets: unknown }>();
  private cards = new Map<string, InteractionCard>();

  async getInteraction(a: string, b: string) {
    const x = a.toLowerCase().trim();
    const y = b.toLowerCase().trim();
    return (
      this.interactions.find(
        (r) => (r.drug_a === x && r.drug_b === y) || (r.drug_a === y && r.drug_b === x),
      ) ?? null
    );
  }

  async getDrugCache(rxcui: string) {
    return this.drugCache.get(rxcui) ?? null;
  }
  async setDrugCache(rxcui: string, med: Med, label_snippets: unknown) {
    this.drugCache.set(rxcui, { med, label_snippets });
  }

  async getLabelSections(rxcui: string, sections: LabelSectionName[]) {
    return this.labels.filter((c) => c.rxcui === rxcui && sections.includes(c.section));
  }
  async upsertLabelSections(chunks: LabelChunk[]) {
    for (const c of chunks) {
      const i = this.labels.findIndex((x) => x.chunk_id === c.chunk_id);
      if (i >= 0) this.labels[i] = c;
      else this.labels.push(c);
    }
  }
  async searchLabel(rxcui: string, sections: LabelSectionName[], query: string, limit: number) {
    const pool = await this.getLabelSections(rxcui, sections);
    const q = new Set(tokenize(query));
    const scored = pool.map((c) => {
      const words = tokenize(c.text);
      let score = 0;
      for (const w of words) if (q.has(w)) score++;
      // Numbers in the query are strong signals for dosing text.
      for (const n of query.match(/\d+(\.\d+)?/g) ?? []) if (c.text.includes(n)) score += 2;
      return { c, score };
    });
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.c);
  }

  async getDoseLimit(ingredientName: string) {
    const k = ingredientName.toLowerCase().trim();
    return this.doseLimits.find((d) => d.ingredient_name.toLowerCase() === k) ?? null;
  }

  async getCard(pairHash: string) {
    return this.cards.get(pairHash) ?? null;
  }
  async setCard(pairHash: string, card: InteractionCard) {
    this.cards.set(pairHash, card);
  }

  async zipCentroid(zip: string) {
    const z = this.zips.find((r) => r.zip === zip.slice(0, 5));
    return z ? { lat: z.lat, lon: z.lon } : null;
  }
  async nearestZip(lat: number, lon: number) {
    let best: { zip: string; d: number } | null = null;
    for (const z of this.zips) {
      const d = haversineMiles(lat, lon, z.lat, z.lon);
      if (!best || d < best.d) best = { zip: z.zip, d };
    }
    return best?.zip ?? null;
  }
  async clinicsNear(lat: number, lon: number, radiusMiles: number, filters: ClinicFilters, limit: number) {
    const conf = await this.getClinicConfirmations(this.clinics.map((c) => c.clinic_id));
    const out: ClinicResult[] = [];
    for (const c of this.clinics) {
      if (filters.medicaid && !c.accepts_medicaid) continue;
      if (filters.medicare && !c.accepts_medicare) continue;
      if (filters.slidingFee && !c.sliding_fee) continue;
      if (filters.rural && c.site_type !== "RHC") continue;
      const d = haversineMiles(lat, lon, c.lat, c.lon);
      if (d <= radiusMiles) {
        out.push({ ...c, distanceMiles: Math.round(d * 10) / 10, communityConfirmed: conf[c.clinic_id] ?? [] });
      }
    }
    return out.sort((a, b) => a.distanceMiles - b.distanceMiles).slice(0, limit);
  }
  async getClinic(clinicId: string) {
    return this.clinics.find((c) => c.clinic_id === clinicId) ?? null;
  }
  async addClinicConfirmation(clinicId: string, insurer: string, confirmed: boolean) {
    this.confirmations.push({
      clinic_id: clinicId,
      insurance_label: insurer.trim(),
      confirmed,
      created_at: new Date().toISOString(),
    });
  }
  async getClinicConfirmations(clinicIds: string[]) {
    const ids = new Set(clinicIds);
    const out: Record<string, ClinicConfirmationSummary[]> = {};
    for (const c of this.confirmations) {
      if (!ids.has(c.clinic_id)) continue;
      const list = (out[c.clinic_id] ??= []);
      const key = c.insurance_label.toLowerCase();
      let row = list.find((r) => r.insurer.toLowerCase() === key);
      if (!row) {
        row = { insurer: c.insurance_label, yes: 0, no: 0 };
        list.push(row);
      }
      if (c.confirmed) row.yes++;
      else row.no++;
    }
    return out;
  }

  async listPosts(q: PostQuery) {
    let rows = this.posts.filter((p) => p.moderation_status === "approved");
    if (q.rxcui) rows = rows.filter((p) => p.rxcui === q.rxcui);
    else if (q.name) rows = rows.filter(p=>p.drug_name.toLowerCase()===q.name!.toLowerCase());
    if (q.term) {
      const t = q.term.toLowerCase();
      rows = rows.filter((p) => p.body.toLowerCase().includes(t) || p.side_effect_tags.includes(t as never));
    }
    return rows
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(q.offset, q.offset + q.limit);
  }
  async createPost(post: CommunityPost) {
    this.posts.push(post);
    return post;
  }
  async topTerms(rxcui: string | undefined, limit: number, name?: string): Promise<TopTerm[]> {
    const counts = new Map<string, number>();
    for (const p of this.posts) {
      if (p.moderation_status !== "approved") continue;
      if (rxcui && p.rxcui !== rxcui) continue;
      if (!rxcui && name && p.drug_name.toLowerCase() !== name.toLowerCase()) continue;
      const seen = new Set<string>();
      for (const w of [...tokenize(p.body), ...p.side_effect_tags]) {
        if (seen.has(w)) continue;
        seen.add(w);
        counts.set(w, (counts.get(w) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([term, count]) => ({ term, count }))
      .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term))
      .slice(0, limit);
  }
}
