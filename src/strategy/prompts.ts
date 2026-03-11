import type { BrandIdentity, Competitor, KeywordGroup } from "../types/index.js";

export const STRATEGY_SYSTEM_PROMPT = `Eres StrategyGravity, un estratega de marketing digital de elite con 20 anos de experiencia en agencias de primer nivel como McCann, Ogilvy y Wunderman Thompson.

REGLAS CRITICAS:
1. SIEMPRE responde en espanol (Latinoamerica)
2. Cada seccion debe ser DETALLADA y EXTENSA - minimo 3-4 parrafos por seccion
3. Usa datos concretos, porcentajes y referencias reales cuando sea posible
4. No uses generalizaciones vagas - se ESPECIFICO para la industria y el negocio
5. Cada analisis de competidor debe ser extenso con insights unicos
6. SIEMPRE retorna JSON valido cuando se solicite - sin markdown, sin backticks
7. Tu analisis debe ser TAN PROFESIONAL que podria presentarse a un C-suite sin modificaciones
8. Piensa como un consultor que cobra $50,000 USD por estrategia`;

// ─── Point 1: Descripcion ───
export function promptDescription(brand: BrandIdentity): string {
  return `Crea la seccion "Descripcion" de la estrategia de marketing para "${brand.companyName}" en la industria de ${brand.industry}.

Informacion de la empresa: ${brand.description}
Sitio web: ${brand.website || "No disponible"}
Ubicacion: ${brand.location || "No especificada"}

La descripcion debe incluir:
- Un RESUMEN EJECUTIVO de 4-5 parrafos (minimo 300 palabras) que cubra: que hace la empresa, su propuesta de valor unica, su posicionamiento actual en el mercado, su publico principal, y por que necesita esta estrategia digital
- Un OBJETIVO ESTRATEGICO especifico, medible, alcanzable, relevante y temporal (SMART) para los proximos 6-12 meses

Se EXTENSO y PROFESIONAL. El resumen debe leerse como si lo hubiera escrito McKinsey.

Retorna SOLO JSON valido:
{
  "summary": "resumen ejecutivo extenso de 300+ palabras aqui...",
  "objective": "objetivo SMART detallado aqui..."
}`;
}

// ─── Point 2: Competitor Analysis ───
export function promptCompetitorAnalysis(brand: BrandIdentity, competitors: Competitor[]): string {
  return `Basado en estos datos de competidores de "${brand.companyName}", crea un analisis PROFUNDO para cada uno.

Datos de competidores:
${JSON.stringify(competitors, null, 2)}

Para CADA competidor, expande y refina el analisis. Cada competidor debe tener:
- detailedAnalysis: AL MENOS 250 palabras de analisis profundo sobre su posicionamiento, modelo de negocio, estrategia digital, y como compite
- services: lista completa de servicios
- strengths: MINIMO 3 fortalezas con explicacion detallada (2+ oraciones cada una)
- weaknesses: MINIMO 3 debilidades con explicacion detallada
- opportunitiesForUs: MINIMO 2 oportunidades especificas y accionables para ${brand.companyName}

Retorna SOLO JSON valido:
{
  "competitors": [
    {
      "name": "nombre",
      "website": "url",
      "detailedAnalysis": "analisis extenso de 250+ palabras...",
      "services": ["servicio1", "servicio2"],
      "strengths": ["fortaleza detallada con explicacion de 2+ oraciones"],
      "weaknesses": ["debilidad detallada con explicacion de 2+ oraciones"],
      "opportunitiesForUs": ["oportunidad especifica y accionable"],
      "seoAnalysis": { "topKeywords": ["kw1", "kw2"], "estimatedTraffic": "nivel" }
    }
  ]
}`;
}

// ─── Point 3: Comparative Analysis ───
export function promptComparativeAnalysis(brand: BrandIdentity, competitors: Competitor[]): string {
  return `Crea un analisis comparativo COMPLETO de "${brand.companyName}" vs sus competidores.

Empresa: ${brand.companyName} (${brand.industry})
Competidores: ${competitors.map((c) => `${c.name} (${c.website})`).join(", ")}

Compara en estas dimensiones:
1. Servicios ofrecidos
2. Enfoque de precios/posicionamiento
3. Tecnologia y presencia digital
4. Experiencia del cliente
5. Alcance geografico
6. Posicionamiento de marca
7. Presencia SEO y marketing digital
8. Diferenciadores clave

Escribe un analisis comparativo EXTENSO de minimo 500 palabras que incluya una narrativa clara de donde se posiciona ${brand.companyName} frente a cada competidor, identificando gaps, ventajas y oportunidades estrategicas.

Retorna SOLO JSON valido:
{
  "comparativeAnalysis": "analisis comparativo extenso de 500+ palabras con comparaciones punto por punto..."
}`;
}

// ─── Point 4: Keywords ───
export function promptKeywords(brand: BrandIdentity, rawKeywords: KeywordGroup[]): string {
  return `Refina y expande esta investigacion de keywords para "${brand.companyName}" en ${brand.industry}.

Datos de keywords:
${JSON.stringify(rawKeywords, null, 2)}

Organiza en estas 5 CATEGORIAS EXACTAS:
1. "Intencion Transaccional, Inversion y Visados" (High-Value Intent)
2. "Geograficas Urbanas y Edificios Emblematicos"
3. "Geograficas Costeras, Rurales y Emergentes"
4. "Tipologia Inmobiliaria y Conquista Competitiva"
5. "Informacional y Educativa"

MINIMO 8 keywords por categoria. Cada keyword debe ser especifica y relevante.

Retorna SOLO JSON valido:
{
  "keywordGroups": [
    {
      "category": "Nombre Exacto de Categoria",
      "keywords": [
        { "term": "keyword especifica", "intent": "transactional/informational/navigational", "volume": "high/medium/low", "difficulty": "high/medium/low" }
      ]
    }
  ]
}`;
}

// ─── Point 5: Strategic Conclusions ───
export function promptStrategicConclusions(brand: BrandIdentity, competitors: Competitor[], keywords: KeywordGroup[]): string {
  return `Basado en el analisis competitivo y de keywords de "${brand.companyName}", formula 4 CONCLUSIONES ESTRATEGICAS clave.

Industria: ${brand.industry}
Competidores: ${competitors.map((c) => `${c.name}: F[${c.strengths[0]}] D[${c.weaknesses[0]}]`).join("; ")}
Categorias de keywords: ${keywords.map((k) => k.category).join(", ")}

Cada conclusion debe:
- Identificar un insight CRITICO del mercado
- Estar respaldada por los datos competitivos analizados
- Tener un titulo descriptivo seguido de una explicacion de AL MENOS 100 palabras
- Ser accionable y estrategica

Formato: "Titulo de la Conclusion: explicacion detallada de 100+ palabras..."

Retorna SOLO JSON valido:
{
  "strategicConclusions": [
    "Titulo 1: explicacion detallada de 100+ palabras sobre la dinamica del mercado...",
    "Titulo 2: explicacion detallada sobre comportamiento del consumidor...",
    "Titulo 3: explicacion detallada sobre tecnologia y tendencias...",
    "Titulo 4: explicacion detallada sobre oportunidad de posicionamiento..."
  ]
}`;
}

// ─── Point 6: Differentiation ───
export function promptDifferentiation(brand: BrandIdentity, conclusions: string[]): string {
  return `Basado en las conclusiones estrategicas de "${brand.companyName}", propone 4 ESTRATEGIAS DE DIFERENCIACION unicas.

Conclusiones:
${conclusions.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Cada propuesta debe:
- Tener un nombre creativo y memorable (como "Astra Certified" o "Concierge Consultivo")
- Explicacion de AL MENOS 100 palabras de como implementarla
- Explicar POR QUE crea ventaja competitiva real
- Ser unica y no generica

Retorna SOLO JSON valido:
{
  "differentiationProposals": [
    "Nombre Propuesta 1: explicacion detallada de 100+ palabras sobre implementacion y ventaja...",
    "Nombre Propuesta 2: explicacion detallada...",
    "Nombre Propuesta 3: explicacion detallada...",
    "Nombre Propuesta 4: explicacion detallada..."
  ]
}`;
}

// ─── Point 7a: Services ───
export function promptServices(brand: BrandIdentity): string {
  return `Define los servicios principales de "${brand.companyName}" en ${brand.industry}.
Descripcion: ${brand.description}

Lista 4-8 servicios con descripciones profesionales de 2-3 oraciones cada uno.

Retorna SOLO JSON:
{
  "services": [
    { "name": "Nombre del Servicio", "description": "Descripcion profesional de 2-3 oraciones del servicio y su valor" }
  ]
}`;
}

// ─── Point 7b: Brand Design ───
export function promptBrandDesign(brand: BrandIdentity): string {
  return `Crea los lineamientos de diseno de marca para "${brand.companyName}".

Datos actuales:
- Colores: ${JSON.stringify(brand.colors)}
- Tipografias: ${JSON.stringify(brand.fonts)}
- Industria: ${brand.industry}

Retorna SOLO JSON:
{
  "personality": "3-4 oraciones describiendo la personalidad de la marca, su voz y como se comunica",
  "values": ["valor1", "valor2", "valor3", "valor4", "valor5"],
  "guidelines": "Lineamientos detallados de uso de marca - voz, consistencia visual, que hacer y que no hacer. Minimo 150 palabras.",
  "styleReferences": ["Referencia 1: descripcion de estetica/estilo", "Referencia 2", "Referencia 3"]
}`;
}

// ─── Point 8: Content Strategy ───
export function promptContentStrategy(brand: BrandIdentity, services: { name: string }[]): string {
  return `Crea la estrategia de contenido para "${brand.companyName}" en ${brand.industry}.

Servicios: ${services.map((s) => s.name).join(", ")}

Retorna SOLO JSON:
{
  "contentStrategy": {
    "targetAudience": ["segmento 1 con descripcion detallada", "segmento 2", "segmento 3"],
    "painPoints": ["dolor 1 con contexto y explicacion", "dolor 2", "dolor 3", "dolor 4"],
    "channels": ["LinkedIn", "Instagram", "TikTok", "Blog/SEO", "Facebook", "Google"],
    "focusAreas": ["zona geografica o tematica 1", "zona 2", "zona 3"],
    "tone": "Descripcion del tono ideal en 2-3 oraciones - como debe sonar la marca"
  }
}`;
}

// ─── Point 9: Content Pillars ───
export function promptContentPillars(brand: BrandIdentity, contentStrategy: { targetAudience: string[]; painPoints: string[] }): string {
  return `Crea 3 pilares de contenido para "${brand.companyName}".

Publico objetivo: ${contentStrategy.targetAudience.join(", ")}
Dolores: ${contentStrategy.painPoints.join(", ")}

Los 3 pilares deben sumar 100%. Cada pilar debe tener:
- Nombre descriptivo
- Porcentaje del total de contenido
- Descripcion de 2-3 oraciones explicando que cubre y por que
- 4-6 temas especificos

Retorna SOLO JSON:
{
  "contentPillars": [
    {
      "name": "Nombre del Pilar",
      "percentage": 40,
      "description": "Que cubre este pilar y por que es importante para la estrategia",
      "topics": ["tema1", "tema2", "tema3", "tema4"]
    }
  ]
}`;
}

// ─── Point 10: Content Grid ───
export function promptContentGrid(brand: BrandIdentity, pillars: { name: string; percentage: number }[]): string {
  return `Crea una grilla de contenido semanal para "${brand.companyName}".

Pilares: ${pillars.map((p) => `${p.name} (${p.percentage}%)`).join(", ")}

Crea un calendario Lunes a Viernes con contenido especifico para cada dia.
Incluye variedad de plataformas (Instagram, LinkedIn, TikTok, Blog) y tipos de contenido (Carrusel, Video, Reel, Post, Articulo).

Retorna SOLO JSON:
{
  "contentGrid": [
    { "day": "Lunes", "platform": "Instagram", "contentType": "Carrusel", "topic": "tema especifico", "pillar": "nombre del pilar", "caption": "idea de caption" },
    { "day": "Martes", "platform": "LinkedIn", "contentType": "Post", "topic": "tema", "pillar": "pilar" }
  ]
}`;
}

// ─── Point 11: KPIs ───
export function promptKPIs(brand: BrandIdentity): string {
  return `Define los KPIs para la estrategia de marketing de "${brand.companyName}" en ${brand.industry}.

Organiza en estas categorias:
- Atraccion y SEO
- Conversion y Ventas
- Retencion y Lealtad
- Marca y Engagement

Para cada KPI incluye: metrica, descripcion clara de que mide y por que importa, y un target sugerido.

Retorna SOLO JSON:
{
  "kpis": [
    { "category": "Atraccion y SEO", "metric": "Nombre de la Metrica", "description": "Que mide y por que es importante", "target": "target sugerido" }
  ]
}`;
}

// ─── Point 12a: Timeline ───
export function promptTimeline(brand: BrandIdentity): string {
  return `Crea un cronograma de implementacion de 12 semanas para "${brand.companyName}".

Divide en 4 fases con tareas especificas y accionables.

Retorna SOLO JSON:
{
  "implementationTimeline": [
    { "phase": "Fase 1: Nombre", "weeks": "Semanas 1-3", "tasks": ["tarea especifica 1", "tarea 2", "tarea 3", "tarea 4"] }
  ]
}`;
}

// ─── Point 12b: Conclusions ───
export function promptConclusions(brand: BrandIdentity, strategySummary: string): string {
  return `Crea las conclusiones y recomendaciones finales para "${brand.companyName}".

Resumen de la estrategia: ${strategySummary}

Proporciona:
- 4 conclusiones clave (cada una de 2-3 oraciones)
- 4 recomendaciones accionables (cada una de 2-3 oraciones)

Retorna SOLO JSON:
{
  "conclusions": ["conclusion detallada 1", "conclusion 2", "conclusion 3", "conclusion 4"],
  "recommendations": ["recomendacion accionable 1", "recomendacion 2", "recomendacion 3", "recomendacion 4"]
}`;
}
