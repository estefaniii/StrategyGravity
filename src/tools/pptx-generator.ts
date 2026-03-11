import PptxGenJSImport from "pptxgenjs";
import { mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { env } from "../config/env.js";
import type { MarketingStrategy, ToolResult } from "../types/index.js";

// Handle ESM/CJS interop - pptxgenjs may export default differently
const PptxGenJS = (PptxGenJSImport as any).default || PptxGenJSImport;

const __dirname = dirname(fileURLToPath(import.meta.url));

function hex(color: string): string {
  return color.replace("#", "").toUpperCase();
}

function ensureHex(color: string): string {
  const c = color.replace("#", "");
  if (/^[0-9a-fA-F]{6}$/.test(c)) return c.toUpperCase();
  return "1A1A2E"; // fallback dark
}

function truncate(text: string, max: number): string {
  if (!text) return "";
  return text.length > max ? text.slice(0, max - 3) + "..." : text;
}

export async function generatePptx(strategy: MarketingStrategy): Promise<ToolResult> {
  try {
    const pptx = new PptxGenJS();
    const colors = strategy.brandDesign?.identity?.colors || { primary: "#1A1A2E", secondary: "#16213E", accent: "#E94560" };
    const PRIMARY = ensureHex(colors.primary);
    const SECONDARY = ensureHex(colors.secondary);
    const ACCENT = ensureHex(colors.accent);
    const WHITE = "FFFFFF";
    const DARK = "2D2D2D";
    const LIGHT_BG = "F5F5F5";

    let slideCount = 0;
    const addSlide = () => { slideCount++; return pptx.addSlide(); };
    pptx.layout = "LAYOUT_WIDE";
    pptx.author = "StrategyGravity";
    pptx.company = strategy.companyName;
    pptx.title = `${strategy.companyName} - Estrategia de Marketing`;

    // ═══════════ SLIDE 1: COVER ═══════════
    const coverSlide = addSlide();
    coverSlide.background = { color: PRIMARY };
    coverSlide.addText("Estrategia de Contenido", {
      x: 0.5, y: 0.5, w: 12, h: 1,
      fontSize: 16, color: ACCENT, fontFace: "Arial",
      charSpacing: 8,
    });
    coverSlide.addText(strategy.companyName.toUpperCase(), {
      x: 0.5, y: 2, w: 12, h: 2,
      fontSize: 48, color: WHITE, bold: true, fontFace: "Arial",
    });
    coverSlide.addText("Estrategia de Marketing Digital", {
      x: 0.5, y: 4.2, w: 12, h: 0.8,
      fontSize: 20, color: WHITE, fontFace: "Arial", italic: true,
    });
    coverSlide.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: 5.5, w: 3, h: 0.05, fill: { color: ACCENT },
    });
    coverSlide.addText(`Generado por StrategyGravity | ${new Date().toLocaleDateString("es-ES")}`, {
      x: 0.5, y: 6, w: 12, h: 0.5,
      fontSize: 10, color: WHITE, fontFace: "Arial",
    });

    // ═══════════ SLIDE 2: DESCRIPCION ═══════════
    const descSlide = addSlide();
    descSlide.background = { color: WHITE };
    addHeader(descSlide, PRIMARY, "1. Descripcion", strategy.companyName);
    descSlide.addText(truncate(strategy.description.summary, 1500), {
      x: 0.8, y: 1.5, w: 11.5, h: 4,
      fontSize: 12, color: DARK, fontFace: "Arial",
      lineSpacingMultiple: 1.3, valign: "top", wrap: true,
    });
    descSlide.addText(`Objetivo: ${truncate(strategy.description.objective, 300)}`, {
      x: 0.8, y: 5.5, w: 11.5, h: 1,
      fontSize: 11, color: PRIMARY, bold: true, fontFace: "Arial",
      wrap: true,
    });

    // ═══════════ SLIDE 3: SECTION - COMPETENCIA ═══════════
    addSectionSlide(pptx, SECONDARY, "Analisis de la\nCompetencia", WHITE, ACCENT);

    // ═══════════ SLIDES 4-8: COMPETITOR ANALYSIS ═══════════
    for (const comp of strategy.competitors.slice(0, 5)) {
      const compSlide = addSlide();
      compSlide.background = { color: WHITE };
      addHeader(compSlide, PRIMARY, comp.name.toUpperCase(), comp.website || "");

      // Left column: Analysis text
      if (comp.detailedAnalysis) {
        compSlide.addText(truncate(comp.detailedAnalysis, 800), {
          x: 0.5, y: 1.4, w: 6, h: 3.5,
          fontSize: 10, color: DARK, fontFace: "Arial",
          lineSpacingMultiple: 1.2, valign: "top", wrap: true,
        });
      }

      // Right column: Strengths & Weaknesses
      const rightX = 7;
      compSlide.addText("Fortalezas:", {
        x: rightX, y: 1.4, w: 5.5, h: 0.4,
        fontSize: 11, color: "27AE60", bold: true, fontFace: "Arial",
      });
      const strengthBullets = comp.strengths.slice(0, 3).map((s) => ({
        text: truncate(s, 150),
        options: { fontSize: 9, color: DARK, bullet: { code: "25CF", color: "27AE60" } as any },
      }));
      compSlide.addText(strengthBullets as any, {
        x: rightX, y: 1.8, w: 5.5, h: 1.8,
        fontFace: "Arial", lineSpacingMultiple: 1.2, valign: "top",
      });

      compSlide.addText("Debilidades:", {
        x: rightX, y: 3.8, w: 5.5, h: 0.4,
        fontSize: 11, color: "E74C3C", bold: true, fontFace: "Arial",
      });
      const weakBullets = comp.weaknesses.slice(0, 3).map((w) => ({
        text: truncate(w, 150),
        options: { fontSize: 9, color: DARK, bullet: { code: "25CF", color: "E74C3C" } as any },
      }));
      compSlide.addText(weakBullets as any, {
        x: rightX, y: 4.2, w: 5.5, h: 1.8,
        fontFace: "Arial", lineSpacingMultiple: 1.2, valign: "top",
      });

      // Bottom: Opportunity
      if (comp.opportunitiesForUs?.[0]) {
        compSlide.addShape(pptx.ShapeType.rect, {
          x: 0.5, y: 6.2, w: 12, h: 0.8, fill: { color: LIGHT_BG },
          rectRadius: 0.05,
        });
        compSlide.addText(`Oportunidad para ${strategy.companyName}: ${truncate(comp.opportunitiesForUs[0], 200)}`, {
          x: 0.7, y: 6.3, w: 11.5, h: 0.6,
          fontSize: 10, color: PRIMARY, fontFace: "Arial", italic: true, wrap: true,
        });
      }

      // Website link
      if (comp.website) {
        compSlide.addText(comp.website, {
          x: 8, y: 0.3, w: 4.5, h: 0.4,
          fontSize: 8, color: ACCENT, fontFace: "Arial",
          hyperlink: { url: comp.website },
        });
      }
    }

    // ═══════════ SLIDE: COMPARATIVE ANALYSIS ═══════════
    const compAnalSlide = addSlide();
    compAnalSlide.background = { color: WHITE };
    addHeader(compAnalSlide, PRIMARY, "3. Analisis Comparativo", strategy.companyName);
    compAnalSlide.addText(truncate(strategy.comparativeAnalysis, 2000), {
      x: 0.8, y: 1.5, w: 11.5, h: 5.5,
      fontSize: 10, color: DARK, fontFace: "Arial",
      lineSpacingMultiple: 1.25, valign: "top", wrap: true,
    });

    // ═══════════ SLIDE: SECTION - KEYWORDS ═══════════
    addSectionSlide(pptx, SECONDARY, "Keywords\nEstrategicas", WHITE, ACCENT);

    // ═══════════ SLIDES: KEYWORD GROUPS ═══════════
    for (const group of strategy.keywordGroups.slice(0, 5)) {
      const kwSlide = addSlide();
      kwSlide.background = { color: WHITE };
      addHeader(kwSlide, PRIMARY, group.category, "SEO Keywords");

      const tableRows: any[][] = [
        [
          { text: "Keyword", options: { bold: true, color: WHITE, fill: { color: PRIMARY }, fontSize: 10 } },
          { text: "Intencion", options: { bold: true, color: WHITE, fill: { color: PRIMARY }, fontSize: 10 } },
          { text: "Volumen", options: { bold: true, color: WHITE, fill: { color: PRIMARY }, fontSize: 10 } },
          { text: "Dificultad", options: { bold: true, color: WHITE, fill: { color: PRIMARY }, fontSize: 10 } },
        ],
      ];

      for (const kw of group.keywords.slice(0, 10)) {
        tableRows.push([
          { text: kw.term, options: { fontSize: 9, color: DARK } },
          { text: kw.intent, options: { fontSize: 9, color: DARK } },
          { text: kw.volume || "N/A", options: { fontSize: 9, color: DARK } },
          { text: kw.difficulty || "N/A", options: { fontSize: 9, color: DARK } },
        ]);
      }

      kwSlide.addTable(tableRows, {
        x: 0.5, y: 1.5, w: 12, h: 5,
        fontSize: 9, fontFace: "Arial",
        border: { type: "solid", pt: 0.5, color: "CCCCCC" },
        colW: [5, 2.5, 2, 2.5],
        autoPage: false,
      });
    }

    // ═══════════ SLIDE: STRATEGIC CONCLUSIONS ═══════════
    const conclusionsSlide = addSlide();
    conclusionsSlide.background = { color: WHITE };
    addHeader(conclusionsSlide, PRIMARY, "5. Conclusiones Estrategicas", "");
    const concBullets = strategy.strategicConclusions.slice(0, 4).map((c) => ({
      text: truncate(c, 400),
      options: { fontSize: 10, color: DARK, bullet: { code: "25A0", color: ACCENT } as any },
    }));
    conclusionsSlide.addText(concBullets as any, {
      x: 0.8, y: 1.5, w: 11.5, h: 5.5,
      fontFace: "Arial", lineSpacingMultiple: 1.3, valign: "top",
    });

    // ═══════════ SLIDE: DIFFERENTIATION ═══════════
    const diffSlide = addSlide();
    diffSlide.background = { color: WHITE };
    addHeader(diffSlide, PRIMARY, "6. Propuestas de Diferenciacion", strategy.companyName);
    const diffBullets = strategy.differentiationProposals.slice(0, 4).map((d) => ({
      text: truncate(d, 400),
      options: { fontSize: 10, color: DARK, bullet: { code: "2756", color: PRIMARY } as any },
    }));
    diffSlide.addText(diffBullets as any, {
      x: 0.8, y: 1.5, w: 11.5, h: 5.5,
      fontFace: "Arial", lineSpacingMultiple: 1.3, valign: "top",
    });

    // ═══════════ SLIDE: SERVICES & BRAND DESIGN ═══════════
    const brandSlide = addSlide();
    brandSlide.background = { color: WHITE };
    addHeader(brandSlide, PRIMARY, "7. Servicios y Diseno de Marca", "");

    // Services list (left)
    const svcBullets = strategy.services.slice(0, 6).map((s) => ({
      text: `${s.name}: ${truncate(s.description, 100)}`,
      options: { fontSize: 9, color: DARK, bullet: { code: "25CF", color: ACCENT } as any },
    }));
    brandSlide.addText("Servicios:", {
      x: 0.5, y: 1.4, w: 6, h: 0.4,
      fontSize: 12, color: PRIMARY, bold: true, fontFace: "Arial",
    });
    brandSlide.addText(svcBullets as any, {
      x: 0.5, y: 1.9, w: 6, h: 3,
      fontFace: "Arial", lineSpacingMultiple: 1.2, valign: "top",
    });

    // Brand info (right)
    const brandInfo = [
      `Personalidad: ${truncate(strategy.brandDesign.personality, 100)}`,
      `Valores: ${strategy.brandDesign.values.join(", ")}`,
      `Colores: ${colors.primary}, ${colors.secondary}, ${colors.accent}`,
      `Tipografias: ${strategy.brandDesign.identity.fonts.heading}, ${strategy.brandDesign.identity.fonts.body}`,
    ];
    brandSlide.addText("Identidad de Marca:", {
      x: 7, y: 1.4, w: 5.5, h: 0.4,
      fontSize: 12, color: PRIMARY, bold: true, fontFace: "Arial",
    });
    const brandBullets = brandInfo.map((b) => ({
      text: b,
      options: { fontSize: 9, color: DARK, bullet: { code: "25CF", color: PRIMARY } as any },
    }));
    brandSlide.addText(brandBullets as any, {
      x: 7, y: 1.9, w: 5.5, h: 3,
      fontFace: "Arial", lineSpacingMultiple: 1.3, valign: "top",
    });

    // Color swatches
    [{ c: PRIMARY, x: 7 }, { c: SECONDARY, x: 8.5 }, { c: ACCENT, x: 10 }].forEach(({ c, x }) => {
      brandSlide.addShape(pptx.ShapeType.rect, {
        x, y: 5.5, w: 1.2, h: 0.6, fill: { color: c }, rectRadius: 0.05,
      });
      brandSlide.addText(`#${c}`, {
        x, y: 6.15, w: 1.2, h: 0.3, fontSize: 8, color: DARK, align: "center", fontFace: "Arial",
      });
    });

    // ═══════════ SLIDE: CONTENT STRATEGY ═══════════
    const csSlide = addSlide();
    csSlide.background = { color: WHITE };
    addHeader(csSlide, PRIMARY, "8. Estrategia de Contenido", "");

    const csRows: string[][] = [
      ["A quien se dirige", strategy.contentStrategy.targetAudience.join("; ")],
      ["Dolor", strategy.contentStrategy.painPoints.join("; ")],
      ["Canales", strategy.contentStrategy.channels.join(", ")],
      ["Zonas de Enfoque", strategy.contentStrategy.focusAreas.join(", ")],
      ["Tono", strategy.contentStrategy.tone],
    ];
    const csTableRows: any[][] = csRows.map(([label, value]) => [
      { text: label, options: { bold: true, color: WHITE, fill: { color: PRIMARY }, fontSize: 10 } },
      { text: truncate(value, 300), options: { fontSize: 10, color: DARK } },
    ]);
    csSlide.addTable(csTableRows, {
      x: 0.5, y: 1.5, w: 12, h: 5,
      fontSize: 10, fontFace: "Arial",
      border: { type: "solid", pt: 0.5, color: "CCCCCC" },
      colW: [3, 9],
    });

    // ═══════════ SLIDE: CONTENT PILLARS ═══════════
    const pillarsSlide = addSlide();
    pillarsSlide.background = { color: WHITE };
    addHeader(pillarsSlide, PRIMARY, "9. Pilares de Contenido", "");

    // Donut chart
    if (strategy.contentPillars.length > 0) {
      pillarsSlide.addChart(pptx.ChartType.doughnut, [
        {
          name: "Pilares",
          labels: strategy.contentPillars.map((p) => `${p.name} ${p.percentage}%`),
          values: strategy.contentPillars.map((p) => p.percentage),
        },
      ], {
        x: 0.5, y: 1.5, w: 5, h: 4.5,
        showPercent: true,
        showTitle: false,
        chartColors: [PRIMARY, ACCENT, SECONDARY, "95A5A6"],
      });
    }

    // Pillar descriptions
    strategy.contentPillars.slice(0, 3).forEach((pillar, i) => {
      const yPos = 1.5 + i * 1.5;
      pillarsSlide.addText(`${pillar.name} (${pillar.percentage}%)`, {
        x: 6.5, y: yPos, w: 6, h: 0.4,
        fontSize: 12, color: PRIMARY, bold: true, fontFace: "Arial",
      });
      pillarsSlide.addText(truncate(pillar.description, 200), {
        x: 6.5, y: yPos + 0.4, w: 6, h: 0.8,
        fontSize: 9, color: DARK, fontFace: "Arial", lineSpacingMultiple: 1.2, wrap: true,
      });
    });

    // ═══════════ SLIDE: CONTENT GRID ═══════════
    const gridSlide = addSlide();
    gridSlide.background = { color: WHITE };
    addHeader(gridSlide, PRIMARY, "10. Grilla de Contenido", "Plan Semanal");

    const gridTableRows: any[][] = [
      [
        { text: "Dia", options: { bold: true, color: WHITE, fill: { color: PRIMARY }, fontSize: 9 } },
        { text: "Plataforma", options: { bold: true, color: WHITE, fill: { color: PRIMARY }, fontSize: 9 } },
        { text: "Tipo", options: { bold: true, color: WHITE, fill: { color: PRIMARY }, fontSize: 9 } },
        { text: "Tema", options: { bold: true, color: WHITE, fill: { color: PRIMARY }, fontSize: 9 } },
        { text: "Pilar", options: { bold: true, color: WHITE, fill: { color: PRIMARY }, fontSize: 9 } },
      ],
    ];
    for (const item of strategy.contentGrid.slice(0, 10)) {
      gridTableRows.push([
        { text: item.day, options: { fontSize: 9, color: DARK } },
        { text: item.platform, options: { fontSize: 9, color: DARK } },
        { text: item.contentType, options: { fontSize: 9, color: DARK } },
        { text: truncate(item.topic, 50), options: { fontSize: 9, color: DARK } },
        { text: item.pillar, options: { fontSize: 9, color: DARK } },
      ]);
    }
    gridSlide.addTable(gridTableRows, {
      x: 0.3, y: 1.5, w: 12.5, h: 5,
      fontSize: 9, fontFace: "Arial",
      border: { type: "solid", pt: 0.5, color: "CCCCCC" },
      colW: [1.5, 2, 2, 4, 3],
      autoPage: false,
    });

    // ═══════════ SLIDE: KPIs ═══════════
    const kpiSlide = addSlide();
    kpiSlide.background = { color: WHITE };
    addHeader(kpiSlide, PRIMARY, "11. KPIs", "Indicadores Clave");

    const kpiTableRows: any[][] = [
      [
        { text: "Categoria", options: { bold: true, color: WHITE, fill: { color: PRIMARY }, fontSize: 10 } },
        { text: "Metrica", options: { bold: true, color: WHITE, fill: { color: PRIMARY }, fontSize: 10 } },
        { text: "Descripcion", options: { bold: true, color: WHITE, fill: { color: PRIMARY }, fontSize: 10 } },
      ],
    ];
    for (const kpi of strategy.kpis.slice(0, 8)) {
      kpiTableRows.push([
        { text: kpi.category, options: { fontSize: 9, color: DARK, bold: true } },
        { text: kpi.metric, options: { fontSize: 9, color: DARK } },
        { text: truncate(kpi.description, 150), options: { fontSize: 9, color: DARK } },
      ]);
    }
    kpiSlide.addTable(kpiTableRows, {
      x: 0.5, y: 1.5, w: 12, h: 5,
      fontSize: 9, fontFace: "Arial",
      border: { type: "solid", pt: 0.5, color: "CCCCCC" },
      colW: [3, 3, 6],
    });

    // ═══════════ SLIDE: TIMELINE ═══════════
    const timeSlide = addSlide();
    timeSlide.background = { color: WHITE };
    addHeader(timeSlide, PRIMARY, "12. Cronograma de Implementacion", "");

    strategy.implementationTimeline.slice(0, 4).forEach((phase, i) => {
      const yPos = 1.5 + i * 1.4;
      const phaseColor = [PRIMARY, SECONDARY, ACCENT, "95A5A6"][i] || PRIMARY;

      timeSlide.addShape(pptx.ShapeType.rect, {
        x: 0.5, y: yPos, w: 0.3, h: 1.2, fill: { color: phaseColor },
      });
      timeSlide.addText(`${phase.phase} (${phase.weeks})`, {
        x: 1, y: yPos, w: 11.5, h: 0.4,
        fontSize: 11, color: PRIMARY, bold: true, fontFace: "Arial",
      });
      const taskText = phase.tasks.slice(0, 4).map((t) => `  •  ${truncate(t, 80)}`).join("\n");
      timeSlide.addText(taskText, {
        x: 1, y: yPos + 0.4, w: 11.5, h: 0.8,
        fontSize: 9, color: DARK, fontFace: "Arial", lineSpacingMultiple: 1.2,
      });
    });

    // ═══════════ SLIDE: CONCLUSIONS ═══════════
    const finalSlide = addSlide();
    finalSlide.background = { color: WHITE };
    addHeader(finalSlide, PRIMARY, "Conclusiones y Recomendaciones", "");

    finalSlide.addText("Conclusiones:", {
      x: 0.5, y: 1.4, w: 6, h: 0.4,
      fontSize: 12, color: PRIMARY, bold: true, fontFace: "Arial",
    });
    const conclBullets = (strategy.conclusions || []).slice(0, 4).map((c) => ({
      text: truncate(c, 200),
      options: { fontSize: 9, color: DARK, bullet: { code: "25CF", color: PRIMARY } as any },
    }));
    finalSlide.addText(conclBullets as any, {
      x: 0.5, y: 1.9, w: 6, h: 3,
      fontFace: "Arial", lineSpacingMultiple: 1.3, valign: "top",
    });

    finalSlide.addText("Recomendaciones:", {
      x: 7, y: 1.4, w: 5.5, h: 0.4,
      fontSize: 12, color: ACCENT, bold: true, fontFace: "Arial",
    });
    const recBullets = (strategy.recommendations || []).slice(0, 4).map((r) => ({
      text: truncate(r, 200),
      options: { fontSize: 9, color: DARK, bullet: { code: "25CF", color: ACCENT } as any },
    }));
    finalSlide.addText(recBullets as any, {
      x: 7, y: 1.9, w: 5.5, h: 3,
      fontFace: "Arial", lineSpacingMultiple: 1.3, valign: "top",
    });

    // ═══════════ SLIDE: CLOSING ═══════════
    const closingSlide = addSlide();
    closingSlide.background = { color: PRIMARY };
    closingSlide.addText("Gracias", {
      x: 0, y: 2, w: 13.33, h: 2,
      fontSize: 48, color: WHITE, bold: true, fontFace: "Arial", align: "center",
    });
    closingSlide.addText(`${strategy.companyName} | Estrategia de Marketing Digital`, {
      x: 0, y: 4.5, w: 13.33, h: 1,
      fontSize: 16, color: ACCENT, fontFace: "Arial", align: "center",
    });
    closingSlide.addText("Generado por StrategyGravity", {
      x: 0, y: 6, w: 13.33, h: 0.5,
      fontSize: 10, color: WHITE, fontFace: "Arial", align: "center",
    });

    // ═══════════ SAVE FILE ═══════════
    const outputDir = resolve(env.OUTPUT_DIR || "./output");
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const safeName = strategy.companyName.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");
    const filename = `${safeName}_Estrategia_${new Date().toISOString().slice(0, 10)}.pptx`;
    const filePath = resolve(outputDir, filename);

    await pptx.writeFile({ fileName: filePath });

    return {
      success: true,
      data: {
        filePath,
        filename,
        slideCount: slideCount,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: `Error generando PPTX: ${(err as Error).message}`,
    };
  }
}

// ─── Helper: Add slide header bar ───
function addHeader(slide: any, primaryColor: string, title: string, subtitle: string) {
  slide.addShape("rect" as any, {
    x: 0, y: 0, w: 13.33, h: 1.1,
    fill: { color: primaryColor },
  });
  slide.addText(title, {
    x: 0.5, y: 0.15, w: 8, h: 0.7,
    fontSize: 22, color: "FFFFFF", bold: true, fontFace: "Arial",
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 8.5, y: 0.3, w: 4.5, h: 0.5,
      fontSize: 10, color: "CCCCCC", fontFace: "Arial", align: "right",
    });
  }
}

// ─── Helper: Add section divider slide ───
function addSectionSlide(pptx: PptxGenJS, bgColor: string, title: string, textColor: string, accentColor: string) {
  const slide = pptx.addSlide();
  slide.background = { color: bgColor };
  slide.addText(title, {
    x: 0, y: 2, w: 13.33, h: 3,
    fontSize: 40, color: textColor, bold: true, fontFace: "Arial",
    align: "center", lineSpacingMultiple: 1.2,
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: 5.5, y: 5.5, w: 2.33, h: 0.05, fill: { color: accentColor },
  });
}
