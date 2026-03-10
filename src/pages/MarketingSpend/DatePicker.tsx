import { useEffect, useMemo, useRef, useState } from 'react';

export function toInputDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
};

export function DatePicker({ value, onChange, required, placeholder }: DatePickerProps) {
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
    ? selectedDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '';

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

  const daysInMonth = useMemo(
    () => new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate(),
    [currentMonth],
  );
  const firstDayOfMonth = useMemo(
    () => new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay(),
    [currentMonth],
  );
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);
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
    <div ref={containerRef} className="ms-date-picker">
      <div
        ref={inputRef}
        onClick={() => setIsOpen(!isOpen)}
        className="input ms-date-picker__display"
      >
        <span className={`ms-date-picker__text ${displayValue ? 'ms-date-picker__text--value' : ''}`}>
          {displayValue || placeholder || 'Select date'}
        </span>
        <span className="ms-date-picker__icon">📅</span>
      </div>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="ms-date-picker__native-input"
        tabIndex={-1}
      />
      {isOpen && (
        <div
          ref={popupRef}
          className="ms-date-picker__popup"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="ms-date-picker__header">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="ms-date-picker__nav-btn"
              aria-label="Previous month"
            >
              ‹
            </button>
            <div className="ms-date-picker__month">
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              className="ms-date-picker__nav-btn"
              aria-label="Next month"
            >
              ›
            </button>
          </div>
          <div className="ms-date-picker__weekday-row">
            {weekDays.map((day) => (
              <div key={day} className="ms-date-picker__weekday">
                {day}
              </div>
            ))}
          </div>
          <div className="ms-date-picker__days-grid">
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
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDateSelect(day)}
                  className={[
                    'ms-date-picker__day',
                    isSelected ? 'ms-date-picker__day--selected' : '',
                    isToday ? 'ms-date-picker__day--today' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {day}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={handleToday}
            className="ms-date-picker__today-btn"
          >
            Today
          </button>
        </div>
      )}
    </div>
  );
}

