import { z } from "zod";
import { checkFoods } from "@/lib/food";
const Body = z.object({
  meds: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(100),
        rxcui: z.string().min(1).max(120),
        ingredientName: z.string().max(100).optional(),
      }),
    )
    .min(1)
    .max(10),
  lang: z.enum(["en", "es"]).default("en"),
});
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      { error: "Add one to ten medicines." },
      { status: 400 },
    );
  return Response.json(
    { results: checkFoods(parsed.data.meds, parsed.data.lang) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
