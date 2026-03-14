import PptxGenJSImport from "pptxgenjs";
import { mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { env } from "../config/env.js";
import { fetchCompetitorLogos, fetchCompanyLogo } from "./image-fetcher.js";
import type { MarketingStrategy, ToolResult } from "../types/index.js";

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

/** Safely coerce any value to string — LLM may return objects instead of strings */
function toStr(val: unknown): string {
  if (typeof val === "string") return val;
  if (val && typeof val === "object") {
    // Try common object shapes: { name, description }, { title, ... }, etc.
    const obj = val as Record<string, unknown>;
    if (obj.name && obj.description) return `${obj.name}: ${obj.description}`;
    if (obj.title && obj.description) return `${obj.title}: ${obj.description}`;
    if (obj.name) return String(obj.name);
    if (obj.title) return String(obj.title);
    if (obj.text) return String(obj.text);
    return JSON.stringify(val);
  }
  return val == null ? "" : String(val);
}

// ─── Color helpers ───
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  return [r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0")).join("").toUpperCase();
}

function lightenHex(hex: string, pct: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * pct, g + (255 - g) * pct, b + (255 - b) * pct);
}

function darkenHex(hex: string, pct: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 - pct), g * (1 - pct), b * (1 - pct));
}

function isLightColor(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

export async function generatePptx(strategy: MarketingStrategy): Promise<ToolResult> {
  try {
    // ─── Fetch images in parallel with 10s global timeout ───
    const IMAGE_TIMEOUT = 10_000;
    let companyLogo: string | null = null;
    let competitorLogos = new Map<string, string>();
    try {
      const imagePromise = Promise.all([
        fetchCompanyLogo(strategy.brandDesign?.identity?.website),
        fetchCompetitorLogos(strategy.competitors || []),
      ]);
      let timeoutId: ReturnType<typeof setTimeout>;
      const timeoutPromise = new Promise<[null, Map<string, string>]>(resolve => {
        timeoutId = setTimeout(() => { console.log("  [Images] Timeout global de imagenes (10s), continuando sin logos"); resolve([null, new Map()]); }, IMAGE_TIMEOUT);
      });
      const result = await Promise.race([imagePromise, timeoutPromise]);
      clearTimeout(timeoutId!); // Cancel timeout if images won the race
      companyLogo = result[0];
      competitorLogos = result[1];
    } catch {
      console.log("  [Images] Error descargando imagenes, continuando sin logos");
    }

    const pptx = new PptxGenJS();
    const colors = strategy.brandDesign?.identity?.colors || { primary: "#1A1A2E", secondary: "#16213E", accent: "#E94560" };
    const PRIMARY = ensureHex(colors.primary);
    const SECONDARY = ensureHex(colors.secondary);
    const ACCENT = ensureHex(colors.accent);
    const WHITE = "FFFFFF";

    // ─── Brand palette ───
    const PRIMARY_DARK = darkenHex(PRIMARY, 0.25);
    const PRIMARY_LIGHT = lightenHex(PRIMARY, 0.94);
    const ACCENT_LIGHT = lightenHex(ACCENT, 0.92);
    const SECONDARY_LIGHT = lightenHex(SECONDARY, 0.92);
    const MEDIUM_GRAY = "6B7280";
    const LIGHT_GRAY = lightenHex(PRIMARY, 0.85);
    const SOFT_BG = lightenHex(PRIMARY, 0.97);
    const TEXT_DARK = "1F2937";
    const TEXT_LIGHT = "9CA3AF";
    const STRENGTH_GREEN = "059669";
    const STRENGTH_BG = lightenHex(STRENGTH_GREEN, 0.93);
    const WEAKNESS_RED = "DC2626";
    const WEAKNESS_BG = lightenHex(WEAKNESS_RED, 0.93);

    // ─── Brand fonts ───
    const HF = strategy.brandDesign?.identity?.fonts?.heading || "Arial";
    const BF = strategy.brandDesign?.identity?.fonts?.body || "Arial";

    let slideCount = 0;
    const addSlide = () => { slideCount++; return pptx.addSlide(); };
    pptx.layout = "LAYOUT_WIDE";
    pptx.author = "StrategyGravity";
    pptx.company = strategy.companyName;
    pptx.title = `${strategy.companyName} - Estrategia de Marketing`;

    // ─── HELPER: minimal footer ───
    const addFooter = (slide: any) => {
      slide.addShape(pptx.ShapeType.rect, { x: 0.8, y: 7.0, w: 11.73, h: 0.012, fill: { color: LIGHT_GRAY } });
      slide.addText(strategy.companyName, { x: 0.8, y: 7.05, w: 4, h: 0.35, fontSize: 7, color: TEXT_LIGHT, fontFace: BF });
      slide.addText("Estrategia de Marketing | StrategyGravity", { x: 7, y: 7.05, w: 5.5, h: 0.35, fontSize: 7, color: TEXT_LIGHT, fontFace: BF, align: "right" });
    };

    // ─── HELPER: clean divider ───
    const addDivider = (title: string, subtitle?: string) => {
      const s = addSlide();
      s.background = { color: PRIMARY };
      s.addShape(pptx.ShapeType.rect, { x: 4.5, y: 2.5, w: 4.33, h: 0.02, fill: { color: ACCENT } });
      s.addText(title.toUpperCase(), {
        x: 0.8, y: 2.8, w: 11.73, h: 2, fontSize: 28, color: WHITE, bold: true,
        fontFace: HF, align: "center", lineSpacingMultiple: 1.5, charSpacing: 8,
      });
      if (subtitle) {
        s.addText(subtitle, { x: 2, y: 5, w: 9.33, h: 0.6, fontSize: 12, color: lightenHex(PRIMARY, 0.6), fontFace: BF, align: "center" });
      }
      s.addShape(pptx.ShapeType.rect, { x: 4.5, y: 5.8, w: 4.33, h: 0.02, fill: { color: ACCENT } });
    };

    // ─── HELPER: section title bar ───
    const addTitle = (slide: any, title: string, sub?: string) => {
      slide.addShape(pptx.ShapeType.rect, { x: 0.8, y: 0.5, w: 0.06, h: 0.55, fill: { color: ACCENT } });
      slide.addText(title.toUpperCase(), { x: 1.05, y: 0.5, w: 9, h: 0.55, fontSize: 15, color: PRIMARY, bold: true, fontFace: HF, charSpacing: 4 });
      if (sub) slide.addText(sub, { x: 9, y: 0.55, w: 3.8, h: 0.45, fontSize: 9, color: TEXT_LIGHT, fontFace: BF, align: "right" });
      slide.addShape(pptx.ShapeType.rect, { x: 0.8, y: 1.15, w: 11.73, h: 0.008, fill: { color: LIGHT_GRAY } });
    };


    // ╔══════════════════════════════════════════════════════════════╗
    // ║  COVER SLIDE                                                ║
    // ╚══════════════════════════════════════════════════════════════╝
    const cover = addSlide();
    cover.background = { color: PRIMARY };
    cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: 7.5, fill: { color: ACCENT } });
    cover.addShape(pptx.ShapeType.rect, { x: 0.8, y: 1.5, w: 5, h: 0.02, fill: { color: ACCENT } });
    cover.addText("ESTRATEGIA DE MARKETING", { x: 0.8, y: 1.8, w: 8, h: 0.6, fontSize: 11, color: ACCENT, fontFace: BF, charSpacing: 8 });

    // Company logo if available
    if (companyLogo) {
      try {
        cover.addImage({ data: companyLogo, x: 9.5, y: 1.5, w: 1.2, h: 1.2 });
      } catch {}
    }

    cover.addText(strategy.companyName.toUpperCase(), { x: 0.8, y: 3, w: 11, h: 1.8, fontSize: 48, color: WHITE, bold: true, fontFace: HF, charSpacing: 6 });
    cover.addShape(pptx.ShapeType.rect, { x: 0.8, y: 5.5, w: 3, h: 0.02, fill: { color: ACCENT } });
    cover.addText(`${new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}`, { x: 0.8, y: 5.8, w: 8, h: 0.4, fontSize: 10, color: lightenHex(PRIMARY, 0.5), fontFace: BF });
    cover.addText("Generado por StrategyGravity", { x: 0.8, y: 6.3, w: 8, h: 0.3, fontSize: 8, color: lightenHex(PRIMARY, 0.4), fontFace: BF });


    // ╔══════════════════════════════════════════════════════════════╗
    // ║  DESCRIPCIÓN                                                ║
    // ╚══════════════════════════════════════════════════════════════╝
    const desc = addSlide();
    desc.background = { color: WHITE };
    desc.addText(strategy.companyName.toUpperCase(), { x: 0.8, y: 0.5, w: 11.73, h: 1, fontSize: 26, color: PRIMARY, bold: true, fontFace: HF, charSpacing: 6 });
    desc.addShape(pptx.ShapeType.rect, { x: 0.8, y: 1.5, w: 3, h: 0.02, fill: { color: ACCENT } });

    // Company logo next to name
    if (companyLogo) {
      try { desc.addImage({ data: companyLogo, x: 11.5, y: 0.6, w: 0.8, h: 0.8 }); } catch {}
    }

    desc.addText(truncate(strategy.description.summary, 1500), { x: 0.8, y: 1.8, w: 11.73, h: 3.5, fontSize: 11, color: TEXT_DARK, fontFace: BF, lineSpacingMultiple: 1.5, valign: "top", wrap: true });

    // Objective
    desc.addShape(pptx.ShapeType.rect, { x: 0.8, y: 5.7, w: 11.73, h: 1, fill: { color: PRIMARY_LIGHT }, rectRadius: 0.05 });
    desc.addShape(pptx.ShapeType.rect, { x: 0.8, y: 5.7, w: 0.06, h: 1, fill: { color: ACCENT } });
    desc.addText(`Objetivo: ${truncate(strategy.description.objective, 400)}`, { x: 1.1, y: 5.8, w: 11.2, h: 0.8, fontSize: 10, color: PRIMARY, bold: true, fontFace: BF, lineSpacingMultiple: 1.3, valign: "middle", wrap: true });
    addFooter(desc);


    // ╔══════════════════════════════════════════════════════════════╗
    // ║  COMPETITORS                                                ║
    // ╚══════════════════════════════════════════════════════════════╝
    addDivider("Análisis de la\nCompetencia", `${strategy.competitors.length} competidores identificados`);

    for (const [idx, comp] of strategy.competitors.slice(0, 5).entries()) {
      // ── Competitor Analysis Slide ──
      const cs = addSlide();
      cs.background = { color: WHITE };

      // Competitor logo
      const logo = competitorLogos.get(comp.name);
      if (logo) {
        try { cs.addImage({ data: logo, x: 11.5, y: 0.35, w: 0.8, h: 0.8 }); } catch {}
      }

      cs.addText(comp.name.toUpperCase(), { x: 0.8, y: 0.4, w: 10.5, h: 0.7, fontSize: 17, color: PRIMARY, bold: true, fontFace: HF, charSpacing: 5 });

      if (comp.services?.length > 0) {
        cs.addText(comp.services.slice(0, 4).map(s => toStr(s)).join("  ·  "), { x: 0.8, y: 1.05, w: 11.73, h: 0.3, fontSize: 9, color: TEXT_LIGHT, fontFace: BF, italic: true });
      }
      cs.addShape(pptx.ShapeType.rect, { x: 0.8, y: 1.45, w: 11.73, h: 0.008, fill: { color: LIGHT_GRAY } });

      // Analysis text
      if (comp.detailedAnalysis) {
        cs.addText(truncate(comp.detailedAnalysis, 700), { x: 0.8, y: 1.7, w: 11.73, h: 2.5, fontSize: 10, color: TEXT_DARK, fontFace: BF, lineSpacingMultiple: 1.4, valign: "top", wrap: true });
      }

      // Fortalezas (left)
      cs.addShape(pptx.ShapeType.rect, { x: 0.8, y: 4.4, w: 5.9, h: 2.3, fill: { color: STRENGTH_BG }, rectRadius: 0.05 });
      cs.addText("Fortalezas:", { x: 1, y: 4.5, w: 5.5, h: 0.3, fontSize: 10, color: STRENGTH_GREEN, bold: true, fontFace: HF });
      cs.addText(comp.strengths.slice(0, 3).map((s) => `•  ${truncate(toStr(s), 140)}`).join("\n"), { x: 1, y: 4.85, w: 5.5, h: 1.7, fontSize: 9, color: TEXT_DARK, fontFace: BF, lineSpacingMultiple: 1.35, valign: "top", wrap: true });

      // Oportunidad (right)
      cs.addShape(pptx.ShapeType.rect, { x: 7, y: 4.4, w: 5.53, h: 2.3, fill: { color: ACCENT_LIGHT }, rectRadius: 0.05 });
      cs.addText(`Oportunidad para ${strategy.companyName}:`, { x: 7.2, y: 4.5, w: 5.13, h: 0.3, fontSize: 10, color: ACCENT, bold: true, fontFace: HF });
      cs.addText((comp.opportunitiesForUs || []).slice(0, 2).map((o) => `•  ${truncate(toStr(o), 180)}`).join("\n"), { x: 7.2, y: 4.85, w: 5.13, h: 1.7, fontSize: 9, color: TEXT_DARK, fontFace: BF, lineSpacingMultiple: 1.35, valign: "top", wrap: true });

      // Website link
      if (comp.website) {
        cs.addText(comp.website, { x: 0.8, y: 6.75, w: 6, h: 0.25, fontSize: 8, color: ACCENT, fontFace: BF, hyperlink: { url: comp.website } });
      }
      addFooter(cs);

      // ── SEO Analysis Slide ──
      const seo = addSlide();
      seo.background = { color: WHITE };
      addTitle(seo, "Análisis de SEO", comp.name);

      const seoData = comp.seoAnalysis;
      if (seoData) {
        seo.addText("Palabras clave principales", { x: 0.8, y: 1.4, w: 6, h: 0.4, fontSize: 12, color: PRIMARY, bold: true, fontFace: HF });
        (seoData.topKeywords || []).slice(0, 10).forEach((kw: string, ki: number) => {
          const y = 1.95 + ki * 0.36;
          if (ki % 2 === 0) seo.addShape(pptx.ShapeType.rect, { x: 0.8, y: y - 0.02, w: 6, h: 0.34, fill: { color: SOFT_BG } });
          seo.addText(`${ki + 1}.`, { x: 0.9, y, w: 0.5, h: 0.3, fontSize: 9, color: TEXT_LIGHT, fontFace: BF });
          seo.addText(kw, { x: 1.4, y, w: 5.3, h: 0.3, fontSize: 9, color: TEXT_DARK, fontFace: BF });
        });

        // Traffic card
        seo.addShape(pptx.ShapeType.rect, { x: 7.5, y: 1.4, w: 4.83, h: 1.6, fill: { color: PRIMARY_LIGHT }, rectRadius: 0.08 });
        seo.addShape(pptx.ShapeType.rect, { x: 7.5, y: 1.4, w: 0.06, h: 1.6, fill: { color: PRIMARY } });
        seo.addText("Tráfico estimado", { x: 7.8, y: 1.55, w: 4.3, h: 0.3, fontSize: 9, color: TEXT_LIGHT, fontFace: BF });
        seo.addText(seoData.estimatedTraffic || "N/A", { x: 7.8, y: 1.9, w: 4.3, h: 0.8, fontSize: 24, color: PRIMARY, bold: true, fontFace: HF });
      }

      // Weaknesses
      if (comp.weaknesses?.length > 0) {
        seo.addShape(pptx.ShapeType.rect, { x: 7.5, y: 3.4, w: 4.83, h: 3.2, fill: { color: WEAKNESS_BG }, rectRadius: 0.05 });
        seo.addText("Debilidades:", { x: 7.7, y: 3.5, w: 4.43, h: 0.3, fontSize: 10, color: WEAKNESS_RED, bold: true, fontFace: HF });
        seo.addText(comp.weaknesses.slice(0, 3).map((w) => `•  ${truncate(toStr(w), 140)}`).join("\n"), { x: 7.7, y: 3.85, w: 4.43, h: 2.5, fontSize: 9, color: TEXT_DARK, fontFace: BF, lineSpacingMultiple: 1.35, valign: "top", wrap: true });
      }

      if (comp.website) {
        seo.addText(comp.website, { x: 0.8, y: 6.5, w: 6, h: 0.25, fontSize: 8, color: ACCENT, fontFace: BF, hyperlink: { url: comp.website } });
      }
      addFooter(seo);
    }


    // ╔══════════════════════════════════════════════════════════════╗
    // ║  COMPARATIVE ANALYSIS                                       ║
    // ╚══════════════════════════════════════════════════════════════╝
    const compA = addSlide();
    compA.background = { color: WHITE };
    addTitle(compA, "Análisis Comparativo", strategy.companyName);
    compA.addShape(pptx.ShapeType.rect, { x: 0.8, y: 1.4, w: 0.04, h: 5, fill: { color: ACCENT } });
    compA.addText(truncate(strategy.comparativeAnalysis, 2800), { x: 1.1, y: 1.4, w: 11.43, h: 5.3, fontSize: 10, color: TEXT_DARK, fontFace: BF, lineSpacingMultiple: 1.4, valign: "top", wrap: true });
    addFooter(compA);


    // ╔══════════════════════════════════════════════════════════════╗
    // ║  KEYWORDS                                                   ║
    // ╚══════════════════════════════════════════════════════════════╝
    addDivider("Palabras Clave\n(SEO Keywords)", "Investigación de keywords estratégicas");

    const kwGroups = strategy.keywordGroups.slice(0, 5);
    for (let gi = 0; gi < kwGroups.length; gi += 2) {
      const ks = addSlide();
      ks.background = { color: WHITE };
      addTitle(ks, "Palabras Clave (SEO Keywords)");

      kwGroups.slice(gi, gi + 2).forEach((group, li) => {
        const cx = li === 0 ? 0.8 : 7;
        const cw = 5.8;
        ks.addText(group.category.toUpperCase(), { x: cx, y: 1.4, w: cw, h: 0.45, fontSize: 11, color: PRIMARY, bold: true, fontFace: HF, charSpacing: 3 });
        ks.addShape(pptx.ShapeType.rect, { x: cx, y: 1.85, w: 2, h: 0.012, fill: { color: ACCENT } });

        group.keywords.slice(0, 10).forEach((kw, ki) => {
          const y = 2.1 + ki * 0.4;
          if (ki % 2 === 0) ks.addShape(pptx.ShapeType.rect, { x: cx, y: y - 0.02, w: cw, h: 0.36, fill: { color: SOFT_BG } });
          ks.addText(kw.term, { x: cx + 0.15, y, w: cw - 0.3, h: 0.32, fontSize: 9, color: TEXT_DARK, fontFace: BF, valign: "middle" });
        });
      });
      addFooter(ks);
    }


    // ╔══════════════════════════════════════════════════════════════╗
    // ║  STRATEGIC CONCLUSIONS                                      ║
    // ╚══════════════════════════════════════════════════════════════╝
    const concl = addSlide();
    concl.background = { color: WHITE };
    addTitle(concl, "Conclusiones Estratégicas");

    strategy.strategicConclusions.slice(0, 4).forEach((raw, i) => {
      const conclusion = toStr(raw);
      const y = 1.5 + i * 1.35;
      const colonIdx = conclusion.indexOf(":");
      if (colonIdx > 0 && colonIdx < 80) {
        concl.addShape(pptx.ShapeType.rect, { x: 0.8, y: y + 0.05, w: 0.12, h: 0.12, fill: { color: ACCENT } });
        concl.addText(conclusion.slice(0, colonIdx + 1), { x: 1.15, y, w: 11.38, h: 0.3, fontSize: 11, color: PRIMARY, bold: true, fontFace: HF });
        concl.addText(truncate(conclusion.slice(colonIdx + 1).trim(), 400), { x: 1.15, y: y + 0.35, w: 11.38, h: 0.9, fontSize: 10, color: TEXT_DARK, fontFace: BF, lineSpacingMultiple: 1.35, valign: "top", wrap: true });
      } else {
        concl.addShape(pptx.ShapeType.rect, { x: 0.8, y: y + 0.05, w: 0.12, h: 0.12, fill: { color: ACCENT } });
        concl.addText(truncate(conclusion, 500), { x: 1.15, y, w: 11.38, h: 1.2, fontSize: 10, color: TEXT_DARK, fontFace: BF, lineSpacingMultiple: 1.35, valign: "top", wrap: true });
      }
    });
    addFooter(concl);


    // ╔══════════════════════════════════════════════════════════════╗
    // ║  DIFFERENTIATION                                            ║
    // ╚══════════════════════════════════════════════════════════════╝
    const diff = addSlide();
    diff.background = { color: WHITE };
    addTitle(diff, `¿Dónde se puede diferenciar ${strategy.companyName}?`);

    strategy.differentiationProposals.slice(0, 4).forEach((raw, i) => {
      const proposal = toStr(raw);
      const y = 1.5 + i * 1.35;
      const colonIdx = proposal.indexOf(":");
      if (colonIdx > 0 && colonIdx < 80) {
        diff.addText(proposal.slice(0, colonIdx + 1), { x: 0.8, y, w: 11.73, h: 0.3, fontSize: 11, color: ACCENT, bold: true, fontFace: HF });
        diff.addText(truncate(proposal.slice(colonIdx + 1).trim(), 450), { x: 0.8, y: y + 0.35, w: 11.73, h: 0.9, fontSize: 10, color: TEXT_DARK, fontFace: BF, lineSpacingMultiple: 1.35, valign: "top", wrap: true });
      } else {
        diff.addText(truncate(proposal, 500), { x: 0.8, y, w: 11.73, h: 1.2, fontSize: 10, color: TEXT_DARK, fontFace: BF, lineSpacingMultiple: 1.35, valign: "top", wrap: true });
      }
    });
    addFooter(diff);


    // ╔══════════════════════════════════════════════════════════════╗
    // ║  SERVICES & BRAND                                           ║
    // ╚══════════════════════════════════════════════════════════════╝
    const brand = addSlide();
    brand.background = { color: WHITE };
    addTitle(brand, "Servicios y Diseño de Marca");

    brand.addText("SERVICIOS", { x: 0.8, y: 1.4, w: 6, h: 0.35, fontSize: 10, color: PRIMARY, bold: true, fontFace: HF, charSpacing: 3 });
    brand.addShape(pptx.ShapeType.rect, { x: 0.8, y: 1.75, w: 1.5, h: 0.008, fill: { color: ACCENT } });

    strategy.services.slice(0, 6).forEach((svc, i) => {
      const y = 1.95 + i * 0.65;
      brand.addShape(pptx.ShapeType.rect, { x: 0.8, y: y + 0.05, w: 0.1, h: 0.1, fill: { color: ACCENT } });
      brand.addText(svc.name, { x: 1.1, y, w: 5.3, h: 0.25, fontSize: 10, color: TEXT_DARK, bold: true, fontFace: HF });
      brand.addText(truncate(svc.description, 80), { x: 1.1, y: y + 0.25, w: 5.3, h: 0.3, fontSize: 8, color: TEXT_LIGHT, fontFace: BF });
    });

    brand.addText("IDENTIDAD", { x: 7.2, y: 1.4, w: 5.5, h: 0.35, fontSize: 10, color: PRIMARY, bold: true, fontFace: HF, charSpacing: 3 });
    brand.addShape(pptx.ShapeType.rect, { x: 7.2, y: 1.75, w: 1.5, h: 0.008, fill: { color: ACCENT } });

    [
      { l: "Personalidad", v: truncate(strategy.brandDesign.personality, 80) },
      { l: "Valores", v: strategy.brandDesign.values.join(", ") },
      { l: "Tipografía", v: `${strategy.brandDesign.identity.fonts.heading} / ${strategy.brandDesign.identity.fonts.body}` },
    ].forEach((item, i) => {
      const y = 1.95 + i * 0.6;
      brand.addText(item.l, { x: 7.2, y, w: 2, h: 0.25, fontSize: 9, color: TEXT_LIGHT, fontFace: BF });
      brand.addText(truncate(item.v, 65), { x: 9.2, y, w: 3.3, h: 0.25, fontSize: 9, color: TEXT_DARK, bold: true, fontFace: BF });
    });

    // Color swatches
    brand.addText("Paleta", { x: 7.2, y: 3.8, w: 5.5, h: 0.3, fontSize: 9, color: TEXT_LIGHT, fontFace: HF });
    [
      { c: PRIMARY, label: "Primary", x: 7.2 },
      { c: SECONDARY, label: "Secondary", x: 9.1 },
      { c: ACCENT, label: "Accent", x: 11 },
    ].forEach(({ c, label, x }) => {
      brand.addShape(pptx.ShapeType.rect, { x, y: 4.2, w: 1.7, h: 0.85, fill: { color: c }, rectRadius: 0.06 });
      brand.addText(`#${c}`, { x, y: 4.2, w: 1.7, h: 0.85, fontSize: 8, color: isLightColor(c) ? TEXT_DARK : WHITE, fontFace: BF, align: "center", valign: "middle" });
      brand.addText(label, { x, y: 5.1, w: 1.7, h: 0.2, fontSize: 7, color: TEXT_LIGHT, fontFace: BF, align: "center" });
    });
    addFooter(brand);


    // ╔══════════════════════════════════════════════════════════════╗
    // ║  CONTENT STRATEGY                                           ║
    // ╚══════════════════════════════════════════════════════════════╝
    const csSlide = addSlide();
    csSlide.background = { color: WHITE };
    addTitle(csSlide, "Estrategia de Contenido");

    const csRows: [string, string][] = [
      ["A quién se dirige", strategy.contentStrategy.targetAudience.join("\n")],
      ["Dolor", strategy.contentStrategy.painPoints.join("\n")],
      ["Canales", strategy.contentStrategy.channels.join(", ")],
      ["Zonas de Enfoque", strategy.contentStrategy.focusAreas.join("\n")],
      ["Tono", strategy.contentStrategy.tone],
    ];

    csRows.forEach(([label, value], i) => {
      const y = 1.4 + i * 1.05;
      if (i > 0) csSlide.addShape(pptx.ShapeType.rect, { x: 0.8, y: y - 0.05, w: 11.73, h: 0.006, fill: { color: LIGHT_GRAY } });
      csSlide.addShape(pptx.ShapeType.rect, { x: 0.8, y, w: 2.8, h: 0.9, fill: { color: PRIMARY_LIGHT }, rectRadius: 0.04 });
      csSlide.addText(label, { x: 0.95, y, w: 2.5, h: 0.9, fontSize: 10, color: PRIMARY, bold: true, fontFace: HF, valign: "middle" });
      csSlide.addText(truncate(value, 300), { x: 3.8, y, w: 8.73, h: 0.9, fontSize: 10, color: TEXT_DARK, fontFace: BF, lineSpacingMultiple: 1.25, valign: "middle", wrap: true });
    });
    addFooter(csSlide);


    // ╔══════════════════════════════════════════════════════════════╗
    // ║  CONTENT PILLARS                                            ║
    // ╚══════════════════════════════════════════════════════════════╝
    addDivider("Pilares de\nContenido", "Distribución estratégica del contenido");

    const pillS = addSlide();
    pillS.background = { color: WHITE };
    addTitle(pillS, "Pilares de Contenido");

    const pColors = [PRIMARY, ACCENT, SECONDARY, MEDIUM_GRAY];
    const pCount = Math.min(strategy.contentPillars.length, 4);

    if (pCount <= 3) {
      const pw = pCount === 2 ? 5.7 : 3.7;
      strategy.contentPillars.slice(0, pCount).forEach((p, i) => {
        const x = 0.8 + i * (pw + 0.3);
        const pc = pColors[i];
        pillS.addText(`${p.percentage}%`, { x, y: 1.4, w: pw, h: 1, fontSize: 36, color: pc, bold: true, fontFace: HF });
        pillS.addText(p.name, { x, y: 2.4, w: pw, h: 0.4, fontSize: 11, color: PRIMARY, bold: true, fontFace: HF });
        pillS.addShape(pptx.ShapeType.rect, { x, y: 2.8, w: 1.5, h: 0.012, fill: { color: pc } });
        pillS.addText(truncate(p.description, 280), { x, y: 3, w: pw, h: 2, fontSize: 9, color: TEXT_DARK, fontFace: BF, lineSpacingMultiple: 1.4, valign: "top", wrap: true });
        if (p.topics?.length > 0) {
          pillS.addText(p.topics.slice(0, 4).map((t) => `•  ${t}`).join("\n"), { x, y: 5.1, w: pw, h: 1.5, fontSize: 8, color: TEXT_LIGHT, fontFace: BF, lineSpacingMultiple: 1.3 });
        }
      });
    } else {
      strategy.contentPillars.slice(0, 4).forEach((p, i) => {
        const col = i % 2, row = Math.floor(i / 2);
        const x = col === 0 ? 0.8 : 7, y = row === 0 ? 1.4 : 4.3;
        const pc = pColors[i];
        pillS.addText(`${p.percentage}%`, { x, y, w: 1.5, h: 0.65, fontSize: 28, color: pc, bold: true, fontFace: HF });
        pillS.addText(p.name, { x: x + 1.5, y, w: 4, h: 0.3, fontSize: 11, color: PRIMARY, bold: true, fontFace: HF });
        pillS.addShape(pptx.ShapeType.rect, { x: x + 1.5, y: y + 0.35, w: 1.5, h: 0.01, fill: { color: pc } });
        pillS.addText(truncate(p.description, 200), { x: x + 1.5, y: y + 0.5, w: 4, h: 2, fontSize: 9, color: TEXT_DARK, fontFace: BF, lineSpacingMultiple: 1.3, valign: "top", wrap: true });
      });
    }
    addFooter(pillS);


    // ╔══════════════════════════════════════════════════════════════╗
    // ║  CONTENT GRID                                               ║
    // ╚══════════════════════════════════════════════════════════════╝
    const grid = addSlide();
    grid.background = { color: WHITE };
    addTitle(grid, "Plan de Contenidos", "Grilla Semanal");

    const gridRows: any[][] = [
      [
        { text: "Día", options: { bold: true, color: WHITE, fill: { color: PRIMARY }, fontSize: 9, fontFace: HF, align: "center" } },
        { text: "Plataforma", options: { bold: true, color: WHITE, fill: { color: PRIMARY }, fontSize: 9, fontFace: HF } },
        { text: "Tipo", options: { bold: true, color: WHITE, fill: { color: PRIMARY }, fontSize: 9, fontFace: HF } },
        { text: "Tema", options: { bold: true, color: WHITE, fill: { color: PRIMARY }, fontSize: 9, fontFace: HF } },
        { text: "Pilar", options: { bold: true, color: WHITE, fill: { color: PRIMARY }, fontSize: 9, fontFace: HF } },
      ],
    ];
    strategy.contentGrid.slice(0, 10).forEach((item, idx) => {
      const bg = idx % 2 === 0 ? WHITE : SOFT_BG;
      gridRows.push([
        { text: item.day, options: { fontSize: 9, color: PRIMARY, bold: true, fill: { color: bg }, align: "center", fontFace: BF } },
        { text: item.platform, options: { fontSize: 9, color: TEXT_DARK, fill: { color: bg }, fontFace: BF } },
        { text: item.contentType, options: { fontSize: 9, color: TEXT_DARK, fill: { color: bg }, fontFace: BF } },
        { text: truncate(item.topic, 55), options: { fontSize: 9, color: TEXT_DARK, fill: { color: bg }, fontFace: BF } },
        { text: item.pillar, options: { fontSize: 8, color: TEXT_LIGHT, fill: { color: bg }, fontFace: BF } },
      ]);
    });
    grid.addTable(gridRows, { x: 0.5, y: 1.3, w: 12.33, h: 5.2, fontSize: 9, fontFace: BF, border: { type: "solid", pt: 0.3, color: LIGHT_GRAY }, colW: [1.3, 2, 1.8, 4.5, 2.73], autoPage: false });
    addFooter(grid);


    // ╔══════════════════════════════════════════════════════════════╗
    // ║  KPIs                                                       ║
    // ╚══════════════════════════════════════════════════════════════╝
    const kpi = addSlide();
    kpi.background = { color: WHITE };
    addTitle(kpi, "KPIs", "Indicadores Clave");

    const kpisByCategory: Record<string, typeof strategy.kpis> = {};
    for (const k of strategy.kpis.slice(0, 12)) {
      if (!kpisByCategory[k.category]) kpisByCategory[k.category] = [];
      kpisByCategory[k.category].push(k);
    }

    const catColors = [PRIMARY, ACCENT, SECONDARY, darkenHex(ACCENT, 0.2)];
    let yK = 1.4;
    Object.entries(kpisByCategory).slice(0, 4).forEach(([cat, kpis], ci) => {
      const cc = catColors[ci] || PRIMARY;
      kpi.addShape(pptx.ShapeType.rect, { x: 0.8, y: yK, w: 0.08, h: 0.3, fill: { color: cc } });
      kpi.addText(`${cat}:`, { x: 1.1, y: yK, w: 11.43, h: 0.3, fontSize: 11, color: cc, bold: true, fontFace: HF });
      yK += 0.4;
      kpis.slice(0, 3).forEach((k) => {
        kpi.addText(`${k.metric}: `, { x: 1.1, y: yK, w: 11.43, h: 0.25, fontSize: 9, color: TEXT_DARK, bold: true, fontFace: BF });
        kpi.addText(truncate(k.description, 130) + (k.target ? `  →  Meta: ${k.target}` : ""), { x: 1.1, y: yK + 0.25, w: 11.43, h: 0.25, fontSize: 8, color: TEXT_LIGHT, fontFace: BF });
        yK += 0.55;
      });
      yK += 0.12;
    });
    addFooter(kpi);


    // ╔══════════════════════════════════════════════════════════════╗
    // ║  TIMELINE                                                   ║
    // ╚══════════════════════════════════════════════════════════════╝
    const time = addSlide();
    time.background = { color: WHITE };
    addTitle(time, "Cronograma de Implementación");

    strategy.implementationTimeline.slice(0, 4).forEach((phase, i) => {
      const y = 1.4 + i * 1.4;
      const pc = [PRIMARY, ACCENT, SECONDARY, MEDIUM_GRAY][i] || PRIMARY;
      time.addShape(pptx.ShapeType.rect, { x: 0.8, y, w: 0.06, h: 1.2, fill: { color: pc } });
      time.addText(phase.phase, { x: 1.1, y, w: 8, h: 0.3, fontSize: 11, color: PRIMARY, bold: true, fontFace: HF });
      time.addShape(pptx.ShapeType.rect, { x: 10, y, w: 2.2, h: 0.3, fill: { color: pc }, rectRadius: 0.15 });
      time.addText(phase.weeks, { x: 10, y, w: 2.2, h: 0.3, fontSize: 8, color: WHITE, bold: true, fontFace: BF, align: "center", valign: "middle" });
      time.addText(phase.tasks.slice(0, 3).map((t) => `•  ${truncate(t, 100)}`).join("\n"), { x: 1.1, y: y + 0.38, w: 11, h: 0.85, fontSize: 9, color: TEXT_DARK, fontFace: BF, lineSpacingMultiple: 1.3 });
    });
    addFooter(time);


    // ╔══════════════════════════════════════════════════════════════╗
    // ║  CONCLUSIONS & RECOMMENDATIONS                              ║
    // ╚══════════════════════════════════════════════════════════════╝
    const fin = addSlide();
    fin.background = { color: WHITE };
    addTitle(fin, "Conclusiones y Recomendaciones");

    // Left: Conclusions
    fin.addShape(pptx.ShapeType.rect, { x: 0.8, y: 1.4, w: 5.7, h: 5.2, fill: { color: PRIMARY_LIGHT }, rectRadius: 0.08 });
    fin.addText("CONCLUSIONES", { x: 1, y: 1.5, w: 5.3, h: 0.35, fontSize: 10, color: PRIMARY, bold: true, fontFace: HF, charSpacing: 3 });
    fin.addShape(pptx.ShapeType.rect, { x: 1, y: 1.85, w: 1.5, h: 0.01, fill: { color: PRIMARY } });
    (strategy.conclusions || []).slice(0, 4).forEach((raw, i) => {
      const c = toStr(raw);
      const y = 2.1 + i * 1.05;
      fin.addShape(pptx.ShapeType.rect, { x: 1, y: y + 0.03, w: 0.08, h: 0.08, fill: { color: ACCENT } });
      fin.addText(truncate(c, 240), { x: 1.3, y, w: 4.9, h: 0.95, fontSize: 9, color: TEXT_DARK, fontFace: BF, lineSpacingMultiple: 1.3, valign: "top", wrap: true });
    });

    // Right: Recommendations
    fin.addShape(pptx.ShapeType.rect, { x: 6.8, y: 1.4, w: 5.73, h: 5.2, fill: { color: ACCENT_LIGHT }, rectRadius: 0.08 });
    fin.addText("RECOMENDACIONES", { x: 7, y: 1.5, w: 5.33, h: 0.35, fontSize: 10, color: ACCENT, bold: true, fontFace: HF, charSpacing: 3 });
    fin.addShape(pptx.ShapeType.rect, { x: 7, y: 1.85, w: 1.5, h: 0.01, fill: { color: ACCENT } });
    (strategy.recommendations || []).slice(0, 4).forEach((raw, i) => {
      const r = toStr(raw);
      const y = 2.1 + i * 1.05;
      fin.addShape(pptx.ShapeType.rect, { x: 7, y: y + 0.03, w: 0.08, h: 0.08, fill: { color: ACCENT } });
      fin.addText(truncate(r, 240), { x: 7.3, y, w: 4.9, h: 0.95, fontSize: 9, color: TEXT_DARK, fontFace: BF, lineSpacingMultiple: 1.3, valign: "top", wrap: true });
    });
    addFooter(fin);


    // ╔══════════════════════════════════════════════════════════════╗
    // ║  CLOSING                                                    ║
    // ╚══════════════════════════════════════════════════════════════╝
    const closing = addSlide();
    closing.background = { color: PRIMARY };
    closing.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: 7.5, fill: { color: ACCENT } });
    closing.addShape(pptx.ShapeType.rect, { x: 4.5, y: 2, w: 4.33, h: 0.02, fill: { color: ACCENT } });

    if (companyLogo) {
      try { closing.addImage({ data: companyLogo, x: 6.06, y: 2.3, w: 1.2, h: 1.2 }); } catch {}
    }

    closing.addText("Gracias", { x: 0, y: 3.7, w: 13.33, h: 1, fontSize: 48, color: WHITE, bold: true, fontFace: HF, align: "center" });
    closing.addText(strategy.companyName.toUpperCase(), { x: 0, y: 4.8, w: 13.33, h: 0.6, fontSize: 16, color: ACCENT, fontFace: HF, align: "center", charSpacing: 8 });
    closing.addShape(pptx.ShapeType.rect, { x: 4.5, y: 5.6, w: 4.33, h: 0.02, fill: { color: ACCENT } });
    closing.addText("Estrategia de Marketing", { x: 0, y: 5.9, w: 13.33, h: 0.4, fontSize: 12, color: lightenHex(PRIMARY, 0.5), fontFace: BF, align: "center" });
    closing.addText("Generado con StrategyGravity", { x: 0, y: 6.5, w: 13.33, h: 0.3, fontSize: 8, color: lightenHex(PRIMARY, 0.35), fontFace: BF, align: "center" });


    // ═══════════ SAVE ═══════════
    const outputDir = resolve(env.OUTPUT_DIR || "./output");
    if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

    const safeName = strategy.companyName.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_");
    const filename = `${safeName}_Estrategia_${new Date().toISOString().slice(0, 10)}.pptx`;
    const filePath = resolve(outputDir, filename);

    await pptx.writeFile({ fileName: filePath });

    return { success: true, data: { filePath, filename, slideCount } };
  } catch (err) {
    return { success: false, error: `Error generando PPTX: ${(err as Error).message}` };
  }
}
