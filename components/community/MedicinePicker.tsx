"use client";
import { useState } from "react";
import commonMeds from "@/data/common_meds.json";
import { useLang } from "@/components/LanguageContext";
import { Select } from "@/components/ui/TextField";
import { MedSearch } from "@/components/meds/MedSearch";
import type { Med } from "@/lib/types";
const OPTIONS = (commonMeds as Med[])
  .filter((m, i, a) => a.findIndex((x) => x.rxcui === m.rxcui) === i)
  .sort((a, b) => a.name.localeCompare(b.name));
export function MedicinePicker({
  value,
  onChange,
  label,
}: {
  value: Med | null;
  onChange: (m: Med) => void;
  label: string;
}) {
  const { lang } = useLang();
  const es = lang === "es";
  const [other, setOther] = useState(false);
  const custom = value && !OPTIONS.some((m) => m.rxcui === value.rxcui);
  return (
    <div className="w-full max-w-sm space-y-2">
      <Select
        label={label}
        value={other ? "__other__" : value?.rxcui || ""}
        onChange={(e) => {
          if (e.target.value === "__other__") {
            setOther(true);
            return;
          }
          const m = OPTIONS.find((x) => x.rxcui === e.target.value) ?? (value?.rxcui === e.target.value ? value : null);
          if (m) {
            setOther(false);
            onChange(m);
          }
        }}
      >
        <option value="" disabled>
          {es ? "Elija un medicamento" : "Choose a medicine"}
        </option>
        {OPTIONS.map((m) => (
          <option key={m.rxcui} value={m.rxcui}>
            {m.name}
          </option>
        ))}
        {custom && <option value={value.rxcui}>{value.name}</option>}
        <option value="__other__">{es ? "Otro — escriba un medicamento" : "Other — type a medicine"}</option>
      </Select>
      {other && (
        <MedSearch
          meds={[]}
          max={1}
          onAdd={(m) => {
            onChange(m);
            setOther(false);
          }}
        />
      )}
    </div>
  );
}
