import React from 'react';

export function StatusFilter<T extends string>({
    label,
    value,
    onChange,
    options,
    optionValues,
    selectClassName = '',
}: {
    label: string;
    value: T | '';
    onChange: (val: T | '') => void;
    options: readonly T[] | T[];
    optionValues?: string[];
    selectClassName?: string;
}) {
    const id = `followups-filter-${label.toLowerCase().replace(/\s+/g, '-')}`;
    return (
        <div className="fu-flt">
            <label className="fu-flt__lab" htmlFor={id}>
                {label}
            </label>
            <div className="fu-flt__box">
                <select
                    id={id}
                    className={`fu-flt__sel ${selectClassName}`.trim()}
                    value={value}
                    onChange={(e) => onChange(e.target.value as T | '')}
                >
                    <option value="">All</option>
                    {options.map((opt, index) => (
                        <option key={opt} value={optionValues ? optionValues[index] : opt}>
                            {opt}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}
