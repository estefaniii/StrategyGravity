// ─── Brand Identity ───

export interface BrandIdentity {
  companyName: string;
  industry: string;
  description: string;
  colors: { primary: string; secondary: string; accent: string };
  fonts: { heading: string; body: string };
  logo?: string;
  website?: string;
  instagram?: string;
  location?: string;
  confirmed: boolean;
}

// ─── Web Search & Scraping ───

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  position: number;
}

export interface ScrapedCompetitorData {
  url: string;
  title: string;
  description: string;
  bodyText: string;
  services: string[];
  socialLinks: string[];
  techStack?: string[];
}

// ─── Competitor ───

export interface Competitor {
  name: string;
  website: string;
  urlVerified?: boolean;
  services: string[];
  strengths: string[];
  weaknesses: string[];
  opportunitiesForUs: string[];
  detailedAnalysis?: string;
  seoAnalysis?: {
    domainAuthority?: number;
    topKeywords: string[];
    estimatedTraffic?: string;
  };
}

// ─── Keywords ───

export interface KeywordGroup {
  category: string;
  keywords: { term: string; intent: string; volume?: string; difficulty?: string }[];
}

// ─── Content Pillar ───

export interface ContentPillar {
  name: string;
  percentage: number;
  description: string;
  topics: string[];
}

// ─── Content Grid Item ───

export interface ContentGridItem {
  day: string;
  platform: string;
  contentType: string;
  topic: string;
  pillar: string;
  caption?: string;
}

// ─── KPI ───

export interface KPI {
  category: string;
  metric: string;
  description: string;
  target?: string;
}

// ─── Full 12-Point Strategy ───

export interface MarketingStrategy {
  id?: number;
  companyName: string;
  createdAt: string;
  updatedAt: string;

  // 1. Descripcion
  description: { summary: string; objective: string };

  // 2. Analisis de Competencia (5 competidores reales)
  competitors: Competitor[];

  // 3. Analisis Comparativo
  comparativeAnalysis: string;

  // 4. Keywords Estrategicas
  keywordGroups: KeywordGroup[];

  // 5. Conclusiones Estrategicas (4 puntos)
  strategicConclusions: string[];

  // 6. Propuestas de Diferenciacion (4 puntos)
  differentiationProposals: string[];

  // 7. Servicios & Diseno de Marca
  services: { name: string; description: string }[];
  brandDesign: {
    identity: BrandIdentity;
    personality: string;
    values: string[];
    guidelines: string;
    styleReferences: string[];
  };

  // 8. Estrategia de Contenido
  contentStrategy: {
    targetAudience: string[];
    painPoints: string[];
    channels: string[];
    focusAreas: string[];
    tone: string;
  };

  // 9. Pilares de Contenido
  contentPillars: ContentPillar[];

  // 10. Grilla de Contenido
  contentGrid: ContentGridItem[];

  // 11. KPIs
  kpis: KPI[];

  // 12. Cronograma + Conclusiones y Recomendaciones
  implementationTimeline: { phase: string; weeks: string; tasks: string[] }[];
  conclusions: string[];
  recommendations: string[];
}

// ─── Agent Types ───

export type LLMProvider = "claude" | "gemini" | "groq" | "openrouter";

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface AgentMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

export interface AgentContext {
  currentStrategy?: MarketingStrategy;
  brandIdentity?: BrandIdentity;
  conversationHistory: AgentMessage[];
  activeToolCalls: string[];
}

// ─── Content Generation ───

export type ContentType = "blog" | "linkedin_post" | "instagram_post" | "reel_script" | "visual_prompt" | "tweet";

export interface GeneratedContent {
  id?: number;
  strategyId: number;
  type: ContentType;
  title: string;
  body: string;
  keywords: string[];
  pillar: string;
  platform: string;
  createdAt: string;
}

// ─── Progress callback ───

export type ProgressCallback = (step: number, total: number, message: string) => void;
