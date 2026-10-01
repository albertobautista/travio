import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { CATEGORIES, type ActivityCategory } from "@/lib/activities/categories";

/**
 * Ideas for a free gap in the day, from Claude. Travio's only AI call, kept
 * behind this boundary: the rest of the app sees plain types.
 *
 * What's sent is only what the idea needs (city, times, places, weather):
 * no traveler names, documents, booking references or notes about people.
 */

export const AI_MODEL = "claude-sonnet-5-5";

export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);

/** Categories an idea may have (a transfer isn't something to do). */
const IDEA_CATEGORIES = CATEGORIES.filter((c) => c !== "transfer");

export type GapContext = {
  city: string;
  country?: string;
  date: string;
  /** "Jueves 1 de octubre". */
  dayLabel: string;
  gapStart: string; // "HH:MM" local
  gapEnd: string;
  gapMinutes: number;
  from: { label: string; lat: number; lng: number } | null;
  next: { label: string; lat: number; lng: number } | null;
  hotel: string | null;
  weather: string | null;
  travelers: number;
  /** Saved places in this city not planned yet, with straight-line km from where you start. */
  saved: { id: string; name: string; category: string; notes: string | null; km: number | null; minutes: number | null }[];
  /** Everything already in the itinerary in this city, to avoid repeats. */
  planned: string[];
};

export type RawIdea = {
  title: string;
  place_name: string;
  search_query: string;
  saved_place_id: string | null;
  category: ActivityCategory;
  duration_minutes: number;
  reason: string;
};

const SYSTEM = `Eres el asistente de Travio, una app para organizar viajes. Propones qué hacer en un hueco libre del día de un viajero.

Reglas:
- Propón hasta 3 ideas distintas entre sí (no tres museos).
- Cada idea debe caber en el hueco contando la ida desde el punto de partida, el tiempo allí y la vuelta hacia la siguiente actividad. Si el hueco es corto, ideas cercanas y breves.
- Prioriza los lugares guardados por el viajero cuando encajen; en ese caso pon su saved_place_id tal cual.
- No propongas lo que ya está en el itinerario.
- Solo lugares reales y concretos que se puedan buscar en Google Maps (nada de "un café por la zona"). En search_query pon nombre y ciudad.
- Ten en cuenta la hora (¿estará abierto?, ¿es hora de comer?) y el clima (con lluvia, mejor bajo techo). Si no estás seguro del horario, dilo en reason.
- No inventes precios ni datos que no sabes.
- reason: una frase en español, cercana y concreta, de 160 caracteres como máximo, que explique por qué encaja ahora.`;

const TOOL: Anthropic.Tool = {
  name: "proponer_ideas",
  description: "Devuelve las ideas para el hueco libre.",
  input_schema: {
    type: "object",
    properties: {
      ideas: {
        type: "array",
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "Título corto para el itinerario, p. ej. 'Atardecer en los Bunkers del Carmel'." },
            place_name: { type: "string", description: "Nombre exacto del lugar." },
            search_query: { type: "string", description: "Búsqueda para Google Maps: nombre y ciudad." },
            saved_place_id: { type: ["string", "null"], description: "id del lugar guardado, o null si no es uno guardado." },
            category: { type: "string", enum: IDEA_CATEGORIES },
            duration_minutes: { type: "integer", description: "Tiempo allí, sin traslados." },
            reason: { type: "string" },
          },
          required: ["title", "place_name", "search_query", "saved_place_id", "category", "duration_minutes", "reason"],
        },
      },
    },
    required: ["ideas"],
  },
};

/** Asks Claude; returns the ideas as it sent them (validate before use). */
export async function askGapIdeas(context: GapContext): Promise<RawIdea[]> {
  const client = new Anthropic({ timeout: 45_000, maxRetries: 1 });
  const message = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 1500,
    system: SYSTEM,
    tools: [TOOL],
    // Forced tool: the answer always comes as structured input, never free text.
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [
      {
        role: "user",
        content: `Contexto del hueco (JSON):\n${JSON.stringify(context, null, 2)}`,
      },
    ],
  });
  const use = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  const ideas = (use?.input as { ideas?: unknown } | undefined)?.ideas;
  return Array.isArray(ideas) ? (ideas as RawIdea[]) : [];
}

/**
 * Keeps only well-formed ideas: known category, a saved place that really is
 * one of the offered ones, a sensible duration, trimmed text.
 */
export function cleanIdeas(raw: RawIdea[], savedIds: Set<string>, gapMinutes: number) {
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  return raw
    .map((r) => ({
      title: text(r.title, 120),
      placeName: text(r.place_name, 160),
      searchQuery: text(r.search_query, 200),
      savedPlaceId: typeof r.saved_place_id === "string" && savedIds.has(r.saved_place_id) ? r.saved_place_id : null,
      category: (IDEA_CATEGORIES as readonly string[]).includes(r.category) ? r.category : ("other" as ActivityCategory),
      durationMinutes: Math.min(Math.max(15, Math.round(Number(r.duration_minutes) || 60)), Math.max(15, gapMinutes)),
      reason: text(r.reason, 200),
    }))
    .filter((i) => i.title && (i.placeName || i.savedPlaceId))
    .slice(0, 3);
}
