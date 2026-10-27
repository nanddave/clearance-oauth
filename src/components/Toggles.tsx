import type { Toggle } from "@/lib/schema";

export function Toggles({ toggles, value, onChange }: { toggles: Toggle[]; value: Record<string, string>; onChange: (id: string, opt: string) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {toggles.map((t) => (
        <fieldset key={t.id}>
          <legend className="mb-1.5 text-sm font-medium text-zinc-900">{t.label}</legend>
          <div className="flex flex-wrap gap-2">
            {t.options.map((o) => (
              <label
                key={o.id}
                className="cursor-pointer rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 has-checked:border-zinc-900 has-checked:bg-zinc-900 has-checked:text-white has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-blue-600"
              >
                <input type="radio" name={`t.${t.id}`} value={o.id} checked={value[t.id] === o.id} onChange={() => onChange(t.id, o.id)} className="sr-only" />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
