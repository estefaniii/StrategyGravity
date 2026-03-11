import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../../.env");
config({ path: envPath, override: true });

export interface EnvConfig {
  ANTHROPIC_API_KEY: string;
  GROQ_API_KEY: string;
  GEMINI_API_KEY: string;
  OPENROUTER_API_KEY: string;
  DB_PATH: string;
  PORT: string;
  OUTPUT_DIR: string;
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    console.error(`[ENV] Missing required env var: ${key}`);
    process.exit(1);
  }
  return value;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export const env: EnvConfig = {
  ANTHROPIC_API_KEY: requireEnv("ANTHROPIC_API_KEY"),
  GROQ_API_KEY: optionalEnv("GROQ_API_KEY", ""),
  GEMINI_API_KEY: optionalEnv("GEMINI_API_KEY", ""),
  OPENROUTER_API_KEY: optionalEnv("OPENROUTER_API_KEY", ""),
  DB_PATH: optionalEnv("DB_PATH", "./memory.db"),
  PORT: optionalEnv("PORT", "3000"),
  OUTPUT_DIR: optionalEnv("OUTPUT_DIR", "./output"),
};
