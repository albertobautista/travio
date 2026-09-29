import { selectClass } from "@/components/form-field";
import { TARGET_GROUPS, type AttachTarget } from "@/lib/files/targets";

type Props = {
  id: string;
  label: string;
  targets: AttachTarget[];
  /** "kind:id", or "" for a trip-level document. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

/** Picker for what a document is attached to, grouped by kind. */
export function TargetSelect({ id, label, targets, value, onChange, disabled }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={selectClass}>
        <option value="">Nada: documento del viaje</option>
        {TARGET_GROUPS.map((group) => {
          const options = targets.filter((t) => t.kind === group.kind);
          return options.length === 0 ? null : (
            <optgroup key={group.kind} label={group.label}>
              {options.map((t) => (
                <option key={t.id} value={`${t.kind}:${t.id}`}>
                  {t.label}
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>
    </div>
  );
}
