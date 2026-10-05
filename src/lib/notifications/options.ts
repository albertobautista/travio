/** How often to email about changes other people make (notification_preferences.changes). */
export type ChangesFrequency = "hourly" | "daily" | "off";

export const CHANGES_OPTIONS: { value: ChangesFrequency; label: string; hint: string }[] = [
  { value: "daily", label: "Un resumen al día", hint: "Un solo correo con todo lo que cambió." },
  { value: "hourly", label: "Cada hora", hint: "Agrupados: como mucho un correo por hora." },
  { value: "off", label: "No avisarme", hint: "Los cambios se ven en la app." },
];

export function isChangesFrequency(value: unknown): value is ChangesFrequency {
  return value === "hourly" || value === "daily" || value === "off";
}
