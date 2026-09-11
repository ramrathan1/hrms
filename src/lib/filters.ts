/* Shared list-filter state.
   Every list page renders the same "All / value" dropdowns above its table;
   this keeps the selection and applies the matchers so the table actually
   narrows. The first option is always the pass-through ("All"). */
import { useState } from "react";

export type FilterSpec<T> = {
  label: string;
  options: string[];
  match: (row: T, value: string) => boolean;
};

export type FilterControl = {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
};

export function useFilters<T>(specs: FilterSpec<T>[]) {
  const [values, setValues] = useState<string[]>(() => specs.map((s) => s.options[0] ?? "All"));

  const controls: FilterControl[] = specs.map((s, i) => ({
    label: s.label,
    value: values[i] ?? s.options[0] ?? "All",
    options: s.options,
    onChange: (v) => setValues((xs) => xs.map((x, j) => (j === i ? v : x))),
  }));

  const apply = (rows: T[]) =>
    rows.filter((row) =>
      specs.every((s, i) => {
        const v = values[i];
        return v === undefined || v === (s.options[0] ?? "All") || s.match(row, v);
      })
    );

  const active = specs.filter((s, i) => values[i] !== (s.options[0] ?? "All")).length;
  const reset = () => setValues(specs.map((s) => s.options[0] ?? "All"));

  return { controls, apply, active, reset, values };
}
