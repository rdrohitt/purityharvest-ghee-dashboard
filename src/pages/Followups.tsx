import React, { useMemo, useState, useEffect, useRef } from 'react';
import { type Followup, loadFollowupsData, updateFollowupData, type FollowupData } from '../utils/followups';
import { loadOrders, type Order, type OrderItem } from '../utils/orders';

type Toast = {
    id: string;
    message: string;
    type: 'success' | 'error' | 'delete';
};

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

function getCustomerType(totalOrders: number): string {
    if (totalOrders === 1) return 'new';
    if (totalOrders >= 2 && totalOrders <= 4) return 'repeat';
    if (totalOrders >= 5) return 'loyal';
    return 'new';
}

function formatCurrency(n: number): string { 
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n); 
}

const FEEDBACK_OPTIONS = ['Excellent ghee', 'smell issue', 'high price'];
const CALLER_OPTIONS = ['Monia', 'Sarita'];

export default function Followups() {
    const [callerFilter, setCallerFilter] = useState<string>('');
    const [feedbackFilter, setFeedbackFilter] = useState<string>('');
    const [monthFilter, setMonthFilter] = useState<string>('');
    const [yearFilter, setYearFilter] = useState<string>('');
    const [callingDateFilter, setCallingDateFilter] = useState<string>('');
    const [upcomingFilter, setUpcomingFilter] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [followups, setFollowups] = useState<Followup[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [ordersByCustomer, setOrdersByCustomer] = useState<Map<string, Order[]>>(new Map());
    const [showCustomerProfile, setShowCustomerProfile] = useState(false);
    const [selectedCustomerPhone, setSelectedCustomerPhone] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    
    // Toast notifications
    const [toasts, setToasts] = useState<Toast[]>([]);
    function showToast(message: string, type: 'success' | 'error' | 'delete' = 'success') {
        const id = `toast-${Date.now()}-${Math.random()}`;
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3000);
    }

    useEffect(() => {
        async function loadData() {
            try {
                setLoading(true);
                const [orders, followupsData] = await Promise.all([
                    loadOrders(),
                    loadFollowupsData()
                ]);

                // Create a map of followup data by customer phone
                const followupsMap = new Map<string, FollowupData>();
                followupsData.forEach(f => {
                    followupsMap.set(f.customerPhone, f);
                });

                // Group orders by customer phone
                const ordersByCustomer = new Map<string, Order[]>();
                orders.forEach(order => {
                    const phone = order.customerPhone;
                    if (!ordersByCustomer.has(phone)) {
                        ordersByCustomer.set(phone, []);
                    }
                    ordersByCustomer.get(phone)!.push(order);
                });

                // Create followups from orders and merge with followups data
                const mergedFollowups: Followup[] = Array.from(ordersByCustomer.entries()).map(([phone, customerOrders]) => {
                    // Sort orders by date (most recent first)
                    const sortedOrders = [...customerOrders].sort((a, b) => 
                        new Date(b.date).getTime() - new Date(a.date).getTime()
                    );
                    const lastOrder = sortedOrders[0];
                    const totalOrders = customerOrders.length;

                    // Get last order detail
                    const lastOrderItems = lastOrder.items.map(item => 
                        `${item.variant} × ${item.quantity}`
                    ).join(', ');

                    // Get followup data or use defaults
                    const followupData = followupsMap.get(phone) || {
                        customerPhone: phone,
                        feedback: '',
                        callingDate: null,
                        callerName: '',
                        callingDetail: '',
                        callAgainDate: null,
                    };

                    return {
                        id: `FU-${phone}`,
                        customerName: lastOrder.customer,
                        customerPhone: phone,
                        lastOrder: lastOrder.date,
                        totalOrders,
                        lastOrderDetail: lastOrderItems,
                        feedback: followupData.feedback || '',
                        callingDate: followupData.callingDate,
                        callerName: followupData.callerName || '',
                        callingDetail: followupData.callingDetail || '',
                        callAgainDate: followupData.callAgainDate,
                    };
                });

                // Sort by last order date (most recent first)
                mergedFollowups.sort((a, b) => 
                    new Date(b.lastOrder).getTime() - new Date(a.lastOrder).getTime()
                );

                setFollowups(mergedFollowups);
                setOrders(orders);
                setOrdersByCustomer(ordersByCustomer);
            } catch (error) {
                console.error('Error loading followups data:', error);
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, []);

    const baseFollowups = followups;

    // Generate month and year options from followups data
    const { monthOptions, yearOptions } = useMemo(() => {
        const months = new Set<number>();
        const years = new Set<number>();
        
        baseFollowups.forEach(f => {
            const date = new Date(f.lastOrder);
            months.add(date.getMonth() + 1);
            years.add(date.getFullYear());
        });
        
        const monthOptions = Array.from(months).sort((a, b) => b - a).map(m => ({
            value: m.toString(),
            label: new Date(2000, m - 1, 1).toLocaleDateString('en-US', { month: 'long' })
        }));
        
        const yearOptions = Array.from(years).sort((a, b) => b - a).map(y => ({
            value: y.toString(),
            label: y.toString()
        }));
        
        return { monthOptions, yearOptions };
    }, [baseFollowups]);

    const filtered = useMemo(() => {
        const now = new Date();
        return baseFollowups.filter(f => {
            // Search filter (by name and mobile number)
            const matchesSearch = !searchQuery || 
                f.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                f.customerPhone.includes(searchQuery);
            
            const matchesCaller = !callerFilter || f.callerName === callerFilter;
            const matchesFeedback = !feedbackFilter || f.feedback === feedbackFilter;
            
            // Month and year filter (last order date)
            let matchesDate = true;
            if (monthFilter || yearFilter) {
                const lastOrderDate = new Date(f.lastOrder);
                const orderMonth = lastOrderDate.getMonth() + 1; // 1-12
                const orderYear = lastOrderDate.getFullYear();
                
                if (monthFilter) {
                    const filterMonth = parseInt(monthFilter);
                    if (orderMonth !== filterMonth) {
                        matchesDate = false;
                    }
                }
                
                if (yearFilter && matchesDate) {
                    const filterYear = parseInt(yearFilter);
                    if (orderYear !== filterYear) {
                        matchesDate = false;
                    }
                }
            }
            
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
            
            return matchesSearch && matchesCaller && matchesFeedback && matchesDate && matchesCallingDate && matchesUpcoming;
        });
    }, [baseFollowups, searchQuery, callerFilter, feedbackFilter, monthFilter, yearFilter, callingDateFilter, upcomingFilter]);

    async function updateFollowup(id: string, field: keyof Followup, value: string | null) {
        const followup = followups.find(f => f.id === id);
        if (!followup) return;

        // Update local state immediately for responsive UI
        const updatedFollowup = { ...followup, [field]: value };
        setFollowups(prev => prev.map(f => {
            if (f.id === id) {
                return updatedFollowup;
            }
            return f;
        }));

        // Save to backend - only save followup-specific fields (not order-derived fields)
        try {
            const followupData: Partial<FollowupData> = {
                customerPhone: followup.customerPhone,
                feedback: updatedFollowup.feedback,
                callingDate: updatedFollowup.callingDate,
                callerName: updatedFollowup.callerName,
                callingDetail: updatedFollowup.callingDetail,
                callAgainDate: updatedFollowup.callAgainDate,
            };

            await updateFollowupData(followup.customerPhone, followupData);
            showToast('Followup updated successfully!', 'success');
        } catch (error) {
            console.error('Error updating followup:', error);
            showToast('Failed to save followup. Please try again.', 'error');
            // Revert on error
            setFollowups(prev => prev.map(f => {
                if (f.id === id) {
                    return followup;
                }
                return f;
            }));
        }
    }

    if (loading) {
        return (
            <section style={{ display: 'grid', gap: 12, width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
                <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                    Loading followups...
                </div>
            </section>
        );
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
                            <StatusFilter
                                label="Month"
                                value={monthFilter}
                                onChange={setMonthFilter}
                                options={monthOptions.map(m => m.label)}
                                optionValues={monthOptions.map(m => m.value)}
                            />
                            <StatusFilter
                                label="Year"
                                value={yearFilter}
                                onChange={setYearFilter}
                                options={yearOptions.map(y => y.label)}
                                optionValues={yearOptions.map(y => y.value)}
                            />
                            {(searchQuery || callerFilter || feedbackFilter || monthFilter || yearFilter || callingDateFilter || upcomingFilter) ? (
                                <button 
                                    className="filter-btn" 
                                    onClick={() => { setSearchQuery(''); setCallerFilter(''); setFeedbackFilter(''); setMonthFilter(''); setYearFilter(''); setCallingDateFilter(''); setUpcomingFilter(''); }}
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
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                            <span 
                                                style={{ 
                                                    fontWeight: 600, 
                                                    cursor: 'pointer',
                                                    color: 'var(--text)',
                                                    transition: 'color 0.2s'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.color = '#10b981';
                                                    e.currentTarget.style.textDecoration = 'underline';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.color = 'var(--text)';
                                                    e.currentTarget.style.textDecoration = 'none';
                                                }}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setSelectedCustomerPhone(f.customerPhone);
                                                    setShowCustomerProfile(true);
                                                }}
                                            >
                                                {f.customerName}
                                            </span>
                                            <a className="link" href={`tel:${f.customerPhone}`} style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none' }}>
                                                {f.customerPhone}
                                            </a>
                                            <span style={{
                                                display: 'inline-block',
                                                fontSize: 10,
                                                fontWeight: 600,
                                                textTransform: 'uppercase',
                                                padding: '2px 6px',
                                                borderRadius: 4,
                                                backgroundColor: getCustomerType(f.totalOrders) === 'new' ? '#dbeafe' : 
                                                               getCustomerType(f.totalOrders) === 'repeat' ? '#dcfce7' : '#fef3c7',
                                                color: getCustomerType(f.totalOrders) === 'new' ? '#1e40af' : 
                                                       getCustomerType(f.totalOrders) === 'repeat' ? '#166534' : '#92400e',
                                                width: 'fit-content'
                                            }}>
                                                {getCustomerType(f.totalOrders)}
                                            </span>
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
            {showCustomerProfile && selectedCustomerPhone && (
                <CustomerProfileModal 
                    customerPhone={selectedCustomerPhone} 
                    orders={orders}
                    ordersByCustomer={ordersByCustomer}
                    onClose={() => {
                        setShowCustomerProfile(false);
                        setSelectedCustomerPhone(null);
                    }} 
                />
            )}
            <ToastContainer toasts={toasts} />
        </section>
    );
}

function Th({ children }: { children: string }) {
    return <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>{children}</th>;
}

function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return <td style={{ padding: '12px', ...style }}>{children}</td>;
}

function StatusFilter<T extends string>({ label, value, onChange, options, optionValues }: { label: string; value: T | ''; onChange: (val: T | '') => void; options: T[]; optionValues?: string[] }) {
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
                {options.map((opt, index) => (
                    <option key={opt} value={optionValues ? optionValues[index] : opt}>{opt}</option>
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

    function handleDateSelect(day: number) {
        const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
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
        <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
            <div
                ref={inputRef}
                onClick={() => setIsOpen(!isOpen)}
                className="input"
                style={{
                    width: '100%',
                    height: 32,
                    fontSize: 13,
                    padding: '4px 8px',
                    paddingRight: '32px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    userSelect: 'none',
                }}
            >
                <span style={{ color: displayValue && displayValue !== '—' ? 'var(--text)' : 'var(--muted)' }}>
                    {displayValue}
                </span>
                <span style={{ fontSize: 14, color: 'var(--muted)', pointerEvents: 'none' }}>📅</span>
            </div>
            <input
                type="date"
                value={toInputDate(value)}
                onChange={(e) => {
                    const newValue = e.target.value ? new Date(e.target.value).toISOString() : null;
                    onChange(newValue);
                }}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
                tabIndex={-1}
            />
            {isOpen && (
                <div
                    ref={popupRef}
                    style={{
                        position: 'fixed',
                        background: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: 12,
                        padding: 20,
                        boxShadow: '0 10px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
                        zIndex: 10000,
                        minWidth: 300,
                        maxWidth: 300,
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <button
                            type="button"
                            onClick={handlePrevMonth}
                            style={{ 
                                padding: '6px 10px', 
                                fontSize: 18,
                                border: 'none',
                                background: '#f3f4f6',
                                borderRadius: 6,
                                cursor: 'pointer',
                                color: '#374151',
                                fontWeight: 600,
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#e5e7eb';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#f3f4f6';
                            }}
                            aria-label="Previous month"
                        >
                            ‹
                        </button>
                        <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>
                            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </div>
                        <button
                            type="button"
                            onClick={handleNextMonth}
                            style={{ 
                                padding: '6px 10px', 
                                fontSize: 18,
                                border: 'none',
                                background: '#f3f4f6',
                                borderRadius: 6,
                                cursor: 'pointer',
                                color: '#374151',
                                fontWeight: 600,
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#e5e7eb';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#f3f4f6';
                            }}
                            aria-label="Next month"
                        >
                            ›
                        </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 16 }}>
                        {weekDays.map((day) => (
                            <div key={day} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#6b7280', padding: '8px 0' }}>
                                {day}
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                        {Array(firstDayOfMonth).fill(null).map((_, i) => (
                            <div key={`empty-${i}`} />
                        ))}
                        {days.map((day) => {
                            const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                            const isSelected = selectedDate && 
                                date.getDate() === selectedDate.getDate() &&
                                date.getMonth() === selectedDate.getMonth() &&
                                date.getFullYear() === selectedDate.getFullYear();
                            const isToday = date.toDateString() === new Date().toDateString();
                            return (
                                <button
                                    key={day}
                                    type="button"
                                    onClick={() => handleDateSelect(day)}
                                    style={{
                                        padding: '10px 4px',
                                        border: 'none',
                                        background: isSelected ? '#16a34a' : isToday ? '#dcfce7' : 'transparent',
                                        color: isSelected ? '#ffffff' : isToday ? '#16a34a' : '#111827',
                                        borderRadius: 8,
                                        cursor: 'pointer',
                                        fontSize: 14,
                                        fontWeight: isSelected ? 700 : isToday ? 600 : 400,
                                        transition: 'all 0.2s',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isSelected && !isToday) {
                                            e.currentTarget.style.background = '#f3f4f6';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isSelected && !isToday) {
                                            e.currentTarget.style.background = 'transparent';
                                        } else if (isToday && !isSelected) {
                                            e.currentTarget.style.background = '#dcfce7';
                                        }
                                    }}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                        <button
                            type="button"
                            onClick={handleToday}
                            style={{
                                flex: 1,
                                padding: '10px',
                                border: '1px solid #e5e7eb',
                                background: '#f9fafb',
                                borderRadius: 8,
                                cursor: 'pointer',
                                fontSize: 14,
                                fontWeight: 600,
                                color: '#111827',
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#f3f4f6';
                                e.currentTarget.style.borderColor = '#d1d5db';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#f9fafb';
                                e.currentTarget.style.borderColor = '#e5e7eb';
                            }}
                        >
                            Today
                        </button>
                        <button
                            type="button"
                            onClick={handleClear}
                            style={{
                                flex: 1,
                                padding: '10px',
                                border: '1px solid #e5e7eb',
                                background: '#f9fafb',
                                borderRadius: 8,
                                cursor: 'pointer',
                                fontSize: 14,
                                fontWeight: 600,
                                color: '#111827',
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#f3f4f6';
                                e.currentTarget.style.borderColor = '#d1d5db';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#f9fafb';
                                e.currentTarget.style.borderColor = '#e5e7eb';
                            }}
                        >
                            Clear
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatusTag({ kind, type }: { kind: string; type: 'payment' | 'delivery' }) {
    let cls = 'tag info';
    if (type === 'payment') {
        if (kind === 'PAID') cls = 'tag success';
        else if (kind === 'COD') cls = 'tag warning';
        else cls = 'tag info';
    } else {
        if (kind === 'Delivered') cls = 'tag success';
        else if (kind === 'In Transit') cls = 'tag info';
        else if (kind === 'Pending Pickup') cls = 'tag warning';
        else if (kind === 'RTO') cls = 'tag danger';
    }
    return <span className={cls}>{kind}</span>;
}

function CustomerProfileModal({ customerPhone, orders, ordersByCustomer, onClose }: { customerPhone: string; orders: Order[]; ordersByCustomer: Map<string, Order[]>; onClose: () => void }) {
    // Get all orders for this customer using the pre-grouped map
    const customerOrders = useMemo(() => {
        // First try to get from the pre-grouped map (exact match)
        let customerOrdersList = ordersByCustomer.get(customerPhone) || [];
        
        // If no exact match, try normalized matching
        if (customerOrdersList.length === 0) {
            const normalizePhone = (phone: string) => {
                if (!phone) return '';
                return phone.replace(/\D/g, '').trim();
            };
            const normalizedCustomerPhone = normalizePhone(customerPhone);
            
            // Try to find matching phone in the map
            for (const [phone, orderList] of ordersByCustomer.entries()) {
                if (normalizePhone(phone) === normalizedCustomerPhone && normalizedCustomerPhone.length > 0) {
                    customerOrdersList = orderList;
                    break;
                }
            }
            
            // Fallback: filter from all orders if still not found
            if (customerOrdersList.length === 0 && normalizedCustomerPhone.length > 0) {
                customerOrdersList = orders.filter(o => {
                    const orderPhone = normalizePhone(o.customerPhone);
                    return orderPhone === normalizedCustomerPhone && orderPhone.length > 0;
                });
            }
        }
        
        return customerOrdersList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [orders, ordersByCustomer, customerPhone]);

    // Get customer profile from the most recent order
    const customerProfile = useMemo(() => {
        if (customerOrders.length === 0) {
            // Return default profile if no orders found
            return {
                name: 'Unknown Customer',
                phone: customerPhone,
                address: '—',
                state: '—',
                pincode: '—',
            };
        }
        const latestOrder = customerOrders[0];
        return {
            name: latestOrder.customer,
            phone: latestOrder.customerPhone,
            address: latestOrder.customerAddress,
            state: latestOrder.state,
            pincode: latestOrder.pincode || '—',
        };
    }, [customerOrders, customerPhone]);

    const totalOrders = customerOrders.length;
    const totalAmount = customerOrders.reduce((sum, o) => sum + o.amount, 0);

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);

    return (
        <div
            role="dialog"
            aria-modal="true"
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,.45)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', zIndex: 60 }}
        >
            <div
                className="card"
                onClick={(e) => e.stopPropagation()}
                style={{ width: '100%', maxWidth: 1200, padding: 0, boxShadow: '0 20px 60px rgba(0,0,0,.25)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottom: '1px solid var(--border)' }}>
                    <h3 style={{ margin: 0 }}>Customer Profile</h3>
                    <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
                </div>
                
                <div style={{ padding: 20, overflow: 'auto', flex: 1 }}>
                    {/* Customer Information */}
                    <div style={{ marginBottom: 24, padding: 16, background: 'var(--bg-elev)', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <h4 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Customer Information</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {/* First Row: Name and Phone */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
                                <div>
                                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Name</div>
                                    <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{customerProfile.name}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Phone</div>
                                    <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>
                                        <a className="link" href={`tel:${customerProfile.phone}`} style={{ textDecoration: 'none' }}>{customerProfile.phone}</a>
                                    </div>
                                </div>
                            </div>
                            {/* Second Row: Address (full width) */}
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Address</div>
                                <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{customerProfile.address}</div>
                            </div>
                            {/* Third Row: State and Pincode */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
                                <div>
                                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>State</div>
                                    <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{customerProfile.state}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Pincode</div>
                                    <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{customerProfile.pincode}</div>
                                </div>
                            </div>
                        </div>
                        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 24 }}>
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Total Orders</div>
                                <div style={{ fontSize: 18, color: 'var(--text)', fontWeight: 700 }}>{totalOrders}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Total Amount</div>
                                <div style={{ fontSize: 18, color: 'var(--text)', fontWeight: 700 }}>{formatCurrency(totalAmount)}</div>
                            </div>
                        </div>
                    </div>

                    {/* Orders Table */}
                    <div>
                        <h4 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Order History</h4>
                        <div className="table-scroll-wrapper" style={{ maxHeight: '400px', overflow: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                                <thead>
                                    <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10 }}>
                                        <Th>Date</Th>
                                        <Th>Items</Th>
                                        <Th>Amount</Th>
                                        <Th>Payment</Th>
                                        <Th>Delivery</Th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {customerOrders.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                                                {orders.length === 0 ? 'No orders loaded' : 'No orders found for this customer'}
                                            </td>
                                        </tr>
                                    ) : (
                                        customerOrders.map((order) => (
                                            <tr key={order.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <Td>{formatDate(order.date)}</Td>
                                                <Td>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                        {(order.items ?? []).length === 0 ? <span>—</span> : null}
                                                        {(order.items ?? []).map((it: OrderItem, idx: number) => (
                                                            <div key={idx} style={{ fontSize: 12 }}>{it.variant} × {it.quantity}</div>
                                                        ))}
                                                    </div>
                                                </Td>
                                                <Td style={{ fontWeight: 600 }}>{formatCurrency(order.amount)}</Td>
                                                <Td><StatusTag kind={order.paymentStatus} type="payment" /></Td>
                                                <Td><StatusTag kind={order.deliveryStatus} type="delivery" /></Td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ToastContainer({ toasts }: { toasts: Toast[] }) {
    return (
        <div
            style={{
                position: 'fixed',
                top: 20,
                right: 20,
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                pointerEvents: 'none',
            }}
        >
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className="toast"
                    style={{
                        pointerEvents: 'auto',
                        animation: 'slideInRight 0.3s ease-out',
                    }}
                    data-type={toast.type}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 18 }}>
                            {toast.type === 'success' ? '✓' : toast.type === 'delete' ? '🗑' : '✕'}
                        </span>
                        <span>{toast.message}</span>
                    </div>
                </div>
            ))}
        </div>
    );
}

