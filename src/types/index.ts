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
  confirmed: boolean;
}

// ─── Competitor ───

export interface Competitor {
  name: string;
  website: string;
  services: string[];
  strengths: string[];
  weaknesses: string[];
  opportunitiesForUs: string[];
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

// ─── Full 14-Point Strategy ───

export interface MarketingStrategy {
  id?: number;
  companyName: string;
  createdAt: string;
  updatedAt: string;

  // 1. Descripción
  description: { summary: string; objective: string };

  // 2. Análisis de Competencia
  competitors: Competitor[];

  // 3. Análisis Comparativo
  comparativeAnalysis: string;

  // 4. Keywords Estratégicas
  keywordGroups: KeywordGroup[];

  // 5. Conclusiones Estratégicas
  strategicConclusions: string[];

  // 6. Propuestas de Diferenciación
  differentiationProposals: string[];

  // 7. Servicios
  services: { name: string; description: string }[];

  // 8. Diseño de Marca
  brandDesign: {
    identity: BrandIdentity;
    personality: string;
    values: string[];
    guidelines: string;
    styleReferences: string[];
  };

  // 9. Estrategia de Contenido
  contentStrategy: {
    targetAudience: string[];
    painPoints: string[];
    channels: string[];
    focusAreas: string[];
    tone: string;
  };

  // 10. Pilares de Contenido
  contentPillars: ContentPillar[];

  // 11. Grilla de Contenido
  contentGrid: ContentGridItem[];

  // 12. KPIs
  kpis: KPI[];

  // 13. Cronograma
  implementationTimeline: { phase: string; weeks: string; tasks: string[] }[];

  // 14. Conclusiones y Recomendaciones
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
