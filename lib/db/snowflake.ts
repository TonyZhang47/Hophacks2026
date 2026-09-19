import type { ClinicFilters, Db, PostQuery } from "@/lib/db/types";
import { STOP_WORDS } from "@/lib/db/util";
import { query, fqn } from "@/lib/snowflake";
import { env } from "@/lib/env";
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
  Severity,
  TopTerm,
} from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
const lower = (r: any): any => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase(), v]));

/** Snowflake adapter. Schema in sql/schema.sql; seeds via scripts/seed-snowflake.ts. */
export class SnowflakeDb implements Db {
  readonly kind = "snowflake" as const;

  async getInteraction(a: string, b: string) {
    const rows = await query<any>(
      `SELECT drug_a, drug_b, severity, mechanism, management, source FROM ${fqn("INTERACTIONS")}
       WHERE (drug_a = ? AND drug_b = ?) OR (drug_a = ? AND drug_b = ?) LIMIT 1`,
      [a.toLowerCase(), b.toLowerCase(), b.toLowerCase(), a.toLowerCase()],
    );
    if (!rows[0]) return null;
    const r = lower(rows[0]);
    return {
      drug_a: r.drug_a,
      drug_b: r.drug_b,
      severity: (r.severity as Severity) ?? "unknown",
      mechanism: r.mechanism ?? undefined,
      management: r.management ?? undefined,
      source: r.source ?? "ddinter",
    } as InteractionRow;
  }

  async getDrugCache(rxcui: string) {
    const rows = await query<any>(
      `SELECT rxcui, name, ingredient_name, label_snippets FROM ${fqn("DRUG_CACHE")} WHERE rxcui = ? LIMIT 1`,
      [rxcui],
    );
    if (!rows[0]) return null;
    const r = lower(rows[0]);
    return {
      med: { rxcui: r.rxcui, name: r.name, ingredientName: r.ingredient_name ?? undefined } as Med,
      label_snippets: typeof r.label_snippets === "string" ? JSON.parse(r.label_snippets) : r.label_snippets,
    };
  }
  async setDrugCache(rxcui: string, med: Med, label_snippets: unknown) {
    await query(
      `MERGE INTO ${fqn("DRUG_CACHE")} t USING (SELECT ? AS rxcui) s ON t.rxcui = s.rxcui
       WHEN MATCHED THEN UPDATE SET name = ?, ingredient_name = ?, label_snippets = PARSE_JSON(?), fetched_at = CURRENT_TIMESTAMP()
       WHEN NOT MATCHED THEN INSERT (rxcui, name, ingredient_name, label_snippets, fetched_at)
       VALUES (?, ?, ?, PARSE_JSON(?), CURRENT_TIMESTAMP())`,
      [rxcui, med.name, med.ingredientName ?? null, JSON.stringify(label_snippets), rxcui, med.name, med.ingredientName ?? null, JSON.stringify(label_snippets)],
    );
  }

  async getLabelSections(rxcui: string, sections: LabelSectionName[]) {
    if (!sections.length) return [];
    const marks = sections.map(() => "?").join(",");
    const rows = await query<any>(
      `SELECT rxcui, ingredient_name, section, chunk_id, text, set_id, effective_time FROM ${fqn("LABEL_SECTIONS")}
       WHERE rxcui = ? AND section IN (${marks}) ORDER BY chunk_id`,
      [rxcui, ...sections],
    );
    return rows.map(lower) as LabelChunk[];
  }
  async upsertLabelSections(chunks: LabelChunk[]) {
    for (const c of chunks) {
      await query(
        `MERGE INTO ${fqn("LABEL_SECTIONS")} t USING (SELECT ? AS chunk_id) s ON t.chunk_id = s.chunk_id
         WHEN MATCHED THEN UPDATE SET text = ?, set_id = ?, effective_time = ?
         WHEN NOT MATCHED THEN INSERT (rxcui, ingredient_name, section, chunk_id, text, set_id, effective_time)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [c.chunk_id, c.text, c.set_id ?? null, c.effective_time ?? null, c.rxcui, c.ingredient_name, c.section, c.chunk_id, c.text, c.set_id ?? null, c.effective_time ?? null],
      );
    }
  }
  async searchLabel(rxcui: string, sections: LabelSectionName[], q: string, limit: number) {
    if (env.cortexSearchService) {
      try {
        const req = JSON.stringify({
          query: q,
          columns: ["rxcui", "ingredient_name", "section", "chunk_id", "text", "set_id", "effective_time"],
          filter: { "@and": [{ "@eq": { rxcui } }, { "@or": sections.map((s) => ({ "@eq": { section: s } })) }] },
          limit,
        });
        const rows = await query<any>(
          `SELECT PARSE_JSON(SNOWFLAKE.CORTEX.SEARCH_PREVIEW(?, ?)):results AS results`,
          [fqn(env.cortexSearchService), req],
        );
        const r = lower(rows[0] ?? {});
        const results = typeof r.results === "string" ? JSON.parse(r.results) : r.results;
        if (Array.isArray(results) && results.length) return results.map(lower) as LabelChunk[];
      } catch (e) {
        console.warn("[cortex-search] falling back to SQL section lookup:", (e as Error).message);
      }
    }
    // SQL fallback: plain section lookup (still retrieval, just not semantic).
    return (await this.getLabelSections(rxcui, sections)).slice(0, limit);
  }

  async getDoseLimit(ingredientName: string) {
    const rows = await query<any>(
      `SELECT ingredient_name, max_daily_mg, max_daily_mg_per_kg, route, source, notes FROM ${fqn("DOSE_LIMITS")}
       WHERE LOWER(ingredient_name) = ? LIMIT 1`,
      [ingredientName.toLowerCase()],
    );
    return rows[0] ? (lower(rows[0]) as DoseLimit) : null;
  }

  async getCard(pairHash: string) {
    const rows = await query<any>(`SELECT card_json FROM ${fqn("CARD_CACHE")} WHERE pair_hash = ? LIMIT 1`, [pairHash]);
    if (!rows[0]) return null;
    const r = lower(rows[0]);
    return (typeof r.card_json === "string" ? JSON.parse(r.card_json) : r.card_json) as InteractionCard;
  }
  async setCard(pairHash: string, card: InteractionCard) {
    await query(
      `MERGE INTO ${fqn("CARD_CACHE")} t USING (SELECT ? AS pair_hash) s ON t.pair_hash = s.pair_hash
       WHEN MATCHED THEN UPDATE SET card_json = PARSE_JSON(?), created_at = CURRENT_TIMESTAMP()
       WHEN NOT MATCHED THEN INSERT (pair_hash, card_json, created_at) VALUES (?, PARSE_JSON(?), CURRENT_TIMESTAMP())`,
      [pairHash, JSON.stringify(card), pairHash, JSON.stringify(card)],
    );
  }

  async zipCentroid(zip: string) {
    const rows = await query<any>(`SELECT lat, lon FROM ${fqn("ZIP_CENTROIDS")} WHERE zip = ? LIMIT 1`, [zip.slice(0, 5)]);
    if (!rows[0]) return null;
    const r = lower(rows[0]);
    return { lat: Number(r.lat), lon: Number(r.lon) };
  }
  async nearestZip(lat: number, lon: number) {
    const rows = await query<any>(
      `SELECT zip FROM ${fqn("ZIP_CENTROIDS")} ORDER BY HAVERSINE(?, ?, lat, lon) LIMIT 1`,
      [lat, lon],
    );
    return rows[0] ? (lower(rows[0]).zip as string) : null;
  }
  async clinicsNear(lat: number, lon: number, radiusMiles: number, filters: ClinicFilters, limit: number) {
    const where: string[] = [];
    if (filters.medicaid) where.push("accepts_medicaid = TRUE");
    if (filters.medicare) where.push("accepts_medicare = TRUE");
    if (filters.slidingFee) where.push("sliding_fee = TRUE");
    if (filters.rural) where.push("site_type = 'RHC'");
    const extra = where.length ? `AND ${where.join(" AND ")}` : "";
    // HAVERSINE returns km.
    const rows = await query<any>(
      `SELECT clinic_id, name, site_type, address, city, state, zip, lat, lon, phone, npi,
              accepts_medicaid, accepts_medicare, sliding_fee, source,
              HAVERSINE(?, ?, lat, lon) * 0.621371 AS distance_miles
       FROM ${fqn("CLINICS")}
       WHERE HAVERSINE(?, ?, lat, lon) * 0.621371 <= ? ${extra}
       ORDER BY distance_miles LIMIT ?`,
      [lat, lon, lat, lon, radiusMiles, limit],
    );
    const clinics = rows.map(lower);
    const conf = await this.getClinicConfirmations(clinics.map((c) => c.clinic_id));
    return clinics.map((c) => ({
      ...(c as Clinic),
      lat: Number(c.lat),
      lon: Number(c.lon),
      distanceMiles: Math.round(Number(c.distance_miles) * 10) / 10,
      communityConfirmed: conf[c.clinic_id] ?? [],
    })) as ClinicResult[];
  }
  async getClinic(clinicId: string) {
    const rows = await query<any>(`SELECT * FROM ${fqn("CLINICS")} WHERE clinic_id = ? LIMIT 1`, [clinicId]);
    return rows[0] ? (lower(rows[0]) as Clinic) : null;
  }
  async addClinicConfirmation(clinicId: string, insurer: string, confirmed: boolean) {
    await query(
      `INSERT INTO ${fqn("CLINIC_CONFIRMATIONS")} (clinic_id, insurance_label, confirmed, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP())`,
      [clinicId, insurer.trim(), confirmed],
    );
  }
  async getClinicConfirmations(clinicIds: string[]) {
    if (!clinicIds.length) return {};
    const marks = clinicIds.map(() => "?").join(",");
    const rows = await query<any>(
      `SELECT clinic_id, insurance_label, SUM(IFF(confirmed, 1, 0)) AS yes, SUM(IFF(confirmed, 0, 1)) AS no
       FROM ${fqn("CLINIC_CONFIRMATIONS")} WHERE clinic_id IN (${marks}) GROUP BY clinic_id, insurance_label`,
      clinicIds,
    );
    const out: Record<string, ClinicConfirmationSummary[]> = {};
    for (const raw of rows) {
      const r = lower(raw);
      (out[r.clinic_id] ??= []).push({ insurer: r.insurance_label, yes: Number(r.yes), no: Number(r.no) });
    }
    return out;
  }

  async listPosts(q: PostQuery) {
    const where = ["moderation_status = 'approved'"];
    const binds: (string | number)[] = [];
    if (q.rxcui) {
      where.push("rxcui = ?");
      binds.push(q.rxcui);
    }
    if (!q.rxcui && q.name) { where.push("LOWER(drug_name) = ?"); binds.push(q.name.toLowerCase()); }
    if (q.term) {
      where.push("(CONTAINS(LOWER(body), ?) OR ARRAY_CONTAINS(?::VARIANT, side_effect_tags))");
      binds.push(q.term.toLowerCase(), q.term.toLowerCase());
    }
    binds.push(q.limit, q.offset);
    const rows = await query<any>(
      `SELECT post_id, rxcui, drug_name, body, side_effect_tags, moderation_status, created_at, anon_handle
       FROM ${fqn("COMMUNITY_POSTS")} WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      binds,
    );
    return rows.map((raw) => {
      const r = lower(raw);
      return {
        ...r,
        side_effect_tags: typeof r.side_effect_tags === "string" ? JSON.parse(r.side_effect_tags) : r.side_effect_tags ?? [],
        created_at: new Date(r.created_at).toISOString(),
      } as CommunityPost;
    });
  }
  async createPost(post: CommunityPost) {
    await query(
      `INSERT INTO ${fqn("COMMUNITY_POSTS")} (post_id, rxcui, drug_name, body, side_effect_tags, moderation_status, created_at, anon_handle)
       SELECT ?, ?, ?, ?, PARSE_JSON(?), ?, CURRENT_TIMESTAMP(), ?`,
      [post.post_id, post.rxcui ?? null, post.drug_name, post.body, JSON.stringify(post.side_effect_tags), post.moderation_status, post.anon_handle],
    );
    return post;
  }
  async topTerms(rxcui: string | undefined, limit: number, name?: string): Promise<TopTerm[]> {
    const stop = [...STOP_WORDS].map((w) => `'${w}'`).join(",");
    const rows = await query<any>(
      `WITH words AS (
         SELECT post_id, LOWER(REGEXP_REPLACE(w.value, '[^a-z0-9]', '')) AS term
         FROM ${fqn("COMMUNITY_POSTS")} p, LATERAL SPLIT_TO_TABLE(LOWER(p.body), ' ') w
         WHERE p.moderation_status = 'approved' ${rxcui ? "AND p.rxcui = ?" : name ? "AND LOWER(p.drug_name) = ?" : ""}
         UNION ALL
         SELECT post_id, t.value::STRING AS term
         FROM ${fqn("COMMUNITY_POSTS")} p, LATERAL FLATTEN(input => p.side_effect_tags) t
         WHERE p.moderation_status = 'approved' ${rxcui ? "AND p.rxcui = ?" : name ? "AND LOWER(p.drug_name) = ?" : ""}
       )
       SELECT term, COUNT(DISTINCT post_id) AS cnt FROM words
       WHERE LENGTH(term) >= 3 AND term NOT IN (${stop}) AND NOT REGEXP_LIKE(term, '^[0-9]+$')
       GROUP BY term ORDER BY cnt DESC, term LIMIT ?`,
      rxcui ? [rxcui, rxcui, limit] : name ? [name.toLowerCase(), name.toLowerCase(), limit] : [limit],
    );
    return rows.map((raw) => {
      const r = lower(raw);
      return { term: r.term, count: Number(r.cnt) };
    });
  }
}
