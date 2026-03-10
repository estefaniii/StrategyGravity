import { generate, getFastProvider } from "../llm/index.js";
import {
  getLatestStrategy,
  getStrategy,
  listStrategies,
  saveMessage,
  getConversationHistory,
} from "./memory.js";
import { extractBrandFromUrl, extractBrandFromInstagram, extractBrandFromDescription } from "../tools/brand-extractor.js";
import { generateStrategy } from "../strategy/generator.js";
import { generateContent } from "../content/generator.js";
import type { MarketingStrategy, BrandIdentity, ContentType, AgentMessage } from "../types/index.js";
import chalk from "chalk";

const MAX_ITERATIONS = 20;

interface AgentState {
  currentStrategy: MarketingStrategy | null;
  iterationCount: number;
}

const state: AgentState = {
  currentStrategy: null,
  iterationCount: 0,
};

export function loadCurrentStrategy(): MarketingStrategy | null {
  if (!state.currentStrategy) {
    state.currentStrategy = getLatestStrategy();
  }
  return state.currentStrategy;
}

function classifyIntent(input: string): string {
  const lower = input.toLowerCase();

  // Strategy generation
  if (lower.includes("estrategia") && (lower.includes("nueva") || lower.includes("crear") || lower.includes("generar") || lower.includes("genera"))) return "create_strategy";
  if (lower.match(/^https?:\/\//)) return "analyze_url";
  if (lower.startsWith("@") || lower.includes("instagram.com")) return "analyze_instagram";

  // Content generation
  if (lower.includes("blog") || lower.includes("articulo")) return "gen_blog";
  if (lower.includes("linkedin")) return "gen_linkedin";
  if (lower.includes("instagram") || lower.includes("post ig")) return "gen_instagram";
  if (lower.includes("reel") || lower.includes("tiktok")) return "gen_reel";
  if (lower.includes("visual") || lower.includes("imagen") || lower.includes("prompt visual")) return "gen_visual";
  if (lower.includes("tweet") || lower.includes("twitter")) return "gen_tweet";
  if (lower.includes("contenido semanal") || lower.includes("grilla") || lower.includes("semana")) return "gen_weekly";

  // Strategy queries
  if (lower.includes("ver estrategia") || lower.includes("mostrar estrategia") || lower.includes("resumen")) return "show_strategy";
  if (lower.includes("listar") || lower.includes("estrategias guardadas")) return "list_strategies";
  if (lower.includes("cargar estrategia") || lower.match(/estrategia\s+#?\d+/)) return "load_strategy";
  if (lower.includes("presentacion") || lower.includes("slides") || lower.includes("google slides")) return "generate_slides";
  if (lower.includes("actualizar") || lower.includes("update")) return "update_strategy";

  // Help
  if (lower.includes("ayuda") || lower.includes("help") || lower === "?") return "help";
  if (lower.includes("salir") || lower.includes("exit") || lower.includes("quit")) return "exit";

  return "chat";
}

export async function processInput(input: string): Promise<string> {
  state.iterationCount++;
  if (state.iterationCount > MAX_ITERATIONS) {
    state.iterationCount = 0;
    return "Limite de iteraciones alcanzado. Escribe tu siguiente instruccion.";
  }

  const intent = classifyIntent(input);

  // Save user message
  saveMessage({ role: "user", content: input, timestamp: new Date().toISOString() }, state.currentStrategy?.id);

  let response: string;

  switch (intent) {
    case "create_strategy":
      response = await handleCreateStrategy(input);
      break;
    case "analyze_url":
      response = await handleAnalyzeUrl(input);
      break;
    case "analyze_instagram":
      response = await handleAnalyzeInstagram(input);
      break;
    case "gen_blog":
    case "gen_linkedin":
    case "gen_instagram":
    case "gen_reel":
    case "gen_visual":
    case "gen_tweet":
      response = await handleGenerateContent(intent, input);
      break;
    case "gen_weekly":
      response = await handleWeeklyContent();
      break;
    case "show_strategy":
      response = handleShowStrategy();
      break;
    case "list_strategies":
      response = handleListStrategies();
      break;
    case "load_strategy":
      response = handleLoadStrategy(input);
      break;
    case "generate_slides":
      response = await handleGenerateSlides();
      break;
    case "help":
      response = getHelpText();
      break;
    case "exit":
      response = "__EXIT__";
      break;
    case "chat":
    default:
      response = await handleChat(input);
      break;
  }

  // Save assistant response
  if (response !== "__EXIT__") {
    saveMessage({ role: "assistant", content: response, timestamp: new Date().toISOString() }, state.currentStrategy?.id);
  }

  state.iterationCount = 0;
  return response;
}

// ─── Handlers ───

async function handleCreateStrategy(input: string): Promise<string> {
  // Extract company description from input
  const desc = input.replace(/crear|generar?|nueva|estrategia|para/gi, "").trim();
  if (!desc) {
    return "Necesito una descripcion de la empresa. Puedes proporcionar:\n- Una URL del sitio web\n- Un perfil de Instagram (@usuario)\n- Una descripcion de la empresa";
  }

  const brandResult = await extractBrandFromDescription(desc);
  if (!brandResult.success) return `Error al analizar la marca: ${brandResult.error}`;

  const brand = brandResult.data as BrandIdentity;
  const strategy = await generateStrategy(brand);
  state.currentStrategy = strategy;

  return `Estrategia generada para "${strategy.companyName}" (ID: ${strategy.id}).\n\nUsa "ver estrategia" para ver el resumen, o pideme que genere contenido.`;
}

async function handleAnalyzeUrl(url: string): Promise<string> {
  const cleanUrl = url.trim().split(/\s/)[0];
  const brandResult = await extractBrandFromUrl(cleanUrl);
  if (!brandResult.success) return `Error al analizar la URL: ${brandResult.error}`;

  const brand = brandResult.data as BrandIdentity;
  console.log(chalk.green(`\n  Marca extraida: ${brand.companyName}`));

  const strategy = await generateStrategy(brand);
  state.currentStrategy = strategy;

  return `Estrategia generada para "${strategy.companyName}" (ID: ${strategy.id}).\n\nLa marca fue extraida de ${cleanUrl}. Usa "ver estrategia" para el resumen completo.`;
}

async function handleAnalyzeInstagram(input: string): Promise<string> {
  const handle = input.trim().split(/\s/)[0];
  const brandResult = await extractBrandFromInstagram(handle);
  if (!brandResult.success) return `Error al analizar Instagram: ${brandResult.error}`;

  const brand = brandResult.data as BrandIdentity;
  const strategy = await generateStrategy(brand);
  state.currentStrategy = strategy;

  return `Estrategia generada para "${strategy.companyName}" (ID: ${strategy.id}) basada en ${handle}.`;
}

async function handleGenerateContent(intent: string, input: string): Promise<string> {
  const strategy = loadCurrentStrategy();
  if (!strategy) return "No hay estrategia cargada. Crea una primero con una URL, Instagram o descripcion.";

  const typeMap: Record<string, ContentType> = {
    gen_blog: "blog",
    gen_linkedin: "linkedin_post",
    gen_instagram: "instagram_post",
    gen_reel: "reel_script",
    gen_visual: "visual_prompt",
    gen_tweet: "tweet",
  };

  const type = typeMap[intent] || "blog";
  // Extract topic from input
  const topic = input
    .replace(/genera?r?|crear?|escrib[ei]r?|blog|linkedin|instagram|post|reel|tiktok|visual|imagen|tweet|twitter|sobre|de|un|una|para/gi, "")
    .trim() || `${strategy.contentPillars[0]?.topics[0] || strategy.companyName}`;

  const content = await generateContent(strategy, type, topic);
  return `${chalk.bold("Contenido generado:")}\n\n${content.body}`;
}

async function handleWeeklyContent(): Promise<string> {
  const strategy = loadCurrentStrategy();
  if (!strategy) return "No hay estrategia cargada.";

  const { generateWeeklyContent } = await import("../content/generator.js");
  console.log(chalk.yellow("\n  Generando contenido semanal basado en la grilla...\n"));
  const contents = await generateWeeklyContent(strategy);

  return `Contenido semanal generado: ${contents.length} piezas.\nUsa "listar contenido" para ver todo.`;
}

function handleShowStrategy(): string {
  const strategy = loadCurrentStrategy();
  if (!strategy) return "No hay estrategia cargada.";

  return [
    chalk.bold.magenta(`\n  ESTRATEGIA: ${strategy.companyName} (ID: ${strategy.id})`),
    chalk.dim(`  Creada: ${strategy.createdAt}\n`),
    chalk.bold("  1. Descripcion:"),
    `  ${strategy.description.summary}`,
    `  Objetivo: ${strategy.description.objective}\n`,
    chalk.bold(`  2. Competidores (${strategy.competitors.length}):`),
    ...strategy.competitors.map(c => `  - ${c.name}: ${c.strengths[0]}`),
    "",
    chalk.bold("  5. Conclusiones Estrategicas:"),
    ...strategy.strategicConclusions.map((c, i) => `  ${i + 1}. ${c.slice(0, 100)}...`),
    "",
    chalk.bold("  6. Diferenciacion:"),
    ...strategy.differentiationProposals.map((d, i) => `  ${i + 1}. ${d.slice(0, 100)}...`),
    "",
    chalk.bold("  10. Pilares de Contenido:"),
    ...strategy.contentPillars.map(p => `  - ${p.name} (${p.percentage}%)`),
    "",
    chalk.bold("  12. KPIs:"),
    ...strategy.kpis.slice(0, 4).map(k => `  - ${k.metric}`),
    "",
    chalk.dim("  Para ver un punto especifico, escribe 'ver punto N'"),
  ].join("\n");
}

function handleListStrategies(): string {
  const strategies = listStrategies();
  if (strategies.length === 0) return "No hay estrategias guardadas.";

  const lines = strategies.map(
    (s) => `  #${s.id} - ${s.companyName} (${s.createdAt})`
  );
  return chalk.bold("Estrategias guardadas:\n") + lines.join("\n") + "\n\nUsa 'cargar estrategia #N' para cargar una.";
}

function handleLoadStrategy(input: string): string {
  const match = input.match(/#?(\d+)/);
  if (!match) return "Especifica el ID de la estrategia: 'cargar estrategia #1'";

  const id = parseInt(match[1]);
  const strategy = getStrategy(id);
  if (!strategy) return `No se encontro la estrategia #${id}`;

  state.currentStrategy = strategy;
  return `Estrategia cargada: "${strategy.companyName}" (ID: ${id})`;
}

async function handleGenerateSlides(): Promise<string> {
  const strategy = loadCurrentStrategy();
  if (!strategy) return "No hay estrategia cargada.";

  const { generatePresentation } = await import("../tools/slides-generator.js");
  const result = await generatePresentation(strategy);

  if (!result.success) return `Error al generar presentacion: ${result.error}`;

  const data = result.data as Record<string, unknown>;
  if (data.url) {
    return `Presentacion creada:\n  Ver: ${data.url}\n  Editar: ${data.editUrl}\n  Slides: ${data.slideCount}`;
  }
  return `Presentacion generada en modo offline (${data.slideCount} slides).\nConfigura service-account.json para exportar a Google Slides.`;
}

async function handleChat(input: string): Promise<string> {
  const strategy = loadCurrentStrategy();

  // Build context from conversation history
  const history = getConversationHistory(10, strategy?.id);
  const historyText = history
    .map((m) => `${m.role === "user" ? "Usuario" : "Agente"}: ${m.content}`)
    .join("\n");

  const systemPrompt = strategy
    ? `Eres StrategyGravity, un agente de marketing AI. Tienes cargada la estrategia de "${strategy.companyName}".
Pilares: ${strategy.contentPillars.map(p => p.name).join(", ")}.
Servicios: ${strategy.services.map(s => s.name).join(", ")}.
Tono: ${strategy.contentStrategy.tone}.
Responde en espanol, de forma concisa y util. Si el usuario pide contenido, generalo basandote en la estrategia.`
    : `Eres StrategyGravity, un agente de marketing AI. No hay estrategia cargada.
Ayuda al usuario a crear una proporcionando una URL, un perfil de Instagram o una descripcion de empresa.
Responde en espanol.`;

  const prompt = historyText
    ? `Historial reciente:\n${historyText}\n\nUsuario: ${input}`
    : input;

  try {
    const response = await generate(prompt, systemPrompt, { maxTokens: 2048 });
    return response.text;
  } catch (err) {
    return `Error al procesar: ${(err as Error).message}`;
  }
}

function getHelpText(): string {
  return `
${chalk.bold.magenta("  StrategyGravity - Comandos disponibles:")}

${chalk.bold("  Crear Estrategia:")}
  - Pega una URL de sitio web
  - Escribe un @usuario de Instagram
  - "Crear estrategia para [descripcion de empresa]"

${chalk.bold("  Gestionar Estrategias:")}
  - "ver estrategia" - Resumen de la estrategia actual
  - "listar estrategias" - Ver todas las guardadas
  - "cargar estrategia #N" - Cargar una especifica
  - "presentacion" / "slides" - Generar Google Slides

${chalk.bold("  Generar Contenido:")}
  - "blog sobre [tema]" - Articulo de blog
  - "linkedin sobre [tema]" - Post de LinkedIn
  - "instagram sobre [tema]" - Post de Instagram
  - "reel sobre [tema]" - Guion de Reel/TikTok
  - "visual sobre [tema]" - Prompt visual para imagenes
  - "tweet sobre [tema]" - Tweets
  - "contenido semanal" - Generar toda la grilla

${chalk.bold("  General:")}
  - Escribe cualquier pregunta sobre marketing
  - "ayuda" - Ver este mensaje
  - "salir" - Cerrar el agente
`;
}
