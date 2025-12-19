import { useEffect, useMemo, useRef, useState } from 'react';

type LeadStatus = 'New' | 'Contacted' | 'Converted' | 'Not Interested' | 'No Answer' | 'Potential Customer' | 'Very Interested' | 'CBA';
type Platform = 'Maatripure' | 'STW' | 'Abandoned' | 'Whatsapp';

type Toast = {
    id: string;
    message: string;
    type: 'success' | 'error' | 'delete';
};

type WALead = {
    id: string;
    customerName: string;
    mobile: string;
    callingDate: string; // ISO date
    callingDetail: string;
    callBackDate?: string; // ISO date
    notes: string;
    status: LeadStatus;
    platform?: Platform;
};

export default function WALeads() {
    const [customerFilter, setCustomerFilter] = useState('');
    const [showAddLead, setShowAddLead] = useState(false);
    const [editingLead, setEditingLead] = useState<WALead | null>(null);
    const [leads, setLeads] = useState<WALead[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<LeadStatus | ''>('');
    const [toasts, setToasts] = useState<Toast[]>([]);

    function showToast(message: string, type: 'success' | 'error' | 'delete' = 'success') {
        const id = `toast-${Date.now()}-${Math.random()}`;
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3000);
    }

    useEffect(() => {
        let cancelled = false;
        fetch('/api/wa-leads-orders')
            .then((res) => {
                if (!res.ok) throw new Error('Failed to load Leads');
                return res.json();
            })
            .then((data) => {
                if (cancelled) return;
                // Transform old order data to new lead format if needed
                const transformedLeads: WALead[] = Array.isArray(data) ? data.map((item: any) => {
                    // If it's already in the new format, ensure all required fields are present
                    if (item.customerName && item.mobile) {
                        return {
                            id: item.id || '',
                            customerName: item.customerName || '',
                            mobile: item.mobile || '',
                            callingDate: item.callingDate || '',
                            callingDetail: item.callingDetail || '',
                            callBackDate: item.callBackDate || undefined,
                            notes: item.notes || '',
                            status: (item.status && ['New', 'Contacted', 'Converted', 'Not Interested', 'No Answer', 'Potential Customer', 'Very Interested', 'CBA'].includes(item.status)) 
                                ? item.status as LeadStatus 
                                : 'New' as LeadStatus,
                        };
                    }
                    // Otherwise, transform from old order format
                    return {
                        id: item.id || '',
                        customerName: item.customer || '',
                        mobile: item.customerPhone || '',
                        callingDate: item.date || item.callingDate || '',
                        callingDetail: item.callingDetail || '',
                        callBackDate: item.callBackDate || undefined,
                        notes: item.notes || '',
                        status: (item.status && ['New', 'Contacted', 'Converted', 'Not Interested', 'No Answer', 'Potential Customer', 'Very Interested', 'CBA'].includes(item.status)) 
                            ? item.status as LeadStatus 
                            : 'New' as LeadStatus,
                    };
                }) : [];
                setLeads(transformedLeads);
            })
            .catch((err) => {
                console.error('Failed to load Leads', err);
                if (!cancelled) setLeads([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const sortedLeads = useMemo(() => {
        return [...leads].sort((a, b) => {
            if (!a.callingDate && !b.callingDate) return 0;
            if (!a.callingDate) return 1;
            if (!b.callingDate) return -1;
            return a.callingDate < b.callingDate ? 1 : -1;
        });
    }, [leads]);

    const filtered = useMemo(() => {
        const filteredLeads = sortedLeads.filter(lead => {
            const matchesCustomer = lead.customerName.toLowerCase().includes(customerFilter.toLowerCase());
            const matchesStatus = !statusFilter || lead.status === statusFilter;
            return matchesCustomer && matchesStatus;
        });
        return filteredLeads;
    }, [sortedLeads, customerFilter, statusFilter]);

    const metrics = useMemo(() => {
        const totalLeads = filtered.length;
        const newLeads = filtered.filter(l => l.status === 'New').length;
        const convertedLeads = filtered.filter(l => l.status === 'Converted').length;
        const interestedLeads = filtered.filter(l => l.status === 'Very Interested' || l.status === 'Potential Customer').length;
        const cbaLeads = filtered.filter(l => l.status === 'CBA').length;
        
        return {
            totalLeads,
            newLeads,
            convertedLeads,
            interestedLeads,
            cbaLeads,
        };
    }, [filtered]);

    return (
        <section style={{ display: 'grid', gap: 12, width: '100%', maxWidth: '100%', overflow: 'hidden', position: 'relative' }}>
            <ToastContainer toasts={toasts} />
            <div className="card" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', position: 'relative' }}>
                <div style={{ fontWeight: 800 }}>Leads</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
                    <div style={{ 
                        display: 'flex', 
                        gap: 10, 
                        alignItems: 'center', 
                        flexWrap: 'wrap', 
                        justifyContent: 'space-between',
                        background: '#f8f9fa',
                        padding: '12px 16px',
                        borderRadius: 8,
                        width: '100%'
                    }}>
                        <div className="status-filters-row" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <StatusFilter
                                label="Status"
                                value={statusFilter}
                                onChange={setStatusFilter}
                                options={['New', 'Contacted', 'Converted', 'Not Interested', 'No Answer', 'Potential Customer', 'Very Interested', 'CBA'] as LeadStatus[]}
                            />
                            {statusFilter ? (
                            <button 
                                className="filter-btn" 
                                    onClick={() => { setStatusFilter(''); }}
                                style={{ fontSize: 12, padding: '6px 12px' }}
                            >
                                    Clear
                            </button>
                        ) : null}
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                            <input className="input" placeholder="Search customer" style={{ width: 240 }} value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} />
                            <button className="button" style={{ width: 'auto', padding: '0 16px' }} onClick={() => {
                                setEditingLead(null);
                                setShowAddLead(true);
                            }}>Add Lead</button>
                        </div>
                    </div>
                </div>
                <div style={{ 
                    width: '100%', 
                    display: 'flex',
                    borderRadius: 4,
                    overflow: 'hidden',
                    border: '1px solid var(--border)',
                    marginTop: 12,
                    background: 'var(--bg-elev)',
                }}>
                    <ModernMetricItem 
                        icon="👥" 
                        label="Total Leads" 
                        value={metrics.totalLeads.toLocaleString()} 
                        iconColor="#16a34a"
                        isLast={false}
                        isEven={false}
                    />
                    <ModernMetricItem 
                        icon="🆕" 
                        label="New" 
                        value={metrics.newLeads.toLocaleString()} 
                        iconColor="#3b82f6"
                        isLast={false}
                        isEven={true}
                    />
                    <ModernMetricItem 
                        icon="⭐" 
                        label="Interested" 
                        value={metrics.interestedLeads.toLocaleString()} 
                        iconColor="#f59e0b"
                        isLast={false}
                        isEven={false}
                    />
                    <ModernMetricItem 
                        icon="💬" 
                        label="CBA" 
                        value={metrics.cbaLeads.toLocaleString()} 
                        iconColor="#8b5cf6"
                        isLast={false}
                        isEven={true}
                    />
                    <ModernMetricItem 
                        icon="✅" 
                        label="Converted" 
                        value={metrics.convertedLeads.toLocaleString()} 
                        iconColor="#10b981"
                        isLast={true}
                        isEven={false}
                    />
                </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-scroll-wrapper">
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000, tableLayout: 'auto' }}>
                        <colgroup>
                            <col style={{ width: '180px', minWidth: '180px' }} />
                            <col style={{ width: '140px', minWidth: '140px' }} />
                            <col style={{ width: '140px', minWidth: '140px' }} />
                            <col style={{ width: '200px', minWidth: '200px' }} />
                            <col style={{ width: '140px', minWidth: '140px' }} />
                            <col style={{ width: '250px', minWidth: '250px' }} />
                            <col style={{ width: '150px', minWidth: '150px' }} />
                            <col style={{ width: '120px', minWidth: '120px' }} />
                            <col style={{ width: '120px', minWidth: '120px' }} />
                        </colgroup>
                        <thead>
                            <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                                <Th>Customer Name</Th>
                                <Th>Mobile</Th>
                                <Th>Calling Date</Th>
                                <Th>Calling Detail</Th>
                                <Th>Call Back Date</Th>
                                <Th>Notes</Th>
                                <Th>Status</Th>
                                <Th>Platform</Th>
                                <Th>Actions</Th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                                        Loading leads…
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                                        No leads found. Click "Add Lead" to create your first lead.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((lead, rowIndex) => {
                                    const isEven = rowIndex % 2 === 1;
                                    return (
                                        <tr key={lead.id} style={{ 
                                            borderBottom: '1px solid var(--border)',
                                            background: isEven ? '#f8f9fa' : 'transparent'
                                        }}>
                                            <Td>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontWeight: 600 }}>{lead.customerName}</span>
                                            </div>
                                            </Td>
                                            <Td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <span style={{ fontSize: 13, color: 'var(--text)' }}>{lead.mobile}</span>
                                                    <a 
                                                        href={`tel:${lead.mobile}`}
                                                        aria-label={`Call ${lead.mobile}`}
                                                        role="button"
                                                        tabIndex={0}
                                                        style={{ 
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            textDecoration: 'none',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s ease',
                                                            border: 'none',
                                                            outline: 'none',
                                                            background: 'transparent',
                                                            padding: '6px',
                                                            borderRadius: '6px',
                                                            color: '#10b981',
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.background = '#f0fdf4';
                                                            e.currentTarget.style.color = '#059669';
                                                            e.currentTarget.style.transform = 'scale(1.1)';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.background = 'transparent';
                                                            e.currentTarget.style.color = '#10b981';
                                                            e.currentTarget.style.transform = 'scale(1)';
                                                        }}
                                                        onFocus={(e) => {
                                                            e.currentTarget.style.outline = '2px solid #10b981';
                                                            e.currentTarget.style.outlineOffset = '2px';
                                                            e.currentTarget.style.borderRadius = '6px';
                                                            e.currentTarget.style.background = '#f0fdf4';
                                                        }}
                                                        onBlur={(e) => {
                                                            e.currentTarget.style.outline = 'none';
                                                            e.currentTarget.style.background = 'transparent';
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' || e.key === ' ') {
                                                                e.preventDefault();
                                                                window.location.href = `tel:${lead.mobile}`;
                                                            }
                                                        }}
                                                        title={`Call ${lead.mobile}`}
                                                    >
                                                        <svg 
                                                            aria-hidden="true"
                                                            width="18" 
                                                            height="18" 
                                                            viewBox="0 0 24 24" 
                                                            fill="none" 
                                                            stroke="currentColor" 
                                                            strokeWidth="2" 
                                                            strokeLinecap="round" 
                                                            strokeLinejoin="round"
                                                            style={{ display: 'block' }}
                                                        >
                                                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                                        </svg>
                                                    </a>
                                                </div>
                                            </Td>
                                            <Td>{lead.callingDate ? new Date(lead.callingDate).toLocaleDateString() : '—'}</Td>
                                            <Td>{lead.callingDetail || '—'}</Td>
                                            <Td>{lead.callBackDate ? new Date(lead.callBackDate).toLocaleDateString() : '—'}</Td>
                                            <Td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={lead.notes}>{lead.notes || '—'}</Td>
                                            <Td><StatusTag kind={lead.status} type="lead" /></Td>
                                            <Td>{lead.platform || '—'}</Td>
                                            <Td>
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <button
                                                        type="button"
                                                        className="icon-btn"
                                                        onClick={() => {
                                                            setEditingLead(lead);
                                                            setShowAddLead(true);
                                                        }}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="icon-btn icon-btn--danger"
                                                        onClick={async () => {
                                                            if (confirm('Are you sure you want to delete this lead? This action cannot be undone.')) {
                                                                try {
                                                                    const response = await fetch(`/api/wa-leads-orders/${lead.id}`, {
                                                                        method: 'DELETE',
                                                                    });
                                                                    if (!response.ok) throw new Error('Failed to delete lead');
                                                                    setLeads((prev) => prev.filter(l => l.id !== lead.id));
                                                                    showToast('Lead deleted successfully!', 'delete');
                                                                } catch (err) {
                                                                    console.error('Failed to delete lead', err);
                                                                    showToast('Failed to delete lead. Please check that the server is running and try again.', 'error');
                                                                }
                                                            }
                                                        }}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </Td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showAddLead ? (
                <AddLeadModal 
                    lead={editingLead}
                    existingLeads={leads}
                    onClose={() => {
                        setShowAddLead(false);
                        setEditingLead(null);
                    }} 
                    onSave={async (lead) => {
                        try {
                            if (editingLead) {
                                // Update existing lead
                                const response = await fetch(`/api/wa-leads-orders/${editingLead.id}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(lead),
                                });
                                if (!response.ok) throw new Error('Failed to update lead');
                                const updated = await response.json();
                                setLeads((prev) => prev.map(l => l.id === editingLead.id ? updated : l));
                                showToast('Lead updated successfully!', 'success');
                            } else {
                                // Create new lead
                            const response = await fetch('/api/wa-leads-orders', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(lead),
                            });
                                if (!response.ok) throw new Error('Failed to save lead');
                            const saved = await response.json();
                                setLeads((prev) => [saved, ...prev]);
                                showToast('Lead added successfully!', 'success');
                            }
                            setShowAddLead(false);
                            setEditingLead(null);
                        } catch (err) {
                            console.error('Failed to save lead', err);
                            showToast(`Failed to ${editingLead ? 'update' : 'create'} lead. Please check that the server is running and try again.`, 'error');
                        }
                    }} 
                />
            ) : null}
        </section>
    );
}

function Th({ children }: { children: string }) {
    return <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 700 }}>{children}</th>;
}
function Td({ children, style, title }: { children: React.ReactNode; style?: React.CSSProperties; title?: string }) {
    return <td style={{ padding: '12px', ...style }} title={title}>{children}</td>;
}

function StatusFilter<T extends LeadStatus>({ label, value, onChange, options }: { label: string; value: T | ''; onChange: (val: T | '') => void; options: T[] }) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLDivElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);

    const statusConfig: Record<LeadStatus, { icon: string; color: string; bgColor: string }> = {
        'New': { icon: '🆕', color: '#075985', bgColor: '#e0f2fe' },
        'Contacted': { icon: '📞', color: '#854d0e', bgColor: '#fef9c3' },
        'Converted': { icon: '✅', color: '#166534', bgColor: '#dcfce7' },
        'Not Interested': { icon: '❌', color: '#991b1b', bgColor: '#fee2e2' },
        'No Answer': { icon: '🔇', color: '#075985', bgColor: '#e0f2fe' },
        'Potential Customer': { icon: '⭐', color: '#854d0e', bgColor: '#fef9c3' },
        'Very Interested': { icon: '🔥', color: '#854d0e', bgColor: '#fef9c3' },
        'CBA': { icon: '💬', color: '#854d0e', bgColor: '#fef9c3' },
    };

    const currentStatus = value ? statusConfig[value] : null;

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
        if (isOpen && buttonRef.current && popupRef.current) {
            const buttonRect = buttonRef.current.getBoundingClientRect();
            const popup = popupRef.current;
            const popupHeight = 260;
            const popupWidth = 220;
            
            let top = buttonRect.bottom + window.scrollY + 4;
            let left = buttonRect.left + window.scrollX;
            
            if (buttonRect.bottom + popupHeight > window.innerHeight) {
                top = buttonRect.top + window.scrollY - popupHeight - 4;
            }
            
            if (buttonRect.left + popupWidth > window.innerWidth) {
                left = window.innerWidth - popupWidth - 10;
            }
            
            popup.style.top = `${top}px`;
            popup.style.left = `${left}px`;
        }
    }, [isOpen]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label className="label" style={{ fontSize: 11, margin: 0, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</label>
            <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
                <div
                    ref={buttonRef}
                    onClick={() => setIsOpen(!isOpen)}
                className="input"
                    style={{
                        height: 42,
                        minWidth: 200,
                        cursor: 'pointer',
                        display: 'flex', 
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        userSelect: 'none',
                        padding: '0 14px',
                        fontSize: 14,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {currentStatus ? (
                            <>
                                <span style={{ fontSize: 16 }}>{currentStatus.icon}</span>
                                <span style={{ color: 'var(--text)', fontWeight: 500, fontSize: 14 }}>{value}</span>
                            </>
                        ) : (
                            <span style={{ color: 'var(--muted)', fontSize: 14 }}>All</span>
                        )}
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>▼</span>
                </div>
                {isOpen && (
                    <div
                        ref={popupRef}
                        style={{
                            position: 'fixed',
                            background: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: 8,
                            padding: 6,
                            boxShadow: '0 10px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
                            zIndex: 10000,
                            minWidth: 220,
                            maxWidth: 220,
                            maxHeight: 260,
                            overflowY: 'auto',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div
                            onClick={() => {
                                onChange('' as T | '');
                                setIsOpen(false);
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '8px 10px',
                                borderRadius: 6,
                                cursor: 'pointer',
                                background: !value ? '#f3f4f6' : 'transparent',
                                border: !value ? '1.5px solid #6b7280' : '1.5px solid transparent',
                                transition: 'all 0.2s',
                                marginBottom: 2,
                            }}
                            onMouseEnter={(e) => {
                                if (!value) return;
                                e.currentTarget.style.background = '#f9fafb';
                            }}
                            onMouseLeave={(e) => {
                                if (!value) return;
                                e.currentTarget.style.background = 'transparent';
                            }}
                        >
                            <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>—</span>
                            <span style={{ color: 'var(--text)', fontWeight: 500, fontSize: 13 }}>All</span>
                        </div>
                        {options.map((status) => {
                            const config = statusConfig[status];
                            const isSelected = value === status;
                            return (
                                <div
                                    key={status}
                                    onClick={() => {
                                        onChange(status);
                                        setIsOpen(false);
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        padding: '8px 10px',
                                        borderRadius: 6,
                                        cursor: 'pointer',
                                        background: isSelected ? config.bgColor : 'transparent',
                                        border: isSelected ? `1.5px solid ${config.color}` : '1.5px solid transparent',
                                        transition: 'all 0.2s',
                                        marginBottom: 2,
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isSelected) {
                                            e.currentTarget.style.background = '#f9fafb';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isSelected) {
                                            e.currentTarget.style.background = 'transparent';
                                        }
                                    }}
                                >
                                    <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>{config.icon}</span>
                                    <span style={{ color: 'var(--text)', fontWeight: 500, fontSize: 13 }}>{status}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

function StatusTag({ kind, type }: { kind: string; type: 'payment' | 'delivery' | 'lead' }) {
    let cls = 'tag info';
    if (type === 'payment') {
        if (kind === 'Paid') cls = 'tag success';
        else if (kind === 'Pending') cls = 'tag warning';
        else if (kind === 'Failed') cls = 'tag danger';
        else cls = 'tag info';
    } else if (type === 'delivery') {
        if (kind === 'Delivered') cls = 'tag success';
        else if (kind === 'In Transit') cls = 'tag info';
        else if (kind === 'Pending Pickup') cls = 'tag warning';
        else if (kind === 'RTO') cls = 'tag danger';
    } else if (type === 'lead') {
        if (kind === 'Converted') cls = 'tag success';
        else if (kind === 'New') cls = 'tag info';
        else if (kind === 'Contacted' || kind === 'Potential Customer' || kind === 'Very Interested' || kind === 'CBA') cls = 'tag warning';
        else if (kind === 'Not Interested') cls = 'tag danger';
        else if (kind === 'No Answer') cls = 'tag info';
        else cls = 'tag info';
    }
    return <span className={cls}>{kind}</span>;
}

function toInputDate(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function ModernMetricItem({ icon, label, value, iconColor, isLast, isEven }: { icon: string; label: string; value: string; iconColor: string; isLast: boolean; isEven: boolean }) {
    return (
        <div style={{ 
            background: isEven ? '#f8f9fa' : 'transparent',
            flex: 1,
            padding: '12px 10px',
            display: 'flex', 
            flexDirection: 'column', 
            gap: 6,
            borderRight: isLast ? 'none' : '1px solid var(--border)',
            transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg)';
        }}
        onMouseLeave={(e) => {
            e.currentTarget.style.background = isEven ? '#f8f9fa' : 'transparent';
        }}
        >
            <div style={{ 
                display: 'flex',
            alignItems: 'center',
                gap: 6,
                marginBottom: 2
        }}>
                <span style={{ fontSize: 16, opacity: 0.8 }}>{icon}</span>
            <div style={{ 
                fontSize: 10, 
                color: 'var(--muted)', 
                fontWeight: 600, 
                textTransform: 'uppercase', 
                    letterSpacing: '0.4px',
            }}>
                {label}
                </div>
            </div>
            <div style={{ 
                fontSize: 16, 
                fontWeight: 700, 
                color: 'var(--text)',
                lineHeight: 1.2,
                letterSpacing: '-0.2px'
            }}>
                {value}
            </div>
        </div>
    );
}

function DatePicker({ value, onChange, required, placeholder }: { value: string; onChange: (value: string) => void; required?: boolean; placeholder?: string }) {
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
            const popupHeight = 350; // Approximate height of calendar
            const popupWidth = 280;
            
            // Position below the input by default
            let top = inputRect.bottom + window.scrollY + 4;
            let left = inputRect.left + window.scrollX;
            
            // Check if there's enough space below, if not, position above
            if (inputRect.bottom + popupHeight > window.innerHeight) {
                top = inputRect.top + window.scrollY - popupHeight - 4;
            }
            
            // Check if there's enough space on the right, if not, adjust left
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
        <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
            <div
                ref={inputRef}
                onClick={() => setIsOpen(!isOpen)}
                className="input"
                style={{
                    width: '100%',
                    marginTop: 6,
                    cursor: 'pointer',
            display: 'flex', 
            alignItems: 'center',
                    justifyContent: 'space-between',
                    userSelect: 'none'
                }}
            >
                <span style={{ color: displayValue ? 'var(--text)' : 'var(--muted)' }}>
                    {displayValue || placeholder || 'Select date'}
                </span>
                <span style={{ fontSize: 18, color: 'var(--muted)' }}>📅</span>
            </div>
            <input
                type="date"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                required={required}
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
                    <button
                        type="button"
                        onClick={handleToday}
                        style={{
                            marginTop: 16,
                            width: '100%',
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
            </div>
            )}
        </div>
    );
}

function StatusDropdown({ value, onChange, required }: { value: LeadStatus; onChange: (value: LeadStatus) => void; required?: boolean }) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLDivElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);

    const statusConfig: Record<LeadStatus, { icon: string; color: string; bgColor: string }> = {
        'New': { icon: '🆕', color: '#075985', bgColor: '#e0f2fe' },
        'Contacted': { icon: '📞', color: '#854d0e', bgColor: '#fef9c3' },
        'Converted': { icon: '✅', color: '#166534', bgColor: '#dcfce7' },
        'Not Interested': { icon: '❌', color: '#991b1b', bgColor: '#fee2e2' },
        'No Answer': { icon: '🔇', color: '#075985', bgColor: '#e0f2fe' },
        'Potential Customer': { icon: '⭐', color: '#854d0e', bgColor: '#fef9c3' },
        'Very Interested': { icon: '🔥', color: '#854d0e', bgColor: '#fef9c3' },
        'CBA': { icon: '💬', color: '#854d0e', bgColor: '#fef9c3' },
    };

    const currentStatus = statusConfig[value];

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
        if (isOpen && buttonRef.current && popupRef.current) {
            const buttonRect = buttonRef.current.getBoundingClientRect();
            const popup = popupRef.current;
            const popupHeight = 260;
            const popupWidth = 220;
            
            let top = buttonRect.bottom + window.scrollY + 4;
            let left = buttonRect.left + window.scrollX;
            
            if (buttonRect.bottom + popupHeight > window.innerHeight) {
                top = buttonRect.top + window.scrollY - popupHeight - 4;
            }
            
            if (buttonRect.left + popupWidth > window.innerWidth) {
                left = window.innerWidth - popupWidth - 10;
            }
            
            popup.style.top = `${top}px`;
            popup.style.left = `${left}px`;
        }
    }, [isOpen]);

    const statusOptions: LeadStatus[] = ['New', 'Contacted', 'Converted', 'Not Interested', 'No Answer', 'Potential Customer', 'Very Interested', 'CBA'];

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
            <div
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                className="input"
                style={{
                    width: '100%',
                    marginTop: 6,
                    cursor: 'pointer',
            display: 'flex', 
            alignItems: 'center',
                    justifyContent: 'space-between',
                    userSelect: 'none',
            padding: '0 12px',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{currentStatus.icon}</span>
                    <span style={{ color: 'var(--text)', fontWeight: 500, fontSize: 14 }}>{value}</span>
                </div>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>▼</span>
            </div>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value as LeadStatus)}
                required={required}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
                tabIndex={-1}
            >
                {statusOptions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                ))}
            </select>
            {isOpen && (
                <div
                    ref={popupRef}
                    style={{
                        position: 'fixed',
                        background: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: 8,
                        padding: 6,
                        boxShadow: '0 10px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
                        zIndex: 10000,
                        minWidth: 220,
                        maxWidth: 220,
                        maxHeight: 260,
                        overflowY: 'auto',
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {statusOptions.map((status) => {
                        const config = statusConfig[status];
                        const isSelected = value === status;
                        return (
                            <div
                                key={status}
                                onClick={() => {
                                    onChange(status);
                                    setIsOpen(false);
                                }}
                                style={{
                display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '8px 10px',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    background: isSelected ? config.bgColor : 'transparent',
                                    border: isSelected ? `1.5px solid ${config.color}` : '1.5px solid transparent',
                                    transition: 'all 0.2s',
                                    marginBottom: 2,
                                }}
                                onMouseEnter={(e) => {
                                    if (!isSelected) {
                                        e.currentTarget.style.background = '#f9fafb';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isSelected) {
                                        e.currentTarget.style.background = 'transparent';
                                    }
                                }}
                            >
                                <span style={{ fontSize: 16 }}>{config.icon}</span>
                                <span style={{ 
                                    color: isSelected ? config.color : '#111827', 
                                    fontWeight: isSelected ? 600 : 500,
                                    fontSize: 13,
                                }}>
                                    {status}
                                </span>
                                {isSelected && (
                                    <span style={{ marginLeft: 'auto', fontSize: 14, color: config.color }}>✓</span>
                                )}
                </div>
                        );
                    })}
            </div>
            )}
        </div>
    );
}

function AddLeadModal({ lead, existingLeads, onClose, onSave }: { lead?: WALead | null; existingLeads: WALead[]; onClose: () => void; onSave: (lead: WALead) => void }) {
    const [callingDate, setCallingDate] = useState<string>(lead?.callingDate && lead.callingDate.trim() ? toInputDate(new Date(lead.callingDate)) : '');
    const [customerName, setCustomerName] = useState(lead?.customerName || '');
    const [mobile, setMobile] = useState(lead?.mobile || '');
    const [callingDetail, setCallingDetail] = useState(lead?.callingDetail || '');
    const [callBackDate, setCallBackDate] = useState<string>(lead?.callBackDate && lead.callBackDate.trim() ? toInputDate(new Date(lead.callBackDate)) : '');
    const [notes, setNotes] = useState(lead?.notes || '');
    const [status, setStatus] = useState<LeadStatus>(lead?.status || 'New');
    const [platform, setPlatform] = useState<Platform | ''>(lead?.platform || '');
    const [mobileError, setMobileError] = useState<string>('');

    // Update form when lead prop changes
    useEffect(() => {
        if (lead) {
            setCallingDate(lead.callingDate && lead.callingDate.trim() ? toInputDate(new Date(lead.callingDate)) : '');
            setCustomerName(lead.customerName || '');
            setMobile(lead.mobile || '');
            setCallingDetail(lead.callingDetail || '');
            setCallBackDate(lead.callBackDate && lead.callBackDate.trim() ? toInputDate(new Date(lead.callBackDate)) : '');
            setNotes(lead.notes || '');
            setStatus(lead.status || 'New');
            setPlatform(lead.platform || '');
            setMobileError('');
        } else {
            // Reset form for new lead
            setCallingDate('');
            setCustomerName('');
            setMobile('');
            setCallingDetail('');
            setCallBackDate('');
            setNotes('');
            setStatus('New');
            setPlatform('');
            setMobileError('');
        }
    }, [lead]);

    function submit(e: React.FormEvent) {
        e.preventDefault();
        setMobileError('');
        
        // Validate mobile number format
        if (mobile.length !== 10 || !/^\d{10}$/.test(mobile)) {
            setMobileError('Mobile number must be exactly 10 digits');
            return;
        }
        
        // Check for duplicate mobile number
        const duplicateLead = existingLeads.find(l => 
            l.mobile === mobile && l.id !== lead?.id
        );
        
        if (duplicateLead) {
            setMobileError(`Mobile number already exists for customer: ${duplicateLead.customerName}`);
            return;
        }
        
        const leadData: WALead = {
            id: lead?.id || '', // Keep existing ID for updates
            customerName,
            mobile,
            callingDate: callingDate ? new Date(callingDate).toISOString() : '',
            callingDetail,
            callBackDate: callBackDate ? new Date(callBackDate).toISOString() : undefined,
            notes,
            status,
            platform: platform || undefined,
        };
        onSave(leadData);
    }

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
                onClick={(e)=>e.stopPropagation()}
                style={{ width: '100%', maxWidth: 1100, padding: 0, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottom: '1px solid var(--border)' }}>
                    <h3 style={{ margin: 0 }}>{lead ? 'Edit Lead' : 'Add Lead'}</h3>
                    <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
                </div>
                <form onSubmit={submit} style={{ display: 'grid', gap: 20, padding: 20, maxHeight: '70vh', overflow: 'auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
                        <div>
                            <label className="label">Customer Name</label>
                            <input className="input" style={{ width: '100%', marginTop: 6 }} value={customerName} onChange={(e)=>setCustomerName(e.target.value)} required />
                        </div>
                        <div>
                            <label className="label">Mobile</label>
                            <input 
                                className="input" 
                                style={{ 
                                    width: '100%', 
                                    marginTop: 6,
                                    borderColor: mobileError ? '#dc2626' : undefined
                                }} 
                                type="tel" 
                                value={mobile} 
                                onChange={(e) => {
                                    const value = e.target.value.replace(/\D/g, ''); // Remove non-numeric characters
                                    if (value.length <= 10) {
                                        setMobile(value);
                                        setMobileError(''); // Clear error when user types
                                    }
                                }}
                                onBlur={() => {
                                    // Check for duplicate on blur
                                    if (mobile.length === 10 && /^\d{10}$/.test(mobile)) {
                                        const duplicateLead = existingLeads.find(l => 
                                            l.mobile === mobile && l.id !== lead?.id
                                        );
                                        if (duplicateLead) {
                                            setMobileError(`Mobile number already exists for customer: ${duplicateLead.customerName}`);
                                        }
                                    }
                                }}
                                pattern="[0-9]{10}"
                                minLength={10}
                                maxLength={10}
                                required 
                                placeholder="Enter 10 digit mobile number"
                            />
                            {mobile && mobile.length !== 10 && !mobileError && (
                                <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>
                                    Mobile number must be exactly 10 digits
                                </div>
                            )}
                            {mobileError && (
                                <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>
                                    {mobileError}
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
                    <div>
                            <label className="label">Calling Date</label>
                            <DatePicker value={callingDate} onChange={setCallingDate} placeholder="Select calling date" />
                                    </div>
                                    <div>
                            <label className="label">Call Back Date</label>
                            <DatePicker value={callBackDate} onChange={setCallBackDate} placeholder="Select call back date" />
                                    </div>
                                    <div>
                            <label className="label">Status</label>
                            <StatusDropdown value={status} onChange={setStatus} />
                        </div>
                        <div>
                            <label className="label">Platform</label>
                            <select
                                className="input"
                                style={{ width: '100%', marginTop: 6 }}
                                value={platform}
                                onChange={(e) => setPlatform(e.target.value as Platform | '')}
                            >
                                <option value="">Select Platform</option>
                                <option value="Maatripure">Maatripure</option>
                                <option value="STW">STW</option>
                                <option value="Abandoned">Abandoned</option>
                                <option value="Whatsapp">Whatsapp</option>
                            </select>
                        </div>
                    </div>

                        <div>
                        <label className="label">Calling Detail</label>
                        <textarea className="input" style={{ width: '100%', marginTop: 6, minHeight: 80, resize: 'vertical', paddingTop: 12 }} value={callingDetail} onChange={(e)=>setCallingDetail(e.target.value)} />
                    </div>

                        <div>
                        <label className="label">Notes</label>
                        <textarea className="input" style={{ width: '100%', marginTop: 6, minHeight: 80, resize: 'vertical', paddingTop: 12 }} value={notes} onChange={(e)=>setNotes(e.target.value)} />
                    </div>

                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                        <button type="button" className="icon-btn" onClick={onClose}>Cancel</button>
                        <button type="submit" className="button" style={{ width: 'auto', padding: '0 16px' }}>
                            {lead ? 'Save Changes' : 'Create'}
                        </button>
                    </div>
                </form>
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
