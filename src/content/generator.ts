import { generate } from "../llm/index.js";
import { saveContent } from "../core/memory.js";
import { getContentSystemPrompt, getContentPrompt } from "./prompts.js";
import type { MarketingStrategy, ContentType, GeneratedContent } from "../types/index.js";
import chalk from "chalk";

export async function generateContent(
  strategy: MarketingStrategy,
  type: ContentType,
  topic: string,
  pillar?: string
): Promise<GeneratedContent> {
  const systemPrompt = getContentSystemPrompt(strategy);
  const userPrompt = getContentPrompt(type, topic, strategy);

  console.log(chalk.cyan(`\n  Generando ${type} sobre "${topic}"...`));

  const response = await generate(userPrompt, systemPrompt, { maxTokens: 4096 });

  // Extract keywords used
  const keywords = strategy.keywordGroups
    .flatMap((g) => g.keywords)
    .filter((k) => response.text.toLowerCase().includes(k.term.toLowerCase()))
    .map((k) => k.term)
    .slice(0, 10);

  const activePillar =
    pillar ||
    strategy.contentPillars.find((p) =>
      p.topics.some((t) => topic.toLowerCase().includes(t.toLowerCase()))
    )?.name ||
    strategy.contentPillars[0]?.name ||
    "General";

  const platform = {
    blog: "Web/Blog",
    linkedin_post: "LinkedIn",
    instagram_post: "Instagram",
    reel_script: "Instagram/TikTok",
    visual_prompt: "Visual/Design",
    tweet: "Twitter/X",
  }[type];

  const content: GeneratedContent = {
    strategyId: strategy.id!,
    type,
    title: topic,
    body: response.text,
    keywords,
    pillar: activePillar,
    platform,
    createdAt: new Date().toISOString(),
  };

  // Save to SQLite
  const id = saveContent(content);
  content.id = id;

  console.log(chalk.green(`  Contenido generado y guardado (ID: ${id})`));
  return content;
}

export async function generateBatchContent(
  strategy: MarketingStrategy,
  requests: Array<{ type: ContentType; topic: string; pillar?: string }>
): Promise<GeneratedContent[]> {
  const results: GeneratedContent[] = [];
  for (const req of requests) {
    const content = await generateContent(strategy, req.type, req.topic, req.pillar);
    results.push(content);
  }
  return results;
}

export async function generateWeeklyContent(strategy: MarketingStrategy): Promise<GeneratedContent[]> {
  const results: GeneratedContent[] = [];

  for (const gridItem of strategy.contentGrid) {
    const typeMap: Record<string, ContentType> = {
      Carrusel: "instagram_post",
      Video: "reel_script",
      Reel: "reel_script",
      Post: "instagram_post",
      Article: "blog",
      Frases: "instagram_post",
    };

    const type = typeMap[gridItem.contentType] || "instagram_post";
    const content = await generateContent(strategy, type, gridItem.topic, gridItem.pillar);
    results.push(content);
  }

  return results;
}
