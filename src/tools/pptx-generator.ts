import PptxGenJSImport from "pptxgenjs";
import { mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { env } from "../config/env.js";
import type { MarketingStrategy, ToolResult } from "../types/index.js";

// Handle ESM/CJS interop - pptxgenjs may export default differently
const PptxGenJS = (PptxGenJSImport as any).default || PptxGenJSImport;

const __dirname = dirname(fileURLToPath(import.meta.url));

function ensureHex(color: string): string {
  const c = color.replace("#", "");
  if (/^[0-9a-fA-F]{6}$/.test(c)) return c.toUpperCase();
  return "1A1A2E";
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
    const MEDIUM_GRAY = "6B7280";
    const LIGHT_GRAY = "E5E7EB";

    let slideCount = 0;
    const addSlide = () => { slideCount++; return pptx.addSlide(); };
    pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 inches
    pptx.author = "StrategyGravity";
    pptx.company = strategy.companyName;
    pptx.title = `${strategy.companyName} - Estrategia de Marketing`;

    // ─── Helper: footer bar on content slides ───
    const addFooter = (slide: any) => {
      slide.addShape(pptx.ShapeType.rect, {
        x: 0, y: 7.05, w: 13.33, h: 0.45,
        fill: { color: PRIMARY },
      });
      slide.addText(strategy.companyName, {
        x: 0.5, y: 7.08, w: 4, h: 0.35,
        fontSize: 8, color: WHITE, fontFace: "Arial", bold: true,
      });
      slide.addText("Estrategia de Marketing Digital | StrategyGravity", {
        x: 7, y: 7.08, w: 6, h: 0.35,
        fontSize: 8, color: LIGHT_GRAY, fontFace: "Arial", align: "right",
      });
    };

    // ─── Helper: header bar on content slides ───
    const addHeader = (slide: any, title: string, subtitle?: string) => {
      slide.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: 13.33, h: 1.1,
        fill: { color: PRIMARY },
      });
      slide.addText(title, {
        x: 0.5, y: 0.15, w: 9, h: 0.7,
        fontSize: 22, color: WHITE, bold: true, fontFace: "Arial",
      });
      if (subtitle) {
        slide.addText(subtitle, {
          x: 9.5, y: 0.25, w: 3.5, h: 0.5,
          fontSize: 10, color: LIGHT_GRAY, fontFace: "Arial", align: "right",
        });
      }
    };

    // ─── Helper: section divider slide (Astra style: dark bg, large centered text) ───
    const addSectionDivider = (title: string, subtitle?: string) => {
      const slide = addSlide();
      slide.background = { color: SECONDARY };
      // Decorative accent line top
      slide.addShape(pptx.ShapeType.rect, {
        x: 5.5, y: 1.5, w: 2.33, h: 0.04, fill: { color: ACCENT },
      });
      slide.addText(title.toUpperCase(), {
        x: 0.5, y: 2, w: 12.33, h: 2.5,
        fontSize: 38, color: WHITE, bold: true, fontFace: "Arial",
        align: "center", lineSpacingMultiple: 1.3, charSpacing: 3,
      });
      if (subtitle) {
        slide.addText(subtitle, {
          x: 2, y: 4.8, w: 9.33, h: 0.8,
          fontSize: 14, color: ACCENT, fontFace: "Arial",
          align: "center", italic: true,
        });
      }
      // Decorative accent line bottom
      slide.addShape(pptx.ShapeType.rect, {
        x: 5.5, y: 5.8, w: 2.33, h: 0.04, fill: { color: ACCENT },
      });
    };


    // ╔══════════════════════════════════════════════════════════════╗
    // ║  SLIDE 1: COVER                                             ║
    // ╚══════════════════════════════════════════════════════════════╝
    const coverSlide = addSlide();
    coverSlide.background = { color: PRIMARY };
    // Decorative top line
    coverSlide.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: 0.5, w: 4, h: 0.04, fill: { color: ACCENT },
    });
    coverSlide.addText("Estrategia de Contenido", {
      x: 0.5, y: 0.8, w: 12, h: 0.8,
      fontSize: 14, color: ACCENT, fontFace: "Arial",
      charSpacing: 6,
    });
    coverSlide.addText(strategy.companyName.toUpperCase(), {
      x: 0.5, y: 2.2, w: 12, h: 2,
      fontSize: 52, color: WHITE, bold: true, fontFace: "Arial",
      charSpacing: 2,
    });
    coverSlide.addText("Estrategia de Marketing Digital", {
      x: 0.5, y: 4.5, w: 12, h: 0.8,
      fontSize: 18, color: WHITE, fontFace: "Arial", italic: true,
    });
    coverSlide.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: 5.8, w: 3, h: 0.04, fill: { color: ACCENT },
    });
    coverSlide.addText(`Generado por StrategyGravity | ${new Date().toLocaleDateString("es-ES")}`, {
      x: 0.5, y: 6.3, w: 12, h: 0.5,
      fontSize: 10, color: LIGHT_GRAY, fontFace: "Arial",
    });


    // ╔══════════════════════════════════════════════════════════════╗
    // ║  SLIDE 2: DESCRIPCION                                       ║
    // ╚══════════════════════════════════════════════════════════════╝
    const descSlide = addSlide();
    descSlide.background = { color: WHITE };
    addHeader(descSlide, "Descripcion", strategy.companyName);
    // Summary text box with left accent bar
    descSlide.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: 1.4, w: 0.08, h: 4.2, fill: { color: ACCENT },
    });
    descSlide.addText(truncate(strategy.description.summary, 2000), {
      x: 0.9, y: 1.4, w: 11.5, h: 4.2,
      fontSize: 11, color: DARK, fontFace: "Arial",
      lineSpacingMultiple: 1.4, valign: "top", wrap: true,
    });
    // Objective box
    descSlide.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: 5.8, w: 12.3, h: 0.9, fill: { color: LIGHT_BG },
      rectRadius: 0.05,
    });
    descSlide.addText(`Objetivo: ${truncate(strategy.description.objective, 400)}`, {
      x: 0.8, y: 5.9, w: 11.8, h: 0.7,
      fontSize: 10, color: PRIMARY, bold: true, fontFace: "Arial", wrap: true,
    });
    addFooter(descSlide);


    // ╔══════════════════════════════════════════════════════════════╗
    // ║  SLIDES: COMPETENCIA (Astra style: divider + per competitor) ║
    // ╚══════════════════════════════════════════════════════════════╝
    addSectionDivider("Analisis de la\nCompetencia", `${strategy.competitors.length} competidores identificados`);

    for (const comp of strategy.competitors.slice(0, 5)) {
      // ── SLIDE A: Competitor Analysis ──
      const compSlide = addSlide();
      compSlide.background = { color: WHITE };
      addHeader(compSlide, comp.name.toUpperCase(), comp.website || "");

      // Services subtitle
      if (comp.services?.length > 0) {
        compSlide.addText(comp.services.slice(0, 3).join(" | "), {
          x: 0.5, y: 1.2, w: 12, h: 0.4,
          fontSize: 10, color: MEDIUM_GRAY, fontFace: "Arial", italic: true,
        });
      }

      // Detailed analysis text (full width, larger area)
      if (comp.detailedAnalysis) {
        compSlide.addShape(pptx.ShapeType.rect, {
          x: 0.5, y: 1.7, w: 0.06, h: 3.3, fill: { color: ACCENT },
        });
        compSlide.addText(truncate(comp.detailedAnalysis, 1200), {
          x: 0.8, y: 1.7, w: 11.8, h: 3.3,
          fontSize: 10, color: DARK, fontFace: "Arial",
          lineSpacingMultiple: 1.25, valign: "top", wrap: true,
        });
      }

      // Bottom: Strengths (left) & Weaknesses (right) in colored boxes
      // Strengths
      compSlide.addShape(pptx.ShapeType.rect, {
        x: 0.5, y: 5.2, w: 6, h: 1.6, fill: { color: "F0FFF4" },
        rectRadius: 0.05,
      });
      compSlide.addText("FORTALEZAS", {
        x: 0.7, y: 5.25, w: 5.5, h: 0.3,
        fontSize: 9, color: "16A34A", bold: true, fontFace: "Arial",
        charSpacing: 2,
      });
      const strengthText = comp.strengths.slice(0, 3).map((s) => `  •  ${truncate(s, 120)}`).join("\n");
      compSlide.addText(strengthText, {
        x: 0.7, y: 5.55, w: 5.5, h: 1.15,
        fontSize: 8, color: DARK, fontFace: "Arial", lineSpacingMultiple: 1.3, valign: "top", wrap: true,
      });

      // Weaknesses
      compSlide.addShape(pptx.ShapeType.rect, {
        x: 6.8, y: 5.2, w: 6, h: 1.6, fill: { color: "FFF5F5" },
        rectRadius: 0.05,
      });
      compSlide.addText("DEBILIDADES", {
        x: 7, y: 5.25, w: 5.5, h: 0.3,
        fontSize: 9, color: "DC2626", bold: true, fontFace: "Arial",
        charSpacing: 2,
      });
      const weakText = comp.weaknesses.slice(0, 3).map((w) => `  •  ${truncate(w, 120)}`).join("\n");
      compSlide.addText(weakText, {
        x: 7, y: 5.55, w: 5.5, h: 1.15,
        fontSize: 8, color: DARK, fontFace: "Arial", lineSpacingMultiple: 1.3, valign: "top", wrap: true,
      });

      addFooter(compSlide);

      // ── SLIDE B: SEO Analysis (Astra has separate SEO page per competitor) ──
      const seoSlide = addSlide();
      seoSlide.background = { color: WHITE };
      addHeader(seoSlide, "ANALISIS DE SEO", comp.name);

      // SEO data in a clean card layout
      const seoData = comp.seoAnalysis;
      if (seoData) {
        // Top keywords
        seoSlide.addText("TOP KEYWORDS", {
          x: 0.5, y: 1.4, w: 6, h: 0.4,
          fontSize: 11, color: PRIMARY, bold: true, fontFace: "Arial",
          charSpacing: 2,
        });
        const kwItems = (seoData.topKeywords || []).slice(0, 8);
        if (kwItems.length > 0) {
          const kwTableRows: any[][] = [
            [
              { text: "#", options: { bold: true, color: WHITE, fill: { color: PRIMARY }, fontSize: 9, align: "center" } },
              { text: "Keyword", options: { bold: true, color: WHITE, fill: { color: PRIMARY }, fontSize: 9 } },
            ],
          ];
          kwItems.forEach((kw: string, idx: number) => {
            kwTableRows.push([
              { text: `${idx + 1}`, options: { fontSize: 9, color: MEDIUM_GRAY, align: "center" } },
              { text: kw, options: { fontSize: 9, color: DARK } },
            ]);
          });
          seoSlide.addTable(kwTableRows, {
            x: 0.5, y: 1.9, w: 6, h: Math.min(kwItems.length * 0.4 + 0.4, 4.5),
            fontSize: 9, fontFace: "Arial",
            border: { type: "solid", pt: 0.5, color: LIGHT_GRAY },
            colW: [0.6, 5.4],
          });
        }

        // Estimated traffic badge
        seoSlide.addShape(pptx.ShapeType.rect, {
          x: 7.5, y: 1.4, w: 5, h: 1.5, fill: { color: LIGHT_BG },
          rectRadius: 0.1,
        });
        seoSlide.addText("TRAFICO ESTIMADO", {
          x: 7.7, y: 1.5, w: 4.5, h: 0.4,
          fontSize: 9, color: MEDIUM_GRAY, fontFace: "Arial",
          charSpacing: 2,
        });
        seoSlide.addText(seoData.estimatedTraffic || "N/A", {
          x: 7.7, y: 1.9, w: 4.5, h: 0.8,
          fontSize: 22, color: PRIMARY, bold: true, fontFace: "Arial",
        });
      }

      // Opportunities box
      if (comp.opportunitiesForUs?.length > 0) {
        seoSlide.addShape(pptx.ShapeType.rect, {
          x: 0.5, y: 5.5, w: 12.3, h: 1.3, fill: { color: LIGHT_BG },
          rectRadius: 0.05,
        });
        seoSlide.addText(`OPORTUNIDADES PARA ${strategy.companyName.toUpperCase()}`, {
          x: 0.8, y: 5.55, w: 11.8, h: 0.35,
          fontSize: 9, color: ACCENT, bold: true, fontFace: "Arial",
          charSpacing: 2,
        });
        const oppText = comp.opportunitiesForUs.slice(0, 2).map((o) => `  •  ${truncate(o, 200)}`).join("\n");
        seoSlide.addText(oppText, {
          x: 0.8, y: 5.9, w: 11.8, h: 0.8,
          fontSize: 9, color: DARK, fontFace: "Arial", lineSpacingMultiple: 1.3, wrap: true,
        });
      }

      // Website link at bottom
      if (comp.website) {
        seoSlide.addText(comp.website, {
          x: 7.5, y: 3.2, w: 5, h: 0.4,
          fontSize: 9, color: ACCENT, fontFace: "Arial",
          hyperlink: { url: comp.website },
        });
      }

      addFooter(seoSlide);
    }


    // ╔══════════════════════════════════════════════════════════════╗
    // ║  SLIDE: COMPARATIVE ANALYSIS                                ║
    // ╚══════════════════════════════════════════════════════════════╝
    const compAnalSlide = addSlide();
    compAnalSlide.background = { color: WHITE };
    addHeader(compAnalSlide, "Analisis Comparativo", strategy.companyName);
    compAnalSlide.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: 1.3, w: 0.06, h: 5, fill: { color: ACCENT },
    });
    compAnalSlide.addText(truncate(strategy.comparativeAnalysis, 2500), {
      x: 0.8, y: 1.3, w: 11.8, h: 5.4,
      fontSize: 10, color: DARK, fontFace: "Arial",
      lineSpacingMultiple: 1.3, valign: "top", wrap: true,
    });
    addFooter(compAnalSlide);


    // ╔══════════════════════════════════════════════════════════════╗
    // ║  SLIDES: KEYWORDS (Astra style - grouped on pages)          ║
    // ╚══════════════════════════════════════════════════════════════╝
    addSectionDivider("Palabras Clave\n(SEO Keywords)", "Investigacion de keywords estrategicas");

    // Put keyword groups on slides - max 2 groups per slide to match Astra layout
    const kwGroups = strategy.keywordGroups.slice(0, 5);
    for (let gi = 0; gi < kwGroups.length; gi += 2) {
      const kwSlide = addSlide();
      kwSlide.background = { color: WHITE };
      addHeader(kwSlide, "Palabras Clave Estrategicas", "SEO Keywords");

      const groupsOnSlide = kwGroups.slice(gi, gi + 2);
      groupsOnSlide.forEach((group, localIdx) => {
        const yStart = localIdx === 0 ? 1.3 : 4.2;
        const maxKw = localIdx === 0 ? 7 : 6;

        // Category label with accent bar
        kwSlide.addShape(pptx.ShapeType.rect, {
          x: 0.5, y: yStart, w: 0.06, h: 0.35, fill: { color: ACCENT },
        });
        kwSlide.addText(group.category, {
          x: 0.8, y: yStart, w: 12, h: 0.35,
          fontSize: 12, color: PRIMARY, bold: true, fontFace: "Arial",
        });

        // Keywords as a clean table
        const tableRows: any[][] = [
          [
            { text: "Keyword", options: { bold: true, color: WHITE, fill: { color: PRIMARY }, fontSize: 9 } },
            { text: "Intencion", options: { bold: true, color: WHITE, fill: { color: PRIMARY }, fontSize: 9 } },
            { text: "Volumen", options: { bold: true, color: WHITE, fill: { color: PRIMARY }, fontSize: 9, align: "center" } },
            { text: "Dificultad", options: { bold: true, color: WHITE, fill: { color: PRIMARY }, fontSize: 9, align: "center" } },
          ],
        ];
        for (const kw of group.keywords.slice(0, maxKw)) {
          tableRows.push([
            { text: kw.term, options: { fontSize: 8, color: DARK } },
            { text: kw.intent, options: { fontSize: 8, color: MEDIUM_GRAY } },
            { text: kw.volume || "N/A", options: { fontSize: 8, color: DARK, align: "center" } },
            { text: kw.difficulty || "N/A", options: { fontSize: 8, color: DARK, align: "center" } },
          ]);
        }

        const tableH = Math.min(tableRows.length * 0.33 + 0.1, localIdx === 0 ? 2.6 : 2.4);
        kwSlide.addTable(tableRows, {
          x: 0.5, y: yStart + 0.4, w: 12.3, h: tableH,
          fontSize: 8, fontFace: "Arial",
          border: { type: "solid", pt: 0.5, color: LIGHT_GRAY },
          colW: [5, 2.5, 2.4, 2.4],
          autoPage: false,
        });
      });

      addFooter(kwSlide);
    }


    // ╔══════════════════════════════════════════════════════════════╗
    // ║  SLIDE: CONCLUSIONES ESTRATEGICAS                           ║
    // ╚══════════════════════════════════════════════════════════════╝
    const conclusionsSlide = addSlide();
    conclusionsSlide.background = { color: WHITE };
    addHeader(conclusionsSlide, "Conclusiones Estrategicas", "");

    // Title
    conclusionsSlide.addText("C O N C L U S I O N E S   E S T R A T E G I C A S", {
      x: 0.5, y: 1.3, w: 12, h: 0.5,
      fontSize: 12, color: PRIMARY, bold: true, fontFace: "Arial",
    });

    strategy.strategicConclusions.slice(0, 4).forEach((conclusion, i) => {
      const yPos = 2 + i * 1.25;
      // Accent dot
      conclusionsSlide.addShape(pptx.ShapeType.rect, {
        x: 0.5, y: yPos + 0.05, w: 0.15, h: 0.15, fill: { color: ACCENT },
        rectRadius: 0.075,
      });
      conclusionsSlide.addText(truncate(conclusion, 500), {
        x: 0.9, y: yPos, w: 11.8, h: 1.1,
        fontSize: 10, color: DARK, fontFace: "Arial",
        lineSpacingMultiple: 1.3, valign: "top", wrap: true,
      });
    });
    addFooter(conclusionsSlide);


    // ╔══════════════════════════════════════════════════════════════╗
    // ║  SLIDE: DIFERENCIACION                                      ║
    // ╚══════════════════════════════════════════════════════════════╝
    const diffSlide = addSlide();
    diffSlide.background = { color: WHITE };
    addHeader(diffSlide, `Donde se puede diferenciar ${strategy.companyName}?`, "");

    strategy.differentiationProposals.slice(0, 4).forEach((proposal, i) => {
      const yPos = 1.4 + i * 1.35;
      // Numbered circle
      diffSlide.addShape(pptx.ShapeType.rect, {
        x: 0.5, y: yPos, w: 0.45, h: 0.45, fill: { color: PRIMARY },
        rectRadius: 0.225,
      });
      diffSlide.addText(`${i + 1}`, {
        x: 0.5, y: yPos, w: 0.45, h: 0.45,
        fontSize: 14, color: WHITE, bold: true, fontFace: "Arial", align: "center", valign: "middle",
      });
      diffSlide.addText(truncate(proposal, 500), {
        x: 1.2, y: yPos, w: 11.5, h: 1.2,
        fontSize: 10, color: DARK, fontFace: "Arial",
        lineSpacingMultiple: 1.3, valign: "top", wrap: true,
      });
    });
    addFooter(diffSlide);


    // ╔══════════════════════════════════════════════════════════════╗
    // ║  SLIDE: SERVICES & BRAND DESIGN                             ║
    // ╚══════════════════════════════════════════════════════════════╝
    const brandSlide = addSlide();
    brandSlide.background = { color: WHITE };
    addHeader(brandSlide, "Servicios y Diseno de Marca", "");

    // Left: Services
    brandSlide.addText("SERVICIOS", {
      x: 0.5, y: 1.4, w: 6, h: 0.4,
      fontSize: 11, color: PRIMARY, bold: true, fontFace: "Arial", charSpacing: 2,
    });
    strategy.services.slice(0, 6).forEach((svc, i) => {
      const yPos = 1.9 + i * 0.65;
      brandSlide.addShape(pptx.ShapeType.rect, {
        x: 0.5, y: yPos, w: 0.12, h: 0.12, fill: { color: ACCENT },
      });
      brandSlide.addText(`${svc.name}`, {
        x: 0.8, y: yPos - 0.05, w: 5.5, h: 0.3,
        fontSize: 10, color: DARK, bold: true, fontFace: "Arial",
      });
      brandSlide.addText(truncate(svc.description, 80), {
        x: 0.8, y: yPos + 0.2, w: 5.5, h: 0.3,
        fontSize: 8, color: MEDIUM_GRAY, fontFace: "Arial",
      });
    });

    // Right: Brand Identity
    brandSlide.addText("IDENTIDAD DE MARCA", {
      x: 7, y: 1.4, w: 5.5, h: 0.4,
      fontSize: 11, color: PRIMARY, bold: true, fontFace: "Arial", charSpacing: 2,
    });
    const brandItems = [
      { label: "Personalidad", value: truncate(strategy.brandDesign.personality, 80) },
      { label: "Valores", value: strategy.brandDesign.values.join(", ") },
      { label: "Tipografia Heading", value: strategy.brandDesign.identity.fonts.heading },
      { label: "Tipografia Body", value: strategy.brandDesign.identity.fonts.body },
    ];
    brandItems.forEach((item, i) => {
      const yPos = 1.9 + i * 0.55;
      brandSlide.addText(item.label + ":", {
        x: 7, y: yPos, w: 2, h: 0.3,
        fontSize: 9, color: MEDIUM_GRAY, fontFace: "Arial",
      });
      brandSlide.addText(truncate(item.value, 60), {
        x: 9, y: yPos, w: 3.5, h: 0.3,
        fontSize: 9, color: DARK, bold: true, fontFace: "Arial",
      });
    });

    // Color swatches (larger, more visual)
    brandSlide.addText("PALETA DE COLORES", {
      x: 7, y: 4.2, w: 5.5, h: 0.4,
      fontSize: 9, color: MEDIUM_GRAY, fontFace: "Arial", charSpacing: 2,
    });
    [
      { c: PRIMARY, label: "Primary", x: 7 },
      { c: SECONDARY, label: "Secondary", x: 9 },
      { c: ACCENT, label: "Accent", x: 11 },
    ].forEach(({ c, label, x }) => {
      brandSlide.addShape(pptx.ShapeType.rect, {
        x, y: 4.7, w: 1.8, h: 1, fill: { color: c }, rectRadius: 0.08,
      });
      brandSlide.addText(`#${c}`, {
        x, y: 4.7, w: 1.8, h: 1,
        fontSize: 9, color: parseInt(c, 16) > 0x888888 ? DARK : WHITE,
        fontFace: "Arial", align: "center", valign: "middle",
      });
      brandSlide.addText(label, {
        x, y: 5.75, w: 1.8, h: 0.3,
        fontSize: 8, color: MEDIUM_GRAY, fontFace: "Arial", align: "center",
      });
    });
    addFooter(brandSlide);


    // ╔══════════════════════════════════════════════════════════════╗
    // ║  SLIDE: CONTENT STRATEGY                                    ║
    // ╚══════════════════════════════════════════════════════════════╝
    const csSlide = addSlide();
    csSlide.background = { color: WHITE };
    addHeader(csSlide, "Estrategia de Contenido", "");

    const csRows: [string, string][] = [
      ["A QUIEN SE DIRIGE", strategy.contentStrategy.targetAudience.join("; ")],
      ["DOLOR / PAIN POINTS", strategy.contentStrategy.painPoints.join("; ")],
      ["CANALES", strategy.contentStrategy.channels.join(", ")],
      ["ZONAS DE ENFOQUE", strategy.contentStrategy.focusAreas.join(", ")],
      ["TONO DE COMUNICACION", strategy.contentStrategy.tone],
    ];

    csRows.forEach(([label, value], i) => {
      const yPos = 1.4 + i * 1.1;
      // Label in colored box
      csSlide.addShape(pptx.ShapeType.rect, {
        x: 0.5, y: yPos, w: 3, h: 0.9, fill: { color: i % 2 === 0 ? PRIMARY : SECONDARY },
        rectRadius: 0.05,
      });
      csSlide.addText(label, {
        x: 0.6, y: yPos, w: 2.8, h: 0.9,
        fontSize: 9, color: WHITE, bold: true, fontFace: "Arial",
        valign: "middle",
      });
      // Value
      csSlide.addText(truncate(value, 350), {
        x: 3.7, y: yPos, w: 9.1, h: 0.9,
        fontSize: 10, color: DARK, fontFace: "Arial",
        lineSpacingMultiple: 1.2, valign: "middle", wrap: true,
      });
    });
    addFooter(csSlide);


    // ╔══════════════════════════════════════════════════════════════╗
    // ║  SLIDE: PILARES DE CONTENIDO                                ║
    // ╚══════════════════════════════════════════════════════════════╝
    addSectionDivider("Pilares de\nContenido", "Distribucion estrategica del contenido");

    const pillarsSlide = addSlide();
    pillarsSlide.background = { color: WHITE };
    addHeader(pillarsSlide, "Pilares de Contenido", "");

    // Donut chart (left)
    if (strategy.contentPillars.length > 0) {
      pillarsSlide.addChart(pptx.ChartType.doughnut, [
        {
          name: "Pilares",
          labels: strategy.contentPillars.map((p) => `${p.name} ${p.percentage}%`),
          values: strategy.contentPillars.map((p) => p.percentage),
        },
      ], {
        x: 0.3, y: 1.3, w: 5.5, h: 5.2,
        showPercent: true,
        showTitle: false,
        chartColors: [PRIMARY, ACCENT, SECONDARY, "95A5A6", "6366F1"],
      });
    }

    // Pillar details (right) - card style
    strategy.contentPillars.slice(0, 4).forEach((pillar, i) => {
      const yPos = 1.4 + i * 1.35;
      const pillarColors = [PRIMARY, ACCENT, SECONDARY, "95A5A6"];
      const color = pillarColors[i] || PRIMARY;

      // Percentage badge
      pillarsSlide.addShape(pptx.ShapeType.rect, {
        x: 6.2, y: yPos, w: 1, h: 0.8, fill: { color },
        rectRadius: 0.05,
      });
      pillarsSlide.addText(`${pillar.percentage}%`, {
        x: 6.2, y: yPos, w: 1, h: 0.8,
        fontSize: 16, color: WHITE, bold: true, fontFace: "Arial",
        align: "center", valign: "middle",
      });

      // Name and description
      pillarsSlide.addText(pillar.name, {
        x: 7.4, y: yPos, w: 5.5, h: 0.35,
        fontSize: 11, color: DARK, bold: true, fontFace: "Arial",
      });
      pillarsSlide.addText(truncate(pillar.description, 180), {
        x: 7.4, y: yPos + 0.35, w: 5.5, h: 0.85,
        fontSize: 8, color: MEDIUM_GRAY, fontFace: "Arial",
        lineSpacingMultiple: 1.2, wrap: true, valign: "top",
      });
    });
    addFooter(pillarsSlide);


    // ╔══════════════════════════════════════════════════════════════╗
    // ║  SLIDE: GRILLA DE CONTENIDO (Content Grid / Calendar)       ║
    // ╚══════════════════════════════════════════════════════════════╝
    const gridSlide = addSlide();
    gridSlide.background = { color: WHITE };
    addHeader(gridSlide, "Plan de Contenidos", "Grilla Semanal");

    const gridTableRows: any[][] = [
      [
        { text: "DIA", options: { bold: true, color: WHITE, fill: { color: PRIMARY }, fontSize: 9, align: "center" } },
        { text: "PLATAFORMA", options: { bold: true, color: WHITE, fill: { color: PRIMARY }, fontSize: 9 } },
        { text: "TIPO", options: { bold: true, color: WHITE, fill: { color: PRIMARY }, fontSize: 9 } },
        { text: "TEMA", options: { bold: true, color: WHITE, fill: { color: PRIMARY }, fontSize: 9 } },
        { text: "PILAR", options: { bold: true, color: WHITE, fill: { color: PRIMARY }, fontSize: 9 } },
      ],
    ];
    for (const [idx, item] of strategy.contentGrid.slice(0, 12).entries()) {
      const rowBg = idx % 2 === 0 ? WHITE : LIGHT_BG;
      gridTableRows.push([
        { text: item.day, options: { fontSize: 8, color: PRIMARY, bold: true, fill: { color: rowBg }, align: "center" } },
        { text: item.platform, options: { fontSize: 8, color: DARK, fill: { color: rowBg } } },
        { text: item.contentType, options: { fontSize: 8, color: DARK, fill: { color: rowBg } } },
        { text: truncate(item.topic, 55), options: { fontSize: 8, color: DARK, fill: { color: rowBg } } },
        { text: item.pillar, options: { fontSize: 8, color: MEDIUM_GRAY, fill: { color: rowBg } } },
      ]);
    }
    gridSlide.addTable(gridTableRows, {
      x: 0.3, y: 1.3, w: 12.7, h: 5.5,
      fontSize: 8, fontFace: "Arial",
      border: { type: "solid", pt: 0.3, color: LIGHT_GRAY },
      colW: [1.3, 2, 2, 4.5, 2.9],
      autoPage: false,
    });
    addFooter(gridSlide);


    // ╔══════════════════════════════════════════════════════════════╗
    // ║  SLIDE: KPIs                                                ║
    // ╚══════════════════════════════════════════════════════════════╝
    const kpiSlide = addSlide();
    kpiSlide.background = { color: WHITE };
    addHeader(kpiSlide, "KPIs", "Indicadores Clave de Rendimiento");

    // Group KPIs by category for Astra style
    const kpisByCategory: Record<string, typeof strategy.kpis> = {};
    for (const kpi of strategy.kpis.slice(0, 10)) {
      if (!kpisByCategory[kpi.category]) kpisByCategory[kpi.category] = [];
      kpisByCategory[kpi.category].push(kpi);
    }

    let yKpi = 1.4;
    for (const [category, kpis] of Object.entries(kpisByCategory)) {
      if (yKpi > 6) break;
      // Category header
      kpiSlide.addShape(pptx.ShapeType.rect, {
        x: 0.5, y: yKpi, w: 12.3, h: 0.35, fill: { color: LIGHT_BG },
      });
      kpiSlide.addText(category.toUpperCase() + ":", {
        x: 0.7, y: yKpi, w: 11.8, h: 0.35,
        fontSize: 9, color: PRIMARY, bold: true, fontFace: "Arial",
        charSpacing: 1,
      });
      yKpi += 0.4;

      for (const kpi of kpis.slice(0, 3)) {
        if (yKpi > 6.5) break;
        kpiSlide.addText(`${kpi.metric}:`, {
          x: 0.7, y: yKpi, w: 3, h: 0.3,
          fontSize: 9, color: DARK, bold: true, fontFace: "Arial",
        });
        kpiSlide.addText(truncate(kpi.description, 200), {
          x: 3.7, y: yKpi, w: 9, h: 0.3,
          fontSize: 9, color: MEDIUM_GRAY, fontFace: "Arial",
        });
        yKpi += 0.35;
      }
      yKpi += 0.15;
    }
    addFooter(kpiSlide);


    // ╔══════════════════════════════════════════════════════════════╗
    // ║  SLIDE: CRONOGRAMA DE IMPLEMENTACION                        ║
    // ╚══════════════════════════════════════════════════════════════╝
    const timeSlide = addSlide();
    timeSlide.background = { color: WHITE };
    addHeader(timeSlide, "Cronograma de Implementacion", "");

    strategy.implementationTimeline.slice(0, 4).forEach((phase, i) => {
      const yPos = 1.4 + i * 1.4;
      const phaseColors = [PRIMARY, ACCENT, SECONDARY, "95A5A6"];
      const phaseColor = phaseColors[i] || PRIMARY;

      // Phase indicator bar
      timeSlide.addShape(pptx.ShapeType.rect, {
        x: 0.5, y: yPos, w: 0.25, h: 1.2, fill: { color: phaseColor },
        rectRadius: 0.05,
      });

      // Phase title with weeks badge
      timeSlide.addText(phase.phase, {
        x: 1, y: yPos, w: 8, h: 0.35,
        fontSize: 12, color: DARK, bold: true, fontFace: "Arial",
      });
      timeSlide.addShape(pptx.ShapeType.rect, {
        x: 9.5, y: yPos, w: 2, h: 0.35, fill: { color: phaseColor },
        rectRadius: 0.15,
      });
      timeSlide.addText(phase.weeks, {
        x: 9.5, y: yPos, w: 2, h: 0.35,
        fontSize: 9, color: WHITE, bold: true, fontFace: "Arial", align: "center",
      });

      // Tasks
      const taskText = phase.tasks.slice(0, 3).map((t) => `  •  ${truncate(t, 90)}`).join("\n");
      timeSlide.addText(taskText, {
        x: 1, y: yPos + 0.4, w: 11, h: 0.8,
        fontSize: 8, color: MEDIUM_GRAY, fontFace: "Arial", lineSpacingMultiple: 1.3,
      });
    });
    addFooter(timeSlide);


    // ╔══════════════════════════════════════════════════════════════╗
    // ║  SLIDE: CONCLUSIONES Y RECOMENDACIONES                      ║
    // ╚══════════════════════════════════════════════════════════════╝
    const finalSlide = addSlide();
    finalSlide.background = { color: WHITE };
    addHeader(finalSlide, "Conclusiones y Recomendaciones", "");

    // Conclusions (left)
    finalSlide.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: 1.3, w: 5.9, h: 5.3, fill: { color: LIGHT_BG },
      rectRadius: 0.1,
    });
    finalSlide.addText("CONCLUSIONES", {
      x: 0.8, y: 1.4, w: 5.3, h: 0.4,
      fontSize: 10, color: PRIMARY, bold: true, fontFace: "Arial", charSpacing: 2,
    });
    (strategy.conclusions || []).slice(0, 4).forEach((c, i) => {
      const yPos = 1.9 + i * 1.1;
      finalSlide.addShape(pptx.ShapeType.rect, {
        x: 0.8, y: yPos + 0.03, w: 0.12, h: 0.12, fill: { color: PRIMARY },
      });
      finalSlide.addText(truncate(c, 250), {
        x: 1.1, y: yPos, w: 5, h: 1,
        fontSize: 9, color: DARK, fontFace: "Arial",
        lineSpacingMultiple: 1.25, valign: "top", wrap: true,
      });
    });

    // Recommendations (right)
    finalSlide.addShape(pptx.ShapeType.rect, {
      x: 6.8, y: 1.3, w: 5.9, h: 5.3, fill: { color: LIGHT_BG },
      rectRadius: 0.1,
    });
    finalSlide.addText("RECOMENDACIONES", {
      x: 7.1, y: 1.4, w: 5.3, h: 0.4,
      fontSize: 10, color: ACCENT, bold: true, fontFace: "Arial", charSpacing: 2,
    });
    (strategy.recommendations || []).slice(0, 4).forEach((r, i) => {
      const yPos = 1.9 + i * 1.1;
      finalSlide.addShape(pptx.ShapeType.rect, {
        x: 7.1, y: yPos + 0.03, w: 0.12, h: 0.12, fill: { color: ACCENT },
      });
      finalSlide.addText(truncate(r, 250), {
        x: 7.4, y: yPos, w: 5, h: 1,
        fontSize: 9, color: DARK, fontFace: "Arial",
        lineSpacingMultiple: 1.25, valign: "top", wrap: true,
      });
    });
    addFooter(finalSlide);


    // ╔══════════════════════════════════════════════════════════════╗
    // ║  SLIDE: CLOSING                                             ║
    // ╚══════════════════════════════════════════════════════════════╝
    const closingSlide = addSlide();
    closingSlide.background = { color: PRIMARY };
    // Decorative line
    closingSlide.addShape(pptx.ShapeType.rect, {
      x: 5, y: 1.5, w: 3.33, h: 0.04, fill: { color: ACCENT },
    });
    closingSlide.addText("Gracias", {
      x: 0, y: 2, w: 13.33, h: 1.5,
      fontSize: 52, color: WHITE, bold: true, fontFace: "Arial", align: "center",
    });
    closingSlide.addText(strategy.companyName.toUpperCase(), {
      x: 0, y: 3.8, w: 13.33, h: 1,
      fontSize: 20, color: ACCENT, fontFace: "Arial", align: "center",
      charSpacing: 5,
    });
    closingSlide.addText("Estrategia de Marketing Digital", {
      x: 0, y: 5, w: 13.33, h: 0.6,
      fontSize: 14, color: LIGHT_GRAY, fontFace: "Arial", align: "center",
    });
    closingSlide.addShape(pptx.ShapeType.rect, {
      x: 5, y: 5.8, w: 3.33, h: 0.04, fill: { color: ACCENT },
    });
    closingSlide.addText("Generado con StrategyGravity", {
      x: 0, y: 6.5, w: 13.33, h: 0.5,
      fontSize: 9, color: LIGHT_GRAY, fontFace: "Arial", align: "center",
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
        slideCount,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: `Error generando PPTX: ${(err as Error).message}`,
    };
  }
}
