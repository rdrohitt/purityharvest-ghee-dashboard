import React from "react";
import {
  ModernSelect,
  type ModernSelectOption,
} from "../sales/Shopify/ShopifyShared";

export function StatusFilter<T extends string>({
  label,
  value,
  onChange,
  options,
  optionValues,
  selectClassName = "",
}: {
  label: string;
  value: T | "";
  onChange: (val: T | "") => void;
  options: readonly T[] | T[];
  optionValues?: string[];
  selectClassName?: string;
}) {
  const modernOptions: ModernSelectOption<T>[] = options.map((opt, index) => ({
    value: (optionValues ? (optionValues[index] as T) : opt) as T,
    label: String(opt),
  }));

  return (
    <div className="fu-flt">
      <span className="fu-flt__lab">{label}</span>
      <ModernSelect<T>
        className={`fu-followups-modern-select fu-flt__modern-select ${selectClassName}`.trim()}
        variant="default"
        value={value}
        onChange={onChange}
        options={modernOptions}
        placeholder="All"
        aria-label={label}
      />
    </div>
  );
}
