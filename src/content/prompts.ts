import type { MarketingStrategy, ContentType } from "../types/index.js";

export function getContentSystemPrompt(strategy: MarketingStrategy): string {
  return `Eres el equipo de marketing de "${strategy.companyName}". Generas contenido profesional basado estrictamente en la estrategia de marketing guardada.

IDENTIDAD DE MARCA:
- Empresa: ${strategy.companyName}
- Personalidad: ${strategy.brandDesign.personality}
- Valores: ${strategy.brandDesign.values.join(", ")}
- Tono: ${strategy.contentStrategy.tone}
- Colores: ${strategy.brandDesign.identity.colors.primary}, ${strategy.brandDesign.identity.colors.secondary}, ${strategy.brandDesign.identity.colors.accent}

PILARES DE CONTENIDO:
${strategy.contentPillars.map(p => `- ${p.name} (${p.percentage}%): ${p.description}`).join("\n")}

PUBLICO OBJETIVO:
${strategy.contentStrategy.targetAudience.join("\n")}

CANALES: ${strategy.contentStrategy.channels.join(", ")}

KEYWORDS ESTRATEGICAS:
${strategy.keywordGroups.flatMap(g => g.keywords.slice(0, 3).map(k => k.term)).join(", ")}

SERVICIOS:
${strategy.services.map(s => `- ${s.name}: ${s.description}`).join("\n")}

Reglas:
1. Todo contenido debe alinearse con los pilares y el tono de marca
2. Incluir keywords estrategicas de forma natural
3. Adaptar longitud y formato al canal/plataforma
4. Ser creativo pero siempre on-brand
5. Responder siempre en espanol`;
}

export function getContentPrompt(type: ContentType, topic: string, strategy: MarketingStrategy): string {
  const pillarNames = strategy.contentPillars.map(p => p.name).join(", ");

  switch (type) {
    case "blog":
      return `Escribe un articulo de blog SEO-optimizado sobre: "${topic}"

Formato:
- Titulo atractivo con keyword principal
- Introduccion (2-3 parrafos)
- 3-5 secciones con subtitulos H2
- Conclusion con CTA
- Meta description sugerida
- Keywords usadas

Pilares disponibles: ${pillarNames}
Longitud: 800-1200 palabras`;

    case "linkedin_post":
      return `Crea un post profesional de LinkedIn sobre: "${topic}"

Formato:
- Hook potente en la primera linea
- 3-5 parrafos cortos
- Datos o insights relevantes
- CTA al final
- 3-5 hashtags relevantes

Tono: profesional, experto, accesible
Longitud: 150-300 palabras`;

    case "instagram_post":
      return `Crea un post de Instagram sobre: "${topic}"

Incluye:
- Caption atractivo con emojis estrategicos
- Hook en la primera linea
- Storytelling o dato relevante
- CTA claro
- 15-20 hashtags organizados
- Sugerencia de visual/imagen

Longitud: 100-200 palabras`;

    case "reel_script":
      return `Crea un guion de Reel/TikTok sobre: "${topic}"

Formato:
- Hook (0-3 seg): frase que detiene el scroll
- Desarrollo (3-20 seg): 3-5 puntos clave
- CTA (20-30 seg): llamada a la accion
- Texto en pantalla sugerido
- Audio/musica sugerida
- Hashtags

Incluir keywords SEO en el texto`;

    case "visual_prompt":
      return `Crea un prompt visual detallado para generar una imagen de marketing sobre: "${topic}"

Incluye:
- Descripcion detallada de la imagen
- Estilo visual (fotografia, ilustracion, etc)
- Colores de marca a usar: ${strategy.brandDesign.identity.colors.primary}, ${strategy.brandDesign.identity.colors.secondary}
- Mood/atmosfera
- Texto overlay sugerido
- Formato recomendado (cuadrado, vertical, horizontal)`;

    case "tweet":
      return `Crea 3 tweets sobre: "${topic}"

Cada tweet:
- Maximo 280 caracteres
- Con hook
- Con CTA o pregunta
- 1-3 hashtags

Incluir un tweet con dato/estadistica`;

    default:
      return `Genera contenido de marketing sobre: "${topic}" para ${type}. Alineado con la estrategia de marca.`;
  }
}
