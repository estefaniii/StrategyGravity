import { google } from "googleapis";
import { readFileSync } from "fs";
import { env } from "../config/env.js";
import { generate } from "../llm/index.js";
import type { MarketingStrategy, BrandIdentity, ToolResult } from "../types/index.js";

// ─── Google Auth ───

function getAuth() {
  try {
    const credentials = JSON.parse(readFileSync(env.GOOGLE_APPLICATION_CREDENTIALS, "utf-8"));
    return new google.auth.GoogleAuth({
      credentials,
      scopes: [
        "https://www.googleapis.com/auth/presentations",
        "https://www.googleapis.com/auth/drive",
      ],
    });
  } catch {
    return null;
  }
}

// ─── Color helpers ───

function hexToRgb(hex: string): { red: number; green: number; blue: number } {
  const clean = hex.replace("#", "");
  if (clean.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(clean)) {
    return { red: 0.1, green: 0.1, blue: 0.18 };
  }
  return {
    red: parseInt(clean.slice(0, 2), 16) / 255,
    green: parseInt(clean.slice(2, 4), 16) / 255,
    blue: parseInt(clean.slice(4, 6), 16) / 255,
  };
}

function makeRgb(hex: string) {
  const rgb = hexToRgb(hex);
  return { rgbColor: rgb };
}

// ─── Summarize content for slides ───

async function summarizeForSlide(title: string, content: string, maxBullets = 5): Promise<string[]> {
  const prompt = `Summarize this content into ${maxBullets} concise bullet points for a presentation slide titled "${title}".
Each bullet should be 1 sentence max. Be direct and impactful.

Content: ${content}

Return ONLY a JSON array of strings: ["bullet1", "bullet2", ...]`;

  try {
    const response = await generate(prompt, "You are a presentation content specialist. Return ONLY a JSON array of strings.");
    const match = response.text.match(/\[[\s\S]*\]/);
    return JSON.parse(match?.[0] ?? "[]");
  } catch {
    return [content.slice(0, 200)];
  }
}

// ─── Build slide requests ───

function createTitleSlide(
  presentationId: string,
  objectId: string,
  title: string,
  subtitle: string,
  colors: BrandIdentity["colors"]
) {
  return [
    {
      createSlide: {
        objectId,
        slideLayoutReference: { predefinedLayout: "TITLE" },
        placeholderIdMappings: [
          { layoutPlaceholder: { type: "CENTERED_TITLE" }, objectId: `${objectId}_title` },
          { layoutPlaceholder: { type: "SUBTITLE" }, objectId: `${objectId}_subtitle` },
        ],
      },
    },
    {
      updatePageProperties: {
        objectId,
        pageProperties: {
          pageBackgroundFill: {
            solidFill: { color: makeRgb(colors.primary) },
          },
        },
        fields: "pageBackgroundFill",
      },
    },
    {
      insertText: { objectId: `${objectId}_title`, text: title },
    },
    {
      updateTextStyle: {
        objectId: `${objectId}_title`,
        textRange: { type: "ALL" },
        style: {
          foregroundColor: { opaqueColor: { rgbColor: { red: 1, green: 1, blue: 1 } } },
          fontSize: { magnitude: 36, unit: "PT" },
          bold: true,
        },
        fields: "foregroundColor,fontSize,bold",
      },
    },
    {
      insertText: { objectId: `${objectId}_subtitle`, text: subtitle },
    },
    {
      updateTextStyle: {
        objectId: `${objectId}_subtitle`,
        textRange: { type: "ALL" },
        style: {
          foregroundColor: { opaqueColor: makeRgb(colors.accent || "#cccccc") },
          fontSize: { magnitude: 18, unit: "PT" },
        },
        fields: "foregroundColor,fontSize",
      },
    },
  ];
}

function createContentSlide(
  objectId: string,
  title: string,
  bullets: string[],
  colors: BrandIdentity["colors"]
) {
  const bulletText = bullets.map((b) => `  •  ${b}`).join("\n");
  return [
    {
      createSlide: {
        objectId,
        slideLayoutReference: { predefinedLayout: "TITLE_AND_BODY" },
        placeholderIdMappings: [
          { layoutPlaceholder: { type: "TITLE" }, objectId: `${objectId}_title` },
          { layoutPlaceholder: { type: "BODY" }, objectId: `${objectId}_body` },
        ],
      },
    },
    {
      updatePageProperties: {
        objectId,
        pageProperties: {
          pageBackgroundFill: {
            solidFill: { color: { rgbColor: { red: 1, green: 1, blue: 1 } } },
          },
        },
        fields: "pageBackgroundFill",
      },
    },
    {
      insertText: { objectId: `${objectId}_title`, text: title },
    },
    {
      updateTextStyle: {
        objectId: `${objectId}_title`,
        textRange: { type: "ALL" },
        style: {
          foregroundColor: { opaqueColor: makeRgb(colors.primary) },
          fontSize: { magnitude: 28, unit: "PT" },
          bold: true,
        },
        fields: "foregroundColor,fontSize,bold",
      },
    },
    {
      insertText: { objectId: `${objectId}_body`, text: bulletText },
    },
    {
      updateTextStyle: {
        objectId: `${objectId}_body`,
        textRange: { type: "ALL" },
        style: {
          foregroundColor: { opaqueColor: { rgbColor: { red: 0.2, green: 0.2, blue: 0.2 } } },
          fontSize: { magnitude: 14, unit: "PT" },
        },
        fields: "foregroundColor,fontSize",
      },
    },
  ];
}

function createSectionSlide(objectId: string, title: string, colors: BrandIdentity["colors"]) {
  return [
    {
      createSlide: {
        objectId,
        slideLayoutReference: { predefinedLayout: "SECTION_HEADER" },
        placeholderIdMappings: [
          { layoutPlaceholder: { type: "TITLE" }, objectId: `${objectId}_title` },
        ],
      },
    },
    {
      updatePageProperties: {
        objectId,
        pageProperties: {
          pageBackgroundFill: {
            solidFill: { color: makeRgb(colors.secondary || colors.primary) },
          },
        },
        fields: "pageBackgroundFill",
      },
    },
    {
      insertText: { objectId: `${objectId}_title`, text: title },
    },
    {
      updateTextStyle: {
        objectId: `${objectId}_title`,
        textRange: { type: "ALL" },
        style: {
          foregroundColor: { opaqueColor: { rgbColor: { red: 1, green: 1, blue: 1 } } },
          fontSize: { magnitude: 36, unit: "PT" },
          bold: true,
        },
        fields: "foregroundColor,fontSize,bold",
      },
    },
  ];
}

// ─── Main Generator ───

export async function generatePresentation(strategy: MarketingStrategy): Promise<ToolResult> {
  const auth = getAuth();
  if (!auth) {
    // Fallback: generate slide content structure as JSON
    return generateOfflinePresentation(strategy);
  }

  try {
    const slides = google.slides({ version: "v1", auth });
    const drive = google.drive({ version: "v3", auth });

    const colors = strategy.brandDesign.identity.colors;
    const companyName = strategy.companyName;

    // 1. Create presentation
    const presentation = await slides.presentations.create({
      requestBody: {
        title: `${companyName} - Estrategia de Marketing`,
      },
    });

    const presentationId = presentation.data.presentationId!;

    // 2. Build all slide requests
    const requests: unknown[] = [];

    // Title slide
    requests.push(...createTitleSlide(presentationId, "slide_cover", `${companyName}`, "Estrategia de Marketing Integral", colors));

    // Slide 1: Descripcion
    const descBullets = await summarizeForSlide("Descripcion", `${strategy.description.summary}\n\nObjetivo: ${strategy.description.objective}`);
    requests.push(...createContentSlide("slide_01_desc", "1. Descripcion", descBullets, colors));

    // Slide 2: Competencia (section)
    requests.push(...createSectionSlide("slide_02_section", "Analisis de la Competencia", colors));

    // Individual competitor slides
    for (let i = 0; i < strategy.competitors.length; i++) {
      const comp = strategy.competitors[i];
      const bullets = [
        `Servicios: ${comp.services.join(", ")}`,
        ...comp.strengths.map((s) => `Fortaleza: ${s}`),
        ...comp.weaknesses.map((w) => `Debilidad: ${w}`),
        ...comp.opportunitiesForUs.slice(0, 1).map((o) => `Oportunidad: ${o}`),
      ];
      requests.push(...createContentSlide(`slide_02_comp_${i}`, comp.name, bullets.slice(0, 6), colors));
    }

    // Slide 3: Analisis Comparativo
    const compBullets = await summarizeForSlide("Analisis Comparativo", strategy.comparativeAnalysis);
    requests.push(...createContentSlide("slide_03_comparative", "3. Analisis Comparativo", compBullets, colors));

    // Slide 4: Keywords
    requests.push(...createSectionSlide("slide_04_section", "Keywords Estrategicas", colors));
    for (let i = 0; i < strategy.keywordGroups.length; i++) {
      const group = strategy.keywordGroups[i];
      const kwBullets = group.keywords.slice(0, 6).map((k) => `${k.term} (${k.intent})`);
      requests.push(...createContentSlide(`slide_04_kw_${i}`, group.category, kwBullets, colors));
    }

    // Slide 5: Conclusiones Estrategicas
    requests.push(...createContentSlide("slide_05_conclusions", "5. Conclusiones Estrategicas", strategy.strategicConclusions.slice(0, 5), colors));

    // Slide 6: Diferenciacion
    requests.push(...createContentSlide("slide_06_diff", "6. Propuestas de Diferenciacion", strategy.differentiationProposals.slice(0, 5), colors));

    // Slide 7: Servicios
    const svcBullets = strategy.services.map((s) => `${s.name}: ${s.description}`);
    requests.push(...createContentSlide("slide_07_services", "7. Servicios", svcBullets.slice(0, 6), colors));

    // Slide 8: Diseno de Marca
    const brandBullets = [
      `Personalidad: ${strategy.brandDesign.personality}`,
      `Valores: ${strategy.brandDesign.values.join(", ")}`,
      `Colores: ${colors.primary}, ${colors.secondary}, ${colors.accent}`,
      `Tipografias: ${strategy.brandDesign.identity.fonts.heading}, ${strategy.brandDesign.identity.fonts.body}`,
      ...strategy.brandDesign.styleReferences.slice(0, 2),
    ];
    requests.push(...createContentSlide("slide_08_brand", "8. Diseno de Marca", brandBullets, colors));

    // Slide 9: Estrategia de Contenido
    const csBullets = [
      `Publico: ${strategy.contentStrategy.targetAudience.join(", ")}`,
      `Canales: ${strategy.contentStrategy.channels.join(", ")}`,
      `Tono: ${strategy.contentStrategy.tone}`,
      `Dolor: ${strategy.contentStrategy.painPoints[0] || ""}`,
      `Enfoque: ${strategy.contentStrategy.focusAreas.join(", ")}`,
    ];
    requests.push(...createContentSlide("slide_09_content", "9. Estrategia de Contenido", csBullets, colors));

    // Slide 10: Pilares de Contenido
    const pillarBullets = strategy.contentPillars.map((p) => `${p.name} (${p.percentage}%): ${p.description}`);
    requests.push(...createContentSlide("slide_10_pillars", "10. Pilares de Contenido", pillarBullets, colors));

    // Slide 11: Grilla de Contenido
    const gridBullets = strategy.contentGrid.slice(0, 6).map((g) => `${g.day} - ${g.platform}: ${g.contentType} (${g.topic})`);
    requests.push(...createContentSlide("slide_11_grid", "11. Grilla de Contenido", gridBullets, colors));

    // Slide 12: KPIs
    const kpiBullets = strategy.kpis.map((k) => `${k.metric}: ${k.description}`);
    requests.push(...createContentSlide("slide_12_kpis", "12. KPIs", kpiBullets.slice(0, 6), colors));

    // Slide 13: Cronograma
    const timeBullets = strategy.implementationTimeline.map((t) => `${t.phase} (${t.weeks}): ${t.tasks[0]}`);
    requests.push(...createContentSlide("slide_13_timeline", "13. Cronograma", timeBullets, colors));

    // Slide 14: Conclusiones
    requests.push(...createContentSlide("slide_14_final", "14. Conclusiones y Recomendaciones", [...strategy.conclusions.slice(0, 3), ...strategy.recommendations.slice(0, 3)], colors));

    // Closing slide
    requests.push(...createTitleSlide(presentationId, "slide_closing", "Gracias", `${companyName} - Estrategia de Marketing`, colors));

    // 3. Delete default empty slide
    const defaultSlideId = presentation.data.slides?.[0]?.objectId;
    if (defaultSlideId) {
      requests.push({ deleteObject: { objectId: defaultSlideId } });
    }

    // 4. Execute all requests
    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: { requests: requests as Array<Record<string, unknown>> },
    });

    // 5. Get shareable link
    await drive.permissions.create({
      fileId: presentationId,
      requestBody: { role: "reader", type: "anyone" },
    });

    const fileInfo = await drive.files.get({
      fileId: presentationId,
      fields: "webViewLink",
    });

    return {
      success: true,
      data: {
        presentationId,
        url: fileInfo.data.webViewLink,
        editUrl: `https://docs.google.com/presentation/d/${presentationId}/edit`,
        slideCount: requests.filter((r: unknown) => (r as Record<string, unknown>).createSlide).length,
      },
    };
  } catch (err) {
    console.error("[Slides] Google API error, generating offline version...");
    return generateOfflinePresentation(strategy);
  }
}

// ─── Offline fallback: structured JSON export ───

async function generateOfflinePresentation(strategy: MarketingStrategy): Promise<ToolResult> {
  const colors = strategy.brandDesign.identity.colors;

  const slideStructure = [
    { slide: 1, type: "cover", title: strategy.companyName, subtitle: "Estrategia de Marketing Integral", bg: colors.primary },
    { slide: 2, type: "content", title: "1. Descripcion", content: [strategy.description.summary, `Objetivo: ${strategy.description.objective}`] },
    { slide: 3, type: "section", title: "Analisis de la Competencia", bg: colors.secondary },
  ];

  let slideNum = 4;
  for (const comp of strategy.competitors) {
    slideStructure.push({
      slide: slideNum++,
      type: "content",
      title: comp.name,
      content: [
        `Servicios: ${comp.services.join(", ")}`,
        ...comp.strengths.map((s) => `Fortaleza: ${s}`),
        ...comp.opportunitiesForUs.slice(0, 1).map((o) => `Oportunidad: ${o}`),
      ],
    } as typeof slideStructure[0]);
  }

  slideStructure.push(
    { slide: slideNum++, type: "content", title: "3. Analisis Comparativo", content: await summarizeForSlide("Analisis", strategy.comparativeAnalysis) },
    { slide: slideNum++, type: "section", title: "Keywords Estrategicas", bg: colors.secondary },
  );

  for (const group of strategy.keywordGroups) {
    slideStructure.push({
      slide: slideNum++,
      type: "content",
      title: group.category,
      content: group.keywords.slice(0, 6).map((k) => `${k.term} (${k.intent})`),
    } as typeof slideStructure[0]);
  }

  slideStructure.push(
    { slide: slideNum++, type: "content", title: "5. Conclusiones Estrategicas", content: strategy.strategicConclusions },
    { slide: slideNum++, type: "content", title: "6. Propuestas de Diferenciacion", content: strategy.differentiationProposals },
    { slide: slideNum++, type: "content", title: "7. Servicios", content: strategy.services.map((s) => `${s.name}: ${s.description}`) },
    { slide: slideNum++, type: "content", title: "8. Diseno de Marca", content: [`Personalidad: ${strategy.brandDesign.personality}`, `Valores: ${strategy.brandDesign.values.join(", ")}`, `Colores: ${colors.primary}, ${colors.secondary}, ${colors.accent}`] },
    { slide: slideNum++, type: "content", title: "9. Estrategia de Contenido", content: [`Publico: ${strategy.contentStrategy.targetAudience.join(", ")}`, `Canales: ${strategy.contentStrategy.channels.join(", ")}`, `Tono: ${strategy.contentStrategy.tone}`] },
    { slide: slideNum++, type: "content", title: "10. Pilares de Contenido", content: strategy.contentPillars.map((p) => `${p.name} (${p.percentage}%): ${p.description}`) },
    { slide: slideNum++, type: "content", title: "11. Grilla de Contenido", content: strategy.contentGrid.slice(0, 6).map((g) => `${g.day}: ${g.contentType} - ${g.topic}`) },
    { slide: slideNum++, type: "content", title: "12. KPIs", content: strategy.kpis.map((k) => `${k.metric}: ${k.description}`) },
    { slide: slideNum++, type: "content", title: "13. Cronograma", content: strategy.implementationTimeline.map((t) => `${t.phase} (${t.weeks}): ${t.tasks[0]}`) },
    { slide: slideNum++, type: "content", title: "14. Conclusiones", content: [...strategy.conclusions, ...strategy.recommendations] },
    { slide: slideNum++, type: "cover", title: "Gracias", subtitle: `${strategy.companyName}`, bg: colors.primary },
  );

  return {
    success: true,
    data: {
      mode: "offline",
      message: "Google Slides API not available. Presentation structure saved as JSON. Configure service-account.json to enable Google Slides export.",
      slideCount: slideStructure.length,
      slides: slideStructure,
    },
  };
}
