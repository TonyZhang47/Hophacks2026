import assert from "node:assert/strict";
import { checkFoods } from "@/lib/food";
import { MemoryDb } from "@/lib/db/memory";
import { speechChunks } from "@/lib/speechChunks";
import { createSession, findSession, sessions } from "@/lib/captureSessions";
import { GET as captureGet, PUT as capturePut } from "@/app/api/capture/route";
import { env } from "@/lib/env";
import { languageAvailable, providerForLanguage, synthesize } from "@/lib/tts";
async function main() {
  const foods = checkFoods([
    { name: "Advil", rxcui: "5640" },
    { name: "Mystery medicine", rxcui: "manual:mystery" },
  ]);
  assert.equal(foods[0].medicine.name, "Advil");
  assert.equal(foods[0].food, "Food or milk");
  assert.equal(foods[1].severity, "unknown");
  assert.equal(foods[1].source, undefined);
  assert.ok(foods[0].source?.startsWith("https://medlineplus.gov/"));
  assert.equal(
    checkFoods([{ name: "Simvastatin", rxcui: "36567" }], "es")[0].food,
    "Toronja",
  );
  const long = "A meaningful sentence with medicine information. ".repeat(300);
  const chunks = speechChunks(long);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((c) => c.length <= 3000));
  assert.equal(chunks.join(" "), long.trim());
  const db = new MemoryDb();
  await db.createPost({
    post_id: "test-custom",
    drug_name: "manual example",
    body: "A unique experience with gentle walking",
    side_effect_tags: [],
    moderation_status: "approved",
    created_at: new Date().toISOString(),
    anon_handle: "quiet-test",
  });
  assert.equal(
    (await db.listPosts({ name: "manual example", limit: 20, offset: 0 }))
      .length,
    1,
  );
  assert.equal(
    (await db.listPosts({ name: "another name", limit: 20, offset: 0 })).length,
    0,
  );
  assert.equal((await db.topTerms(undefined, 15, "another name")).length, 0);
  assert.ok(
    (await db.topTerms(undefined, 15, "manual example")).some(
      (t) => t.term === "walking",
    ),
  );
  assert.ok(
    (await db.listPosts({ rxcui: "6809", limit: 50, offset: 0 })).every(
      (p) => p.rxcui === "6809",
    ),
  );
  const s = createSession();
  assert.equal(findSession(s.readToken), s);
  assert.equal(findSession(s.writeToken), undefined);
  assert.equal(findSession(s.writeToken, true), s);
  s.expires = Date.now() - 1;
  assert.equal(findSession(s.readToken), undefined);
  assert.equal(sessions.size, 0);
  const paired = createSession();
  const request = (credential: string, origin: string) => new Request("http://localhost:3000/api/capture", {method:"PUT",headers:{Host:"10.0.0.2:3000",Origin:origin,Authorization:`Bearer ${credential}`,"Content-Type":"application/json"},body:JSON.stringify({image:"data:image/jpeg;base64,/9j/2Q=="})});
  assert.equal((await capturePut(request(paired.writeToken,"https://unrelated.example"))).status,403);
  assert.equal((await capturePut(request(paired.readToken,"http://10.0.0.2:3000"))).status,410);
  assert.equal((await capturePut(request(paired.writeToken,"http://10.0.0.2:3000"))).status,200);
  assert.equal((await capturePut(request(paired.writeToken,"http://10.0.0.2:3000"))).status,409);
  const phoneState=await captureGet(new Request("http://localhost:3000/api/capture",{headers:{Authorization:`Bearer ${paired.writeToken}`}}));
  assert.equal((await phoneState.json()).image,undefined);
  sessions.delete(paired.readToken);
  const fetchOriginal = globalThis.fetch;
  const calls: string[] = [];
  env.xaiKey = "test-key";
  env.elevenKey = "test-key";
  globalThis.fetch = async (input) => {
    calls.push(String(input));
    return new Response(new Uint8Array([1, 2, 3]), {
      headers: { "content-type": "audio/mpeg" },
    });
  };
  assert.equal(providerForLanguage("en-US"), "grok");
  assert.equal(providerForLanguage("es-MX"), "elevenlabs");
  assert.equal(providerForLanguage("fr"), null);
  assert.equal(
    (await synthesize("English routing test", "en")).provider,
    "grok",
  );
  assert.ok(calls.at(-1)?.startsWith("https://api.x.ai/"));
  assert.equal(
    (await synthesize("Prueba de voz", "es")).provider,
    "elevenlabs",
  );
  assert.ok(calls.at(-1)?.startsWith("https://api.elevenlabs.io/"));
  env.xaiKey = "";
  assert.equal(languageAvailable("en"), false);
  assert.equal(languageAvailable("es"), true);
  await assert.rejects(() => synthesize("missing English", "en"));
  env.xaiKey = "test";
  calls.length = 0;
  globalThis.fetch = async (input) => {
    calls.push(String(input));
    throw new Error("test failure");
  };
  await assert.rejects(() => synthesize("No provider fallback", "en"));
  assert.equal(calls.length, 1);
  assert.ok(calls[0].includes("api.x.ai"));
  globalThis.fetch = fetchOriginal;
  console.log(
    "PASS food coverage, full-page chunking, medicine-scoped terms, pairing permissions/expiry, strict voice routing and no fallback",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
