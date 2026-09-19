/** Server-only feature flags derived from env. Never import from client components. */
export const env = {
  xaiKey: process.env.XAI_API_KEY ?? "",
  xaiChatModel: process.env.XAI_CHAT_MODEL ?? "grok-4.20-0309-non-reasoning",
  elevenKey: process.env.ELEVENLABS_API_KEY ?? "",
  elevenVoiceId: process.env.ELEVENLABS_VOICE_ID ?? "",
  openFdaKey: process.env.OPENFDA_API_KEY ?? "",
  cortexSearchService: process.env.CORTEX_SEARCH_SERVICE ?? "",
  snowflake: {
    account: process.env.SNOWFLAKE_ACCOUNT ?? "",
    username: process.env.SNOWFLAKE_USERNAME ?? "",
    password: process.env.SNOWFLAKE_PASSWORD ?? "",
    privateKeyB64: process.env.SNOWFLAKE_PRIVATE_KEY_B64 ?? "",
    warehouse: process.env.SNOWFLAKE_WAREHOUSE ?? "",
    database: process.env.SNOWFLAKE_DATABASE ?? "",
    schema: process.env.SNOWFLAKE_SCHEMA ?? "PUBLIC",
    role: process.env.SNOWFLAKE_ROLE ?? "",
  },
};

export const isSnowflakeConfigured = () =>
  !!(env.snowflake.account && env.snowflake.username && (env.snowflake.password || env.snowflake.privateKeyB64));
export const isXaiConfigured = () => !!env.xaiKey;
export const isElevenConfigured = () => !!env.elevenKey;

/** Human-readable mode summary for the UI's "demo mode" note and /api/health. */
export function modeSummary() {
  return {
    db: isSnowflakeConfigured() ? "snowflake" : "memory-seed",
    llm: isXaiConfigured() ? "grok" : "template",
    ttsPrimary: isXaiConfigured() ? "grok-voice" : "unavailable",
    ttsSecondary: isElevenConfigured() ? "elevenlabs" : "unavailable",
    speech: { en: isXaiConfigured() ? "grok" : "unavailable", es: isElevenConfigured() ? "elevenlabs" : "unavailable" },
  };
}
