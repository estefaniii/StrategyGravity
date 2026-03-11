import { config } from "dotenv";
config();

export interface EnvConfig {
  ANTHROPIC_API_KEY: string;
  GROQ_API_KEY: string;
  GEMINI_API_KEY: string;
  OPENROUTER_API_KEY: string;
  DB_PATH: string;
  GOOGLE_APPLICATION_CREDENTIALS: string;
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
  GOOGLE_APPLICATION_CREDENTIALS: optionalEnv("GOOGLE_APPLICATION_CREDENTIALS", "./service-account.json"),
};
