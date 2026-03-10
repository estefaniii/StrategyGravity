import type { BrandIdentity, Competitor, KeywordGroup } from "../types/index.js";

export const STRATEGY_SYSTEM_PROMPT = `You are StrategyGravity, an elite AI marketing strategist. You create comprehensive, actionable marketing strategies comparable in quality and depth to those created by top agencies.

Your strategies are data-driven, creative, and tailored to each business.
Always respond in Spanish (Latin American).
Always return valid JSON when requested.`;

// ─── Point 1: Description ───
export function promptDescription(brand: BrandIdentity): string {
  return `Create the Description section for "${brand.companyName}" in the ${brand.industry} industry.
Description: ${brand.description}

Return JSON:
{
  "summary": "A 3-4 sentence professional summary of the company, its market position, and value proposition",
  "objective": "A clear, measurable strategic objective for the marketing strategy"
}`;
}

// ─── Point 2: Competitor Analysis ───
export function promptCompetitorAnalysis(brand: BrandIdentity, competitors: Competitor[]): string {
  return `Based on this competitor data for "${brand.companyName}", create a detailed analysis for each competitor.

Raw competitor data:
${JSON.stringify(competitors, null, 2)}

For each competitor, expand and refine the analysis. Return JSON:
{
  "competitors": [
    {
      "name": "competitor name",
      "website": "url",
      "services": ["service1", "service2"],
      "strengths": ["detailed strength 1", "detailed strength 2", "detailed strength 3"],
      "weaknesses": ["detailed weakness 1", "detailed weakness 2"],
      "opportunitiesForUs": ["specific opportunity for ${brand.companyName} 1", "specific opportunity 2"],
      "seoAnalysis": { "topKeywords": ["kw1", "kw2"], "estimatedTraffic": "level" }
    }
  ]
}`;
}

// ─── Point 3: Comparative Analysis ───
export function promptComparativeAnalysis(brand: BrandIdentity, competitors: Competitor[]): string {
  return `Create a comparative analysis table/summary for "${brand.companyName}" vs its competitors.

Company: ${brand.companyName} (${brand.industry})
Competitors: ${competitors.map(c => c.name).join(", ")}

Compare across: services, pricing approach, technology, customer experience, geographic reach, brand positioning, and SEO presence.

Return JSON:
{
  "comparativeAnalysis": "A detailed 3-4 paragraph comparative analysis highlighting where ${brand.companyName} stands vs competition, key differentiators, gaps, and strategic positioning opportunities."
}`;
}

// ─── Point 4: Keywords ───
export function promptKeywords(brand: BrandIdentity, rawKeywords: KeywordGroup[]): string {
  return `Refine and expand this keyword research for "${brand.companyName}" in ${brand.industry}.

Raw keyword data:
${JSON.stringify(rawKeywords, null, 2)}

Organize into clear categories with search intent. Return JSON:
{
  "keywordGroups": [
    {
      "category": "Category Name (e.g., Transactional High-Value, Geographic Urban, etc.)",
      "keywords": [
        { "term": "keyword phrase in English", "intent": "transactional/informational/navigational", "volume": "high/medium/low", "difficulty": "high/medium/low" }
      ]
    }
  ]
}`;
}

// ─── Point 5: Strategic Conclusions ───
export function promptStrategicConclusions(brand: BrandIdentity, competitors: Competitor[], keywords: KeywordGroup[]): string {
  return `Based on the competitive and keyword analysis for "${brand.companyName}", provide 4 key strategic conclusions.

Industry: ${brand.industry}
Competitors analyzed: ${competitors.map(c => c.name).join(", ")}
Top keyword categories: ${keywords.map(k => k.category).join(", ")}

Each conclusion should identify a critical market insight, backed by the competitive data.

Return JSON:
{
  "strategicConclusions": [
    "Conclusion 1: detailed insight about market dynamics...",
    "Conclusion 2: detailed insight about consumer behavior...",
    "Conclusion 3: detailed insight about technology/trends...",
    "Conclusion 4: detailed insight about positioning opportunity..."
  ]
}`;
}

// ─── Point 6: Differentiation ───
export function promptDifferentiation(brand: BrandIdentity, conclusions: string[]): string {
  return `Based on the strategic conclusions for "${brand.companyName}", propose 4 differentiation strategies.

Strategic conclusions:
${conclusions.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Each proposal should be unique, actionable, and create real competitive advantage.

Return JSON:
{
  "differentiationProposals": [
    "Proposal 1: name and detailed description of differentiation strategy...",
    "Proposal 2: name and detailed description...",
    "Proposal 3: name and detailed description...",
    "Proposal 4: name and detailed description..."
  ]
}`;
}

// ─── Point 7: Services ───
export function promptServices(brand: BrandIdentity): string {
  return `Define the core services offered by "${brand.companyName}" in the ${brand.industry} industry.
Description: ${brand.description}

List 4-8 core services with clear descriptions.

Return JSON:
{
  "services": [
    { "name": "Service Name", "description": "Clear, compelling 2-sentence description of the service and its value to clients" }
  ]
}`;
}

// ─── Point 8: Brand Design ───
export function promptBrandDesign(brand: BrandIdentity): string {
  return `Create the brand design guidelines for "${brand.companyName}".

Current brand data:
- Colors: ${JSON.stringify(brand.colors)}
- Fonts: ${JSON.stringify(brand.fonts)}
- Industry: ${brand.industry}

Return JSON:
{
  "personality": "2-3 sentences describing the brand personality",
  "values": ["value1", "value2", "value3", "value4"],
  "guidelines": "Detailed brand usage guidelines - voice, visual consistency, dos and don'ts",
  "styleReferences": ["Reference 1: style/aesthetic reference", "Reference 2: style/aesthetic reference", "Reference 3"]
}`;
}

// ─── Point 9: Content Strategy ───
export function promptContentStrategy(brand: BrandIdentity, services: { name: string }[]): string {
  return `Create the content strategy for "${brand.companyName}" in ${brand.industry}.

Services: ${services.map(s => s.name).join(", ")}

Return JSON:
{
  "contentStrategy": {
    "targetAudience": ["audience segment 1 with description", "audience segment 2", "audience segment 3"],
    "painPoints": ["pain point 1 with context", "pain point 2", "pain point 3"],
    "channels": ["LinkedIn", "Instagram", "TikTok", "Blog/SEO", "etc"],
    "focusAreas": ["geographic or thematic focus area 1", "area 2"],
    "tone": "Describe the ideal brand tone in 1-2 sentences"
  }
}`;
}

// ─── Point 10: Content Pillars ───
export function promptContentPillars(brand: BrandIdentity, contentStrategy: { targetAudience: string[]; painPoints: string[] }): string {
  return `Create 3 content pillars for "${brand.companyName}".

Target audience: ${contentStrategy.targetAudience.join(", ")}
Pain points: ${contentStrategy.painPoints.join(", ")}

The 3 pillars must have percentage allocations that sum to 100%.

Return JSON:
{
  "contentPillars": [
    {
      "name": "Pillar Name",
      "percentage": 40,
      "description": "What this pillar covers and why",
      "topics": ["topic1", "topic2", "topic3", "topic4"]
    }
  ]
}`;
}

// ─── Point 11: Content Grid ───
export function promptContentGrid(brand: BrandIdentity, pillars: { name: string; percentage: number }[]): string {
  return `Create a weekly social media content grid for "${brand.companyName}".

Content pillars: ${pillars.map(p => `${p.name} (${p.percentage}%)`).join(", ")}

Create a Monday-Friday schedule with specific content for each day across platforms.

Return JSON:
{
  "contentGrid": [
    { "day": "Lunes", "platform": "Instagram", "contentType": "Carrusel/Video/Reel/Post", "topic": "specific topic", "pillar": "pillar name", "caption": "suggested caption idea" },
    { "day": "Lunes", "platform": "LinkedIn", "contentType": "Article/Post", "topic": "specific topic", "pillar": "pillar name" }
  ]
}`;
}

// ─── Point 12: KPIs ───
export function promptKPIs(brand: BrandIdentity): string {
  return `Define key performance indicators for "${brand.companyName}" marketing strategy in ${brand.industry}.

Organize KPIs into categories:
- Attraction & SEO
- Conversion & Sales
- Retention & Loyalty
- Brand & Engagement

Return JSON:
{
  "kpis": [
    { "category": "Atraccion y SEO", "metric": "Metric Name", "description": "What it measures and why", "target": "suggested target/benchmark" }
  ]
}`;
}

// ─── Point 13: Timeline ───
export function promptTimeline(brand: BrandIdentity): string {
  return `Create a 12-week implementation timeline for "${brand.companyName}" marketing strategy.

Divide into 4 phases with specific tasks.

Return JSON:
{
  "implementationTimeline": [
    { "phase": "Phase Name", "weeks": "Weeks 1-3", "tasks": ["task1", "task2", "task3"] }
  ]
}`;
}

// ─── Point 14: Conclusions ───
export function promptConclusions(brand: BrandIdentity, strategySummary: string): string {
  return `Create final conclusions and recommendations for "${brand.companyName}" marketing strategy.

Strategy summary: ${strategySummary}

Return JSON:
{
  "conclusions": ["conclusion 1", "conclusion 2", "conclusion 3"],
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3", "recommendation 4"]
}`;
}
