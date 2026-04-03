import React, { useEffect, useRef, useState } from 'react';
import { toInputDate } from './followupsFormat';

type DateInputProps = {
    value: string | null;
    onChange: (value: string | null) => void;
    minDate?: string | null;
};

export function DateInput({ value, onChange, minDate = null }: DateInputProps) {
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
        ? selectedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : '—';

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
            const popupWidth = 300;

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
    const normalizedMinDate = (() => {
        if (!minDate) return null;
        const d = new Date(minDate);
        d.setHours(0, 0, 0, 0);
        return d;
    })();

    function handleDateSelect(day: number) {
        const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        if (normalizedMinDate && newDate < normalizedMinDate) return;
        onChange(newDate.toISOString());
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
        onChange(today.toISOString());
        setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
        setIsOpen(false);
    }

    function handleClear() {
        onChange(null);
        setIsOpen(false);
    }

    return (
        <div ref={containerRef} className="fu-date-input">
            <div
                ref={inputRef}
                onClick={() => setIsOpen(!isOpen)}
                className="input fu-date-input__trigger"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setIsOpen(!isOpen);
                    }
                }}
            >
                <span
                    className={
                        displayValue && displayValue !== '—'
                            ? 'fu-date-input__val'
                            : 'fu-date-input__val fu-date-input__val--placeholder'
                    }
                >
                    {displayValue}
                </span>
                <span className="fu-date-input__icon" aria-hidden>
                    📅
                </span>
            </div>
            <input
                type="date"
                className="fu-date-input__native"
                value={toInputDate(value)}
                onChange={(e) => {
                    const newValue = e.target.value ? new Date(e.target.value).toISOString() : null;
                    onChange(newValue);
                }}
                tabIndex={-1}
                aria-hidden={true}
            />
            {isOpen && (
                <div ref={popupRef} className="fu-date-popup" onClick={(e) => e.stopPropagation()}>
                    <div className="fu-date-popup__header">
                        <button type="button" className="fu-date-popup__nav-btn" onClick={handlePrevMonth} aria-label="Previous month">
                            ‹
                        </button>
                        <div className="fu-date-popup__title">
                            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </div>
                        <button type="button" className="fu-date-popup__nav-btn" onClick={handleNextMonth} aria-label="Next month">
                            ›
                        </button>
                    </div>
                    <div className="fu-date-popup__weekdays">
                        {weekDays.map((day) => (
                            <div key={day} className="fu-date-popup__weekday">
                                {day}
                            </div>
                        ))}
                    </div>
                    <div className="fu-date-popup__grid">
                        {Array(firstDayOfMonth)
                            .fill(null)
                            .map((_, i) => (
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
                            const isDisabled = normalizedMinDate ? date < normalizedMinDate : false;
                            return (
                                <button
                                    key={day}
                                    type="button"
                                    className={`fu-date-popup__day${isSelected ? ' fu-date-popup__day--selected' : ''}${isToday && !isSelected ? ' fu-date-popup__day--today' : ''}${isDisabled ? ' fu-date-popup__day--disabled' : ''}`}
                                    onClick={() => handleDateSelect(day)}
                                    disabled={isDisabled}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>
                    <div className="fu-date-popup__actions">
                        <button type="button" className="fu-date-popup__action" onClick={handleToday}>
                            Today
                        </button>
                        <button type="button" className="fu-date-popup__action" onClick={handleClear}>
                            Clear
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
