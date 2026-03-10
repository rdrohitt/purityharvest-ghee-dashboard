import { useEffect, useRef, useState } from 'react';
import { toInputDate } from './ShopifyShared';

export function DatePicker({
    value,
    onChange,
    required,
    placeholder,
}: {
    value: string;
    onChange: (value: string) => void;
    required?: boolean;
    placeholder?: string;
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
    const displayValue = selectedDate ? selectedDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

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
        const today = new Date();
        onChange(toInputDate(today));
        setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
        setIsOpen(false);
    }

    return (
        <div ref={containerRef} className="shopify-dp-root">
            <div
                ref={inputRef}
                onClick={() => setIsOpen(!isOpen)}
                className="input shopify-dp-trigger"
            >
                <span className={displayValue ? 'shopify-dp-trigger-value--text' : 'shopify-dp-trigger-value--muted'}>
                    {displayValue || placeholder || 'Select date'}
                </span>
                <span className="shopify-dp-trigger-icon">📅</span>
            </div>
            <input
                type="date"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                required={required}
                className="shopify-dp-native"
                tabIndex={-1}
            />
            {isOpen && (
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
