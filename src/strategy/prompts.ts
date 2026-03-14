import type { BrandIdentity, Competitor, KeywordGroup } from "../types/index.js";

export const STRATEGY_SYSTEM_PROMPT = `Eres StrategyGravity, un estratega de marketing digital de élite con 20 años de experiencia en agencias de primer nivel como McCann, Ogilvy y Wunderman Thompson.

REGLAS CRÍTICAS:
1. SIEMPRE responde en español (Latinoamérica)
2. Cada sección debe ser DETALLADA y EXTENSA - mínimo 3-4 párrafos por sección
3. Usa datos concretos, porcentajes y referencias reales cuando sea posible
4. No uses generalizaciones vagas - sé ESPECÍFICO para la industria y el negocio
5. Cada análisis de competidor debe ser extenso con insights únicos
6. Tu análisis debe ser TAN PROFESIONAL que podría presentarse a un C-suite sin modificaciones
7. Piensa como un consultor que cobra $50,000 USD por estrategia

REGLAS DE FORMATO (OBLIGATORIAS):
- Tu respuesta DEBE ser SOLO un objeto JSON válido. NADA más.
- NO uses backticks (\`\`\`), NO uses markdown, NO agregues texto antes o después del JSON.
- Tu respuesta debe COMENZAR con { y TERMINAR con }
- Asegúrate de que el JSON esté completo y no truncado.
- Usa comillas dobles para strings. Escapa comillas internas con \\"
- NO uses comillas simples en el JSON.`;

// ─── Point 1: Descripción ───
export function promptDescription(brand: BrandIdentity): string {
  return `Crea la sección "Descripción" de la estrategia de marketing para "${brand.companyName}" en la industria de ${brand.industry}.

Información de la empresa: ${brand.description}
Sitio web: ${brand.website || "No disponible"}
Ubicación: ${brand.location || "No especificada"}

La descripción debe incluir:
- Un RESUMEN EJECUTIVO CONCISO de 2-3 párrafos (máximo 150 palabras) que cubra: qué hace la empresa, su propuesta de valor y su público principal. Sé directo, sin relleno.
- Un OBJETIVO GENERAL de la empresa en 1-2 oraciones: describe el propósito central de la empresa y lo que busca lograr para sus clientes (NO un objetivo SMART numérico, sino aspiracional, como: "Conectar a inversores con oportunidades premium, protegiendo su patrimonio y elevando su calidad de vida")

Sé CONCISO y PROFESIONAL. Cada palabra debe aportar valor.

Retorna SOLO JSON válido:
{
  "summary": "resumen ejecutivo conciso de máximo 150 palabras...",
  "objective": "objetivo general aspiracional en 1-2 oraciones..."
}`;
}

// ─── Point 2: Competitor Analysis ───
export function promptCompetitorAnalysis(brand: BrandIdentity, competitors: Competitor[]): string {
  const hasData = competitors.length > 0;
  const dataSection = hasData
    ? `Datos de competidores encontrados vía web:\n${JSON.stringify(competitors, null, 2)}\n\nPara CADA competidor, expande y refina el análisis. Si hay menos de 5 competidores en los datos, AGREGA competidores REALES adicionales hasta completar EXACTAMENTE 5.`
    : `No se encontraron competidores vía búsqueda web. IDENTIFICA EXACTAMENTE 5 competidores REALES de "${brand.companyName}" en la industria de ${brand.industry}${brand.location ? ` en ${brand.location}` : ""}. Usa tu conocimiento para nombrar empresas REALES con sus sitios web verdaderos. Deben ser empresas que aparecerían en los primeros resultados de Google al buscar "${brand.industry}${brand.location ? ` en ${brand.location}` : ""}".`;

  return `${dataSection}

Empresa analizada: "${brand.companyName}" - ${brand.industry}
${brand.website ? `Sitio web: ${brand.website}` : ""}
${brand.location ? `Ubicación: ${brand.location}` : ""}

Cada competidor debe tener:
- name: nombre real de la empresa
- website: URL real del sitio web
- detailedAnalysis: Un párrafo inicial describiendo qué hace la empresa (su especialidad/nicho), seguido de sus fortalezas y oportunidades para ${brand.companyName}. AL MENOS 200 palabras.
- services: lista de servicios principales (breve, como subtítulo)
- strengths: MÍNIMO 3 fortalezas con explicación detallada (2+ oraciones cada una). Escríbelas de forma narrativa y específica, con datos concretos cuando sea posible.
- weaknesses: MÍNIMO 3 debilidades con explicación detallada
- opportunitiesForUs: MÍNIMO 2 oportunidades ESPECÍFICAS y ACCIONABLES que expliquen cómo ${brand.companyName} puede superar a este competidor. Sé concreto: menciona qué modelo, servicio o enfoque puede adoptar ${brand.companyName} para captar a esos clientes.

IMPORTANTE: Debes retornar EXACTAMENTE 5 competidores. Deben ser empresas REALES, no inventadas. Incluye sus sitios web REALES. Si los datos de web tienen menos de 5, complementa con tu conocimiento.
${brand.location && !/mercado objetivo|no determinable/i.test(brand.location) ? `FACTOR GEOGRÁFICO CRÍTICO: Prioriza competidores que operen en ${brand.location} o en el mismo país/región. Deben competir en el MISMO SECTOR (${brand.industry}). Analiza cómo cada competidor se posiciona geográficamente y si tiene presencia local o regional.` : ""}

CRÍTICO - COMPETIDORES DIRECTOS:
- Cada competidor DEBE competir por el MISMO tipo de cliente que ${brand.companyName}
- Si ${brand.companyName} es una empresa de relocation para extranjeros, los competidores deben ser OTRAS empresas de relocation para extranjeros, NO inmobiliarias genéricas
- Las debilidades deben ser REALES y ESPECÍFICAS: sitio web lento, sin blog, diseño anticuado, falta de testimonios, precios opacos, sin presencia en redes, tecnología obsoleta, mala UX móvil, etc.
- Las oportunidades deben explicar EXACTAMENTE qué puede hacer ${brand.companyName} para captar los clientes de ese competidor

Retorna SOLO JSON válido:
{
  "competitors": [
    {
      "name": "nombre",
      "website": "url",
      "detailedAnalysis": "análisis extenso de 250+ palabras...",
      "services": ["servicio1", "servicio2"],
      "strengths": ["fortaleza detallada con explicación de 2+ oraciones"],
      "weaknesses": ["debilidad detallada con explicación de 2+ oraciones"],
      "opportunitiesForUs": ["oportunidad específica y accionable"],
      "seoAnalysis": { "topKeywords": ["kw1", "kw2"], "estimatedTraffic": "nivel" }
    }
  ]
}`;
}

// ─── Point 3: Comparative Analysis ───
export function promptComparativeAnalysis(brand: BrandIdentity, competitors: Competitor[]): string {
  return `Crea un análisis comparativo COMPLETO de "${brand.companyName}" vs sus competidores.

Empresa: ${brand.companyName} (${brand.industry})
Competidores: ${competitors.map((c) => `${c.name} (${c.website})`).join(", ")}

Compara en estas dimensiones:
1. Servicios ofrecidos
2. Enfoque de precios/posicionamiento
3. Tecnología y presencia digital
4. Experiencia del cliente
5. Alcance geográfico y presencia local/regional${brand.location ? ` (especialmente en ${brand.location})` : " (analiza en qué mercados opera cada competidor)"}
6. Posicionamiento de marca
7. Presencia SEO y marketing digital
8. Diferenciadores clave

Escribe un análisis comparativo EXTENSO de mínimo 500 palabras que incluya una narrativa clara de dónde se posiciona ${brand.companyName} frente a cada competidor, identificando gaps, ventajas y oportunidades estratégicas.

Retorna SOLO JSON válido:
{
  "comparativeAnalysis": "análisis comparativo extenso de 500+ palabras con comparaciones punto por punto..."
}`;
}

// ─── Point 4: Keywords ───
export function promptKeywords(brand: BrandIdentity, rawKeywords: KeywordGroup[]): string {
  const hasData = rawKeywords.length > 0;
  const dataSection = hasData
    ? `Datos de keywords encontrados:\n${JSON.stringify(rawKeywords, null, 2)}\n\nRefina, expande y reorganiza estas keywords.`
    : `No se encontraron keywords vía búsqueda web. GENERA keywords estratégicas basándote en tu conocimiento de la industria.`;

  return `${dataSection}

Empresa: "${brand.companyName}" - ${brand.industry}
${brand.location ? `Ubicación: ${brand.location}` : ""}
${brand.website ? `Sitio web: ${brand.website}` : ""}

Crea 5 CATEGORÍAS de keywords RELEVANTES para la industria de ${brand.industry}:
1. "Transaccional" - keywords con intención de compra/contratación directa
2. "Servicios Específicos" - keywords de servicios puntuales que ofrece la empresa
3. "Geográficas y Locales" - keywords con ubicación o mercado específico
4. "Competitiva y Conquista" - keywords que compiten contra alternativas
5. "Informacional y Educativa" - keywords de contenido y aprendizaje

MÍNIMO 8 keywords por categoría. Las keywords deben ser ESPECÍFICAS para ${brand.industry}, no genéricas.
${brand.location && !/mercado objetivo|no determinable/i.test(brand.location) ? `IMPORTANTE GEOGRÁFICO: Incluye keywords con la ubicación "${brand.location}" y zonas cercanas, especialmente en las categorías "Geográficas y Locales". Piensa en cómo buscan los usuarios de esa zona.` : ""}

IMPORTANTE: Si hay ubicación real, CADA categoría debe incluir al menos 2-3 keywords con la ubicación específica. Piensa como buscaría un cliente REAL: "relocation services panama", "mudanza internacional panamá", etc. Incluye:
- Keywords a nivel de ciudad
- Keywords a nivel de país
- Keywords estilo "cerca de mí" en español ("cerca de mí", "en mi zona")
- Combinaciones de servicio + ubicación

Retorna SOLO JSON válido:
{
  "keywordGroups": [
    {
      "category": "Nombre de Categoría",
      "keywords": [
        { "term": "keyword específica para ${brand.industry}", "intent": "transactional/informational/navigational", "volume": "high/medium/low", "difficulty": "high/medium/low" }
      ]
    }
  ]
}`;
}

// ─── Point 5: Strategic Conclusions ───
export function promptStrategicConclusions(brand: BrandIdentity, competitors: Competitor[], keywords: KeywordGroup[]): string {
  return `Basado en el análisis competitivo y de keywords de "${brand.companyName}", formula 4 CONCLUSIONES ESTRATÉGICAS clave.

Industria: ${brand.industry}
Competidores: ${competitors.map((c) => `${c.name || "?"}: F[${(c.strengths || [])[0] || "N/A"}] D[${(c.weaknesses || [])[0] || "N/A"}]`).join("; ")}
Categorías de keywords: ${keywords.map((k) => k.category).join(", ")}

Cada conclusión debe:
- Identificar un insight CRÍTICO del mercado
- Estar respaldada por los datos competitivos analizados
- Tener un título descriptivo seguido de una explicación de AL MENOS 100 palabras
- Ser accionable y estratégica

Formato: "Título de la Conclusión: explicación detallada de 100+ palabras..."

Retorna SOLO JSON válido:
{
  "strategicConclusions": [
    "Título 1: explicación detallada de 100+ palabras sobre la dinámica del mercado...",
    "Título 2: explicación detallada sobre comportamiento del consumidor...",
    "Título 3: explicación detallada sobre tecnología y tendencias...",
    "Título 4: explicación detallada sobre oportunidad de posicionamiento..."
  ]
}`;
}

// ─── Point 6: Differentiation ───
export function promptDifferentiation(brand: BrandIdentity, conclusions: string[]): string {
  return `Basado en las conclusiones estratégicas de "${brand.companyName}", propone 4 ESTRATEGIAS DE DIFERENCIACIÓN únicas.

Conclusiones:
${conclusions.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Cada propuesta debe:
- Tener un nombre creativo y memorable (como "Astra Certified" o "Concierge Consultivo")
- Explicación de AL MENOS 100 palabras de cómo implementarla
- Explicar POR QUÉ crea ventaja competitiva real
- Ser única y no genérica

Retorna SOLO JSON válido:
{
  "differentiationProposals": [
    "Nombre Propuesta 1: explicación detallada de 100+ palabras sobre implementación y ventaja...",
    "Nombre Propuesta 2: explicación detallada...",
    "Nombre Propuesta 3: explicación detallada...",
    "Nombre Propuesta 4: explicación detallada..."
  ]
}`;
}

// ─── Point 7a: Services ───
export function promptServices(brand: BrandIdentity): string {
  return `Define los servicios principales de "${brand.companyName}" en ${brand.industry}.
Descripción: ${brand.description}

Lista 4-8 servicios con descripciones profesionales de 2-3 oraciones cada uno.

IMPORTANTE: El PRIMER servicio de la lista DEBE ser "Diseño de Marca" (branding, identidad visual, logotipo, manual de marca). Descríbelo como un servicio premium que incluye creación o renovación de identidad visual: logotipo, paleta de colores, tipografía, papelería corporativa y manual de marca. Los demás servicios deben ser específicos de la industria de ${brand.industry}.

Retorna SOLO JSON:
{
  "services": [
    { "name": "Diseño de Marca", "description": "Descripción profesional del servicio de branding e identidad visual..." },
    { "name": "Nombre del Servicio", "description": "Descripción profesional de 2-3 oraciones del servicio y su valor" }
  ]
}`;
}

// ─── Point 7b: Brand Design ───
export function promptBrandDesign(brand: BrandIdentity): string {
  return `Crea los lineamientos de diseño de marca para "${brand.companyName}".

Datos actuales:
- Colores: ${JSON.stringify(brand.colors)}
- Tipografías: ${JSON.stringify(brand.fonts)}
- Industria: ${brand.industry}

Retorna SOLO JSON:
{
  "personality": "3-4 oraciones describiendo la personalidad de la marca, su voz y cómo se comunica",
  "values": ["valor1", "valor2", "valor3", "valor4", "valor5"],
  "guidelines": "Lineamientos detallados de uso de marca - voz, consistencia visual, qué hacer y qué no hacer. Mínimo 150 palabras.",
  "styleReferences": ["Referencia 1: descripción de estética/estilo", "Referencia 2", "Referencia 3"]
}`;
}

// ─── Point 8: Content Strategy ───
export function promptContentStrategy(brand: BrandIdentity, services: { name: string }[]): string {
  return `Crea la estrategia de contenido DETALLADA y ESPECÍFICA para "${brand.companyName}" en ${brand.industry}.

CONTEXTO DE LA EMPRESA:
- Empresa: ${brand.companyName}
- Industria: ${brand.industry}
- Ubicación: ${brand.location || "No especificada"}
- Descripción: ${brand.description || "No disponible"}
- Servicios: ${services.map((s) => s.name).join(", ")}
${brand.website ? `- Sitio web: ${brand.website}` : ""}

INSTRUCCIONES PARA CADA CAMPO:

1. targetAudience: Define 3-4 segmentos ESPECÍFICOS del público objetivo. Para CADA segmento incluye:
   - Quiénes son (demografía, profesión, nivel socioeconómico)
   - Qué buscan específicamente en ${brand.industry}
   - Dónde consumen contenido (plataformas específicas)
   Ejemplo: "Inversores extranjeros de 35-55 años que buscan propiedades residenciales premium en ${brand.location || "la región"}, activos en LinkedIn y portales inmobiliarios internacionales"

2. painPoints: Lista 5-6 dolores REALES y ESPECÍFICOS del público objetivo en ${brand.industry}. NO genéricos. Deben ser problemas que un cliente REAL de ${brand.companyName} tendría.
   Ejemplo: "Desconfianza en transacciones inmobiliarias internacionales por falta de transparencia legal y costos ocultos"

3. channels: Lista los 5-6 canales MÁS EFECTIVOS para ${brand.industry} en ${brand.location || "el mercado"}, ordenados por prioridad. Para cada canal incluye breve justificación.
   Ejemplo: "Instagram — plataforma visual ideal para mostrar propiedades y estilo de vida; alcanza al 70% del público objetivo"

4. focusAreas: 4-5 áreas de enfoque ESPECÍFICAS para el contenido, combinando temas temáticos y geográficos relevantes para ${brand.industry}.
   Ejemplo: "Guías de inversión inmobiliaria en ${brand.location || "la región"}", "Comparativas de zonas residenciales", "Proceso legal de compra para extranjeros"

5. tone: Descripción DETALLADA del tono en 3-4 oraciones: cómo debe sonar la marca, qué vocabulario usar, qué evitar, y ejemplos de cómo se leería un post típico.

Retorna SOLO JSON:
{
  "contentStrategy": {
    "targetAudience": ["segmento 1 detallado con demografía y comportamiento", "segmento 2", "segmento 3", "segmento 4"],
    "painPoints": ["dolor 1 específico con contexto del sector", "dolor 2", "dolor 3", "dolor 4", "dolor 5"],
    "channels": ["Canal 1 — justificación breve", "Canal 2 — justificación", "Canal 3", "Canal 4", "Canal 5"],
    "focusAreas": ["área temática específica 1", "área 2", "área 3", "área 4"],
    "tone": "Descripción detallada del tono en 3-4 oraciones con ejemplos de vocabulario"
  }
}`;
}

// ─── Point 9: Content Pillars ───
export function promptContentPillars(brand: BrandIdentity, contentStrategy: { targetAudience: string[]; painPoints: string[] }): string {
  return `Crea 4 pilares de contenido ESPECÍFICOS para "${brand.companyName}" en ${brand.industry}.

CONTEXTO:
- Empresa: ${brand.companyName} - ${brand.industry}
- Ubicación: ${brand.location || "No especificada"}
- Descripción: ${(brand.description || "").slice(0, 300)}
- Público objetivo: ${(contentStrategy?.targetAudience || ["Público general"]).join("; ")}
- Dolores del público: ${(contentStrategy?.painPoints || ["Necesidad de servicios de calidad"]).join("; ")}

INSTRUCCIONES:
Los 4 pilares deben sumar 100% y ser ESPECÍFICOS para la industria de ${brand.industry}. NO uses pilares genéricos como "Educativo", "Inspiracional", "Promocional" — personalízalos para el sector.

Cada pilar debe tener:
- Nombre descriptivo y ESPECÍFICO para ${brand.industry} (ej: "Guías de Inversión" no "Contenido Educativo")
- Porcentaje del total de contenido (los 4 deben sumar 100%)
- Descripción de 3-4 oraciones explicando QUÉ tipo de contenido incluye, POR QUÉ es importante para el negocio, y CÓMO aporta valor al público objetivo
- 6-8 temas CONCRETOS y ESPECÍFICOS (no genéricos). Cada tema debe ser lo suficientemente detallado como para que un community manager pueda crear contenido directamente.
  Ejemplo MALO: "Tips del sector"
  Ejemplo BUENO: "Guía paso a paso: cómo evaluar una propiedad antes de comprar en ${brand.location || "la zona"}"

Retorna SOLO JSON:
{
  "contentPillars": [
    {
      "name": "Nombre Específico del Pilar para ${brand.industry}",
      "percentage": 35,
      "description": "Descripción detallada de 3-4 oraciones sobre qué cubre, por qué importa y cómo aporta valor",
      "topics": ["tema concreto 1", "tema concreto 2", "tema 3", "tema 4", "tema 5", "tema 6"]
    }
  ]
}`;
}

// ─── Point 10: Content Grid ───
export function promptContentGrid(brand: BrandIdentity, pillars: { name: string; percentage: number }[]): string {
  return `Crea una grilla de contenido semanal DETALLADA para "${brand.companyName}" en ${brand.industry}.

CONTEXTO:
- Empresa: ${brand.companyName} - ${brand.industry}
- Ubicación: ${brand.location || "No especificada"}
- Pilares: ${pillars.map((p) => `${p.name} (${p.percentage}%)`).join(", ")}

INSTRUCCIONES:
Crea un calendario de Lunes a Domingo (7 días) con contenido ESPECÍFICO para cada día.
- Cada entrada debe tener un topic TAN CONCRETO que un community manager pueda crear el contenido inmediatamente
- Las captions deben ser HOOKS reales que generen engagement (preguntas, datos impactantes, storytelling)
- Distribuye los pilares según sus porcentajes a lo largo de la semana
- Varía las plataformas y tipos de contenido para maximizar alcance
- Incluye al menos: 2 posts de Instagram, 1 LinkedIn, 1 TikTok/Reel, 1 Blog/SEO, 1 Story, 1 post adicional en la plataforma más relevante para ${brand.industry}

TIPOS DE CONTENIDO: Carrusel, Reel/Video Corto, Story, Post, Artículo Blog, Infografía, Live/Directo, Thread

Ejemplo de topic ESPECÍFICO:
- MALO: "Tips de inversión"
- BUENO: "5 errores que cometen los extranjeros al comprar su primera propiedad en ${brand.location || "la zona"} (y cómo evitarlos)"

Retorna SOLO JSON:
{
  "contentGrid": [
    { "day": "Lunes", "platform": "Instagram", "contentType": "Carrusel", "topic": "tema MUY específico y accionable", "pillar": "nombre del pilar", "caption": "Hook de caption que genere engagement - pregunta o dato impactante" },
    { "day": "Martes", "platform": "LinkedIn", "contentType": "Post", "topic": "tema", "pillar": "pilar", "caption": "hook" },
    { "day": "Miércoles", "platform": "TikTok", "contentType": "Reel", "topic": "tema", "pillar": "pilar", "caption": "hook" },
    { "day": "Jueves", "platform": "Blog", "contentType": "Artículo", "topic": "tema", "pillar": "pilar", "caption": "título SEO" },
    { "day": "Viernes", "platform": "Instagram", "contentType": "Reel", "topic": "tema", "pillar": "pilar", "caption": "hook" },
    { "day": "Sábado", "platform": "Instagram", "contentType": "Story", "topic": "tema", "pillar": "pilar", "caption": "hook" },
    { "day": "Domingo", "platform": "Facebook", "contentType": "Post", "topic": "tema", "pillar": "pilar", "caption": "hook" }
  ]
}`;
}

// ─── Point 11: KPIs ───
export function promptKPIs(brand: BrandIdentity): string {
  return `Define los KPIs para la estrategia de marketing de "${brand.companyName}" en ${brand.industry}.

Organiza en estas categorías:
- Atracción y SEO
- Conversión y Ventas
- Retención y Lealtad
- Marca y Engagement

Para cada KPI incluye: métrica, descripción clara de qué mide y por qué importa, y un target sugerido.

Retorna SOLO JSON:
{
  "kpis": [
    { "category": "Atracción y SEO", "metric": "Nombre de la Métrica", "description": "Qué mide y por qué es importante", "target": "target sugerido" }
  ]
}`;
}

// ─── Point 12a: Timeline ───
export function promptTimeline(brand: BrandIdentity): string {
  return `Crea un cronograma de implementación de 12 semanas para "${brand.companyName}".

Divide en 4 fases con tareas específicas y accionables.

Retorna SOLO JSON:
{
  "implementationTimeline": [
    { "phase": "Fase 1: Nombre", "weeks": "Semanas 1-3", "tasks": ["tarea específica 1", "tarea 2", "tarea 3", "tarea 4"] }
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
  "conclusions": ["conclusión detallada 1", "conclusión 2", "conclusión 3", "conclusión 4"],
  "recommendations": ["recomendación accionable 1", "recomendación 2", "recomendación 3", "recomendación 4"]
}`;
}
