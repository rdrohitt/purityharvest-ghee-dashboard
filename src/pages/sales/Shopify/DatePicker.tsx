import { useEffect, useRef, useState } from 'react';
import { toInputDate } from './ShopifyShared';

export function DatePicker({
    value,
    onChange,
    required,
    placeholder,
    disabled,
}: {
    value: string;
    onChange: (value: string) => void;
    required?: boolean;
    placeholder?: string;
    disabled?: boolean;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(() => {
        const date = value ? new Date(value) : new Date();
        return new Date(date.getFullYear(), date.getMonth(), 1);
    });
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLDivElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);

    const selectedDate = value ? new Date(value) : null;
    const displayValue = selectedDate
        ? (() => {
              const day = String(selectedDate.getDate()).padStart(2, '0');
              const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
              const month = months[selectedDate.getMonth()];
              const year = selectedDate.getFullYear();
              return `${day}-${month}-${year}`;
          })()
        : '';

    useEffect(() => {
        if (disabled) {
            setIsOpen(false);
        }
    }, [disabled]);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen && !disabled) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen, disabled]);

    useEffect(() => {
        if (isOpen && inputRef.current && popupRef.current) {
            const inputRect = inputRef.current.getBoundingClientRect();
            const popup = popupRef.current;
            const popupHeight = 350;
            const popupWidth = 280;
            let top = inputRect.bottom + window.scrollY + 4;
            let left = inputRect.left + window.scrollX;
            if (inputRect.bottom + popupHeight > window.innerHeight) {
                top = inputRect.top + window.scrollY - popupHeight - 4;
            }
            if (inputRect.left + popupWidth > window.innerWidth) {
                left = window.innerWidth - popupWidth - 10;
            }
            popup.style.top = `${top}px`;
            popup.style.left = `${left}px`;
        }
    }, [isOpen]);

    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    function handleDateSelect(day: number) {
        if (disabled) return;
        const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        onChange(toInputDate(newDate));
        setIsOpen(false);
    }

    function handlePrevMonth() {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    }

    function handleNextMonth() {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    }

    function handleToday() {
        if (disabled) return;
        const today = new Date();
        onChange(toInputDate(today));
        setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
        setIsOpen(false);
    }

    return (
        <div ref={containerRef} className={`shopify-dp-root${disabled ? ' shopify-dp-root--disabled' : ''}`}>
            <div
                ref={inputRef}
                role="button"
                tabIndex={disabled ? -1 : 0}
                aria-disabled={disabled ? true : undefined}
                onClick={() => {
                    if (disabled) return;
                    setIsOpen(!isOpen);
                }}
                className={
                    'input shopify-dp-trigger shopify-dp-trigger--with-prefix' +
                    (disabled ? ' shopify-dp-trigger--disabled' : '')
                }
            >
                <span className="shopify-dp-trigger__prefix" aria-hidden>
                    <svg
                        className="shopify-add-modal-field-svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                </span>
                <span
                    className={
                        displayValue ? 'shopify-dp-trigger-value--text' : 'shopify-dp-trigger-value--muted'
                    }
                >
                    {displayValue || placeholder || 'Select date'}
                </span>
            </div>
            <input
                type="date"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                required={required}
                disabled={disabled}
                className="shopify-dp-native"
                tabIndex={-1}
            />
            {isOpen && !disabled && (
                <div ref={popupRef} className="shopify-dp-popup" onClick={(e) => e.stopPropagation()}>
                    <div className="shopify-dp-popup-header">
                        <button type="button" className="shopify-dp-month-nav-btn" onClick={handlePrevMonth} aria-label="Previous month">‹</button>
                        <div className="shopify-dp-month-title">
                            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </div>
                        <button type="button" className="shopify-dp-month-nav-btn" onClick={handleNextMonth} aria-label="Next month">›</button>
                    </div>
                    <div className="shopify-dp-weekdays">
                        {weekDays.map((day) => (
                            <div key={day} className="shopify-dp-weekday">{day}</div>
                        ))}
                    </div>
                    <div className="shopify-dp-days">
                        {Array(firstDayOfMonth).fill(null).map((_, i) => (
                            <div key={`empty-${i}`} />
                        ))}
                        {days.map((day) => {
                            const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                            const isSelected =
                                selectedDate &&
                                date.getDate() === selectedDate.getDate() &&
                                date.getMonth() === selectedDate.getMonth() &&
                                date.getFullYear() === selectedDate.getFullYear();
                            const isToday = date.toDateString() === new Date().toDateString();
                            return (
                                <button
                                    key={day}
                                    type="button"
                                    onClick={() => handleDateSelect(day)}
                                    className={`shopify-dp-day${isSelected ? ' shopify-dp-day--selected' : ''}${isToday && !isSelected ? ' shopify-dp-day--today' : ''}`}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>
                    <button type="button" className="shopify-dp-today-btn" onClick={handleToday}>
                        Today
                    </button>
                </div>
            )}
        </div>
    );
}
