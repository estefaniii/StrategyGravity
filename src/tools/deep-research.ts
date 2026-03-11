import { getResearchProvider } from "../llm/index.js";
import type { ToolResult, Competitor, KeywordGroup } from "../types/index.js";

export async function researchCompetitors(
  companyName: string,
  industry: string,
  location: string
): Promise<ToolResult> {
  const provider = getResearchProvider();

  const prompt = `Perform a deep competitive analysis for "${companyName}" in the ${industry} industry, located in ${location}.

Identify 5 main competitors and for each one provide:
- Company name and website
- Core services offered
- Key strengths (2-3)
- Weaknesses (2-3)
- Specific opportunities for ${companyName} to exploit against them
- SEO analysis: estimated top keywords they rank for

Return ONLY valid JSON in this format:
{
  "competitors": [
    {
      "name": "Competitor Name",
      "website": "https://...",
      "services": ["service1", "service2"],
      "strengths": ["strength1", "strength2"],
      "weaknesses": ["weakness1", "weakness2"],
      "opportunitiesForUs": ["opportunity1", "opportunity2"],
      "seoAnalysis": {
        "topKeywords": ["keyword1", "keyword2"],
        "estimatedTraffic": "high/medium/low"
      }
    }
  ]
}`;

  try {
    const response = await provider.generate(prompt, "You are an expert competitive intelligence analyst and SEO specialist. Provide detailed, actionable competitive analysis. Return ONLY valid JSON.", { maxTokens: 8192 });

    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    const data = JSON.parse(jsonMatch?.[0] ?? response.text);
    return { success: true, data: data.competitors as Competitor[] };
  } catch (err) {
    return { success: false, error: `Competitor research failed: ${(err as Error).message}` };
  }
}

export async function researchKeywords(
  companyName: string,
  industry: string,
  services: string[],
  location: string
): Promise<ToolResult> {
  const provider = getResearchProvider();

  const prompt = `Perform strategic keyword research for "${companyName}" - a ${industry} company in ${location}.

Their services: ${services.join(", ")}

Create keyword groups organized by search intent:
1. Transactional / High-Value Intent (buying keywords)
2. Geographic - Urban & Landmark keywords
3. Geographic - Coastal, Rural & Emerging areas
4. Property Type & Competitive Conquest keywords
5. Informational / Educational keywords

For each keyword include the search intent type.

Return ONLY valid JSON:
{
  "keywordGroups": [
    {
      "category": "Category Name",
      "keywords": [
        { "term": "keyword phrase", "intent": "transactional/informational/navigational", "volume": "high/medium/low", "difficulty": "high/medium/low" }
      ]
    }
  ]
}`;

  try {
    const response = await provider.generate(prompt, "You are an SEO keyword research specialist. Return ONLY valid JSON.", { maxTokens: 8192 });

    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    const data = JSON.parse(jsonMatch?.[0] ?? response.text);
    return { success: true, data: data.keywordGroups as KeywordGroup[] };
  } catch (err) {
    return { success: false, error: `Keyword research failed: ${(err as Error).message}` };
  }
}

export async function researchMarketTrends(industry: string, location: string): Promise<ToolResult> {
  const provider = getResearchProvider();

  const prompt = `Analyze current market trends for the ${industry} industry in ${location}.

Cover:
1. Major industry trends (2024-2025)
2. Consumer behavior shifts
3. Technology adoption trends
4. Regulatory changes
5. Emerging opportunities
6. Potential threats

Return ONLY valid JSON:
{
  "trends": [
    { "category": "category", "trend": "description", "impact": "high/medium/low", "timeframe": "immediate/6months/1year" }
  ],
  "opportunities": ["opportunity1", "opportunity2"],
  "threats": ["threat1", "threat2"]
}`;

  try {
    const response = await provider.generate(prompt, "You are a market research analyst. Return ONLY valid JSON.", { maxTokens: 4096 });

    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    const data = JSON.parse(jsonMatch?.[0] ?? response.text);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: `Market research failed: ${(err as Error).message}` };
  }
}
