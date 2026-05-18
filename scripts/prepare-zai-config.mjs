import { readFile, writeFile } from "node:fs/promises";

async function loadEnvFallback() {
  if (process.env.ZAI_API_KEY) return;

  try {
    const envText = await readFile(".env", "utf8");
    for (const line of envText.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const separatorIndex = trimmed.indexOf("=");
      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['\"]|['\"]$/g, "");
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // No local .env file available; rely on the real environment.
  }
}

await loadEnvFallback();

const apiKey = process.env.ZAI_API_KEY;
const baseUrl = process.env.ZAI_BASE_URL || "https://open.bigmodel.cn/api/paas/v4";

if (!apiKey) {
  console.warn("[prepare-zai-config] ZAI_API_KEY is not set; skipping .z-ai-config generation.");
  process.exit(0);
}

const config = {
  baseUrl,
  apiKey,
  chatId: process.env.ZAI_CHAT_ID,
  userId: process.env.ZAI_USER_ID,
  token: process.env.ZAI_TOKEN,
};

await writeFile(".z-ai-config", `${JSON.stringify(config, null, 2)}\n`, "utf8");
console.log("[prepare-zai-config] Wrote .z-ai-config for build/runtime use.");