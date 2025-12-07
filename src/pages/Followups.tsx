import React, { useMemo, useState } from 'react';
import { generateMockFollowups, type Followup } from '../utils/followups';

function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toInputDate(dateStr: string | null): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function formatDateWithMonth(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const FEEDBACK_OPTIONS = ['Excellent ghee', 'smell issue', 'high price'];
const CALLER_OPTIONS = ['Monia', 'Sarita'];

export default function Followups() {
    const [callerFilter, setCallerFilter] = useState<string>('');
    const [feedbackFilter, setFeedbackFilter] = useState<string>('');
    const [callingDateFilter, setCallingDateFilter] = useState<string>('');
    const [upcomingFilter, setUpcomingFilter] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [followups, setFollowups] = useState<Followup[]>(() => generateMockFollowups(100));

    const baseFollowups = followups;

    const filtered = useMemo(() => {
        const now = new Date();
        return baseFollowups.filter(f => {
            // Search filter (by name and mobile number)
            const matchesSearch = !searchQuery || 
                f.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                f.customerPhone.includes(searchQuery);
            
            const matchesCaller = !callerFilter || f.callerName === callerFilter;
            const matchesFeedback = !feedbackFilter || f.feedback === feedbackFilter;
            
            // Calling date filter
            let matchesCallingDate = true;
            if (callingDateFilter) {
                if (callingDateFilter === 'no-calling-date') {
                    matchesCallingDate = !f.callingDate;
                } else {
                    if (!f.callingDate) {
                        matchesCallingDate = false;
                    } else {
                        const callingDate = new Date(f.callingDate);
                        const daysDiff = Math.floor((now.getTime() - callingDate.getTime()) / (1000 * 60 * 60 * 24));
                        const threshold = parseInt(callingDateFilter.replace('more-than-', '').replace('-days', ''));
                        matchesCallingDate = daysDiff > threshold;
                    }
                }
            }
            
            // Upcoming followups filter (based on call again date)
            let matchesUpcoming = true;
            if (upcomingFilter) {
                if (!f.callAgainDate) {
                    matchesUpcoming = false;
                } else {
                    const callAgainDate = new Date(f.callAgainDate);
                    const today = new Date(now);
                    today.setHours(0, 0, 0, 0);
                    callAgainDate.setHours(0, 0, 0, 0);
                    
                    const daysFromNow = Math.floor((callAgainDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    
                    if (upcomingFilter === 'today') {
                        matchesUpcoming = daysFromNow === 0;
                    } else if (upcomingFilter === 'next-2-days') {
                        matchesUpcoming = daysFromNow >= 0 && daysFromNow <= 2;
                    } else if (upcomingFilter === 'next-7-days') {
                        matchesUpcoming = daysFromNow >= 0 && daysFromNow <= 7;
                    } else if (upcomingFilter === 'next-15-days') {
                        matchesUpcoming = daysFromNow >= 0 && daysFromNow <= 15;
                    }
                }
            }
            
            return matchesSearch && matchesCaller && matchesFeedback && matchesCallingDate && matchesUpcoming;
        });
    }, [baseFollowups, searchQuery, callerFilter, feedbackFilter, callingDateFilter, upcomingFilter]);

    function updateFollowup(id: string, field: keyof Followup, value: string | null) {
        setFollowups(prev => prev.map(f => {
            if (f.id === id) {
                return { ...f, [field]: value };
            }
            return f;
        }));
    }

    return (
        <section style={{ display: 'grid', gap: 12, width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
            <div className="card" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', position: 'relative' }}>
                <div style={{ fontWeight: 800 }}>Followups</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <label className="label" style={{ fontSize: 11, margin: 0, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Search</label>
                                <input
                                    className="input"
                                    type="text"
                                    placeholder="Search by name or mobile"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{ width: 240, height: 32, fontSize: 13, padding: '4px 12px' }}
                                />
                            </div>
                            <StatusFilter
                                label="Caller"
                                value={callerFilter}
                                onChange={setCallerFilter}
                                options={CALLER_OPTIONS}
                            />
                            <StatusFilter
                                label="Feedback"
                                value={feedbackFilter}
                                onChange={setFeedbackFilter}
                                options={FEEDBACK_OPTIONS}
                            />
                            {(searchQuery || callerFilter || feedbackFilter || callingDateFilter || upcomingFilter) ? (
                                <button 
                                    className="filter-btn" 
                                    onClick={() => { setSearchQuery(''); setCallerFilter(''); setFeedbackFilter(''); setCallingDateFilter(''); setUpcomingFilter(''); }}
                                    style={{ fontSize: 12, padding: '6px 16px', height: 32, marginBottom: 0 }}
                                >
                                    Clear All
                                </button>
                            ) : null}
                        </div>
                        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <label className="label" style={{ fontSize: 11, margin: 0, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Calling Date</label>
                                <div className="filter-group" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    <CallingDateFilterButton 
                                        active={callingDateFilter === 'no-calling-date'} 
                                        onClick={() => setCallingDateFilter(callingDateFilter === 'no-calling-date' ? '' : 'no-calling-date')}
                                    >
                                        No Calling Date
                                    </CallingDateFilterButton>
                                    <CallingDateFilterButton 
                                        active={callingDateFilter === 'more-than-15-days'} 
                                        onClick={() => setCallingDateFilter(callingDateFilter === 'more-than-15-days' ? '' : 'more-than-15-days')}
                                    >
                                        &gt; 15 days
                                    </CallingDateFilterButton>
                                    <CallingDateFilterButton 
                                        active={callingDateFilter === 'more-than-30-days'} 
                                        onClick={() => setCallingDateFilter(callingDateFilter === 'more-than-30-days' ? '' : 'more-than-30-days')}
                                    >
                                        &gt; 30 days
                                    </CallingDateFilterButton>
                                    <CallingDateFilterButton 
                                        active={callingDateFilter === 'more-than-45-days'} 
                                        onClick={() => setCallingDateFilter(callingDateFilter === 'more-than-45-days' ? '' : 'more-than-45-days')}
                                    >
                                        &gt; 45 days
                                    </CallingDateFilterButton>
                                    <CallingDateFilterButton 
                                        active={callingDateFilter === 'more-than-60-days'} 
                                        onClick={() => setCallingDateFilter(callingDateFilter === 'more-than-60-days' ? '' : 'more-than-60-days')}
                                    >
                                        &gt; 60 days
                                    </CallingDateFilterButton>
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <label className="label" style={{ fontSize: 11, margin: 0, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Upcoming Followups</label>
                                <div className="filter-group" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    <CallingDateFilterButton 
                                        active={upcomingFilter === 'today'} 
                                        onClick={() => setUpcomingFilter(upcomingFilter === 'today' ? '' : 'today')}
                                    >
                                        Today
                                    </CallingDateFilterButton>
                                    <CallingDateFilterButton 
                                        active={upcomingFilter === 'next-2-days'} 
                                        onClick={() => setUpcomingFilter(upcomingFilter === 'next-2-days' ? '' : 'next-2-days')}
                                    >
                                        Next 2 days
                                    </CallingDateFilterButton>
                                    <CallingDateFilterButton 
                                        active={upcomingFilter === 'next-7-days'} 
                                        onClick={() => setUpcomingFilter(upcomingFilter === 'next-7-days' ? '' : 'next-7-days')}
                                    >
                                        Next 7 days
                                    </CallingDateFilterButton>
                                    <CallingDateFilterButton 
                                        active={upcomingFilter === 'next-15-days'} 
                                        onClick={() => setUpcomingFilter(upcomingFilter === 'next-15-days' ? '' : 'next-15-days')}
                                    >
                                        Next 15 days
                                    </CallingDateFilterButton>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div style={{ width: '100%', color: 'var(--muted)', fontSize: 14 }}>
                        Showing {filtered.length} followups
                    </div>
                </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-scroll-wrapper">
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1400, tableLayout: 'auto' }}>
                        <colgroup>
                            <col style={{ width: '200px', minWidth: '200px' }} />
                            <col style={{ width: '140px', minWidth: '140px' }} />
                            <col style={{ width: '100px', minWidth: '100px' }} />
                            <col style={{ width: '180px', minWidth: '180px' }} />
                            <col style={{ width: 'auto', minWidth: '140px' }} />
                            <col style={{ width: '180px', minWidth: '180px' }} />
                            <col style={{ width: '140px', minWidth: '140px' }} />
                            <col style={{ width: '200px', minWidth: '200px' }} />
                            <col style={{ width: '180px', minWidth: '180px' }} />
                        </colgroup>
                        <thead>
                            <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                                <Th>Customer</Th>
                                <Th>Last Order</Th>
                                <Th>Total Orders</Th>
                                <Th>Last Order Detail</Th>
                                <Th>Feedback</Th>
                                <Th>Calling Date</Th>
                                <Th>Caller Name</Th>
                                <Th>Calling Detail</Th>
                                <Th>Call Again Date</Th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((f) => (
                                <tr key={f.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <Td>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontWeight: 600 }}>{f.customerName}</span>
                                            <a className="link" href={`tel:${f.customerPhone}`} style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none' }}>
                                                {f.customerPhone}
                                            </a>
                                        </div>
                                    </Td>
                                    <Td>{formatDate(f.lastOrder)}</Td>
                                    <Td>{f.totalOrders}</Td>
                                    <Td>{f.lastOrderDetail}</Td>
                                    <Td>
                                        <select
                                            className="input"
                                            value={f.feedback}
                                            onChange={(e) => updateFollowup(f.id, 'feedback', e.target.value)}
                                            style={{ width: 'auto', minWidth: '140px', height: 32, fontSize: 13, padding: '4px 8px' }}
                                        >
                                            <option value="">Select feedback</option>
                                            {FEEDBACK_OPTIONS.map((opt) => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    </Td>
                                    <Td>
                                        <DateInput
                                            value={f.callingDate}
                                            onChange={(value) => updateFollowup(f.id, 'callingDate', value)}
                                        />
                                    </Td>
                                    <Td>
                                        <select
                                            className="input"
                                            value={f.callerName}
                                            onChange={(e) => updateFollowup(f.id, 'callerName', e.target.value)}
                                            style={{ width: '100%', height: 32, fontSize: 13, padding: '4px 8px' }}
                                        >
                                            <option value="">Select caller</option>
                                            {CALLER_OPTIONS.map((opt) => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    </Td>
                                    <Td>
                                        <textarea
                                            className="input"
                                            value={f.callingDetail}
                                            onChange={(e) => updateFollowup(f.id, 'callingDetail', e.target.value)}
                                            placeholder="Enter calling detail"
                                            style={{ width: '100%', height: 60, fontSize: 13, padding: '4px 8px', resize: 'vertical', fontFamily: 'inherit' }}
                                        />
                                    </Td>
                                    <Td>
                                        <DateInput
                                            value={f.callAgainDate}
                                            onChange={(value) => updateFollowup(f.id, 'callAgainDate', value)}
                                        />
                                    </Td>
                                </tr>
                            ))}
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                                        No followups found
                                    </td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}

function Th({ children }: { children: string }) {
    return <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>{children}</th>;
}

function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return <td style={{ padding: '12px', ...style }}>{children}</td>;
}

function StatusFilter<T extends string>({ label, value, onChange, options }: { label: string; value: T | ''; onChange: (val: T | '') => void; options: T[] }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label className="label" style={{ fontSize: 11, margin: 0, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</label>
            <select
                className="input"
                value={value}
                onChange={(e) => onChange(e.target.value as T | '')}
                style={{ height: 32, minWidth: 120, cursor: 'pointer', fontSize: 13 }}
            >
                <option value="">All</option>
                {options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                ))}
            </select>
        </div>
    );
}

function CallingDateFilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className={`filter-btn ${active ? 'active' : ''}`}
            style={{ fontSize: 12, padding: '6px 12px', height: 32 }}
        >
            {children}
        </button>
    );
}

function DateInput({ value, onChange }: { value: string | null; onChange: (value: string | null) => void }) {
    const dateInputRef = React.useRef<HTMLInputElement>(null);
    const displayValue = formatDateWithMonth(value);

    function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
        const newValue = e.target.value ? new Date(e.target.value).toISOString() : null;
        onChange(newValue);
    }

    return (
        <div style={{ position: 'relative', width: '100%' }}>
            <input
                ref={dateInputRef}
                type="date"
                value={toInputDate(value)}
                onChange={handleDateChange}
                style={{
                    position: 'absolute',
                    opacity: 0,
                    width: '100%',
                    height: '32px',
                    cursor: 'pointer',
                    zIndex: 2,
                    top: 0,
                    left: 0,
                }}
            />
            <div
                className="input"
                style={{
                    width: '100%',
                    height: 32,
                    fontSize: 13,
                    padding: '4px 8px',
                    paddingRight: '32px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    position: 'relative',
                    zIndex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    pointerEvents: 'none',
                }}
            >
                <span>{displayValue}</span>
                <span
                    style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: '14px',
                        color: 'var(--muted)',
                        pointerEvents: 'none',
                    }}
                >
                    📅
                </span>
            </div>
        </div>
    );
}

