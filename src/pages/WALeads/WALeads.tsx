import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../../api';
import { Spinner } from '../../components/Spinner';
import type { LeadApiRow, LeadsListResponse } from '../../types/leads';
import { parseLeadsListResponse } from '../../types/leads';
import { DatePicker as ShopifyDatePicker } from '../sales/Shopify/DatePicker';
import { FilterButton, Th, Td, toInputDate } from '../sales/Shopify/ShopifyShared';
import '../sales/Shopify/Shopify.scss';
import './WALeads.scss';

type LeadStatus = 'New' | 'Contacted' | 'Converted' | 'Not Interested' | 'No Answer' | 'Potential Customer' | 'Very Interested' | 'CBA';
type Platform = 'STW' | 'Abandoned' | 'Whatsapp';

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

const LEAD_STATUSES: LeadStatus[] = [
    'New',
    'Contacted',
    'Converted',
    'Not Interested',
    'No Answer',
    'Potential Customer',
    'Very Interested',
    'CBA',
];

const MIN_PHONE_SEARCH_DIGITS = 10;
const ENGAGE_TOKEN_STORAGE_KEY = 'wa_leads_engage_token';

const ENGAGE_IMPORT_PAGE_NUMBERS = Array.from({ length: 20 }, (_, i) => i + 1);
const WHATSAPP_PRODUCT_LINKS = {
    gir500: {
        label: 'Gir Cow Ghee - 500ml',
        url: 'https://purityharvest.in/products/a2-gir-cow-ghee?variant=43607987585117',
    },
    gir1: {
        label: 'Gir Cow Ghee - 1 ltr',
        url: 'https://purityharvest.in/products/a2-gir-cow-ghee?variant=43607975428189',
    },
    gir2: {
        label: 'Gir Cow Ghee - 2 ltr',
        url: 'https://purityharvest.in/products/a2-gir-cow-ghee?variant=43607988207709',
    },
    gir5: {
        label: 'Gir Cow Ghee - 5 ltr',
        url: 'https://purityharvest.in/products/a2-gir-cow-ghee?variant=43607988797533',
    },
    buffalo500: {
        label: 'Buffalo Ghee - 500ml',
        url: 'https://purityharvest.in/products/pure-and-natural-a2-buffalo-ghee-crafted-using-traditional-vedic-bilona-method-1?variant=43429726421085',
    },
    buffalo1: {
        label: 'Buffalo Ghee - 1 ltr',
        url: 'https://purityharvest.in/products/pure-and-natural-a2-buffalo-ghee-crafted-using-traditional-vedic-bilona-method-1?variant=43416353898589',
    },
    buffalo2: {
        label: 'Buffalo Ghee - 2 ltr',
        url: 'https://purityharvest.in/products/pure-and-natural-a2-buffalo-ghee-crafted-using-traditional-vedic-bilona-method-1?variant=43429726453853',
    },
    buffalo5: {
        label: 'Buffalo Ghee - 5 ltr',
        url: 'https://purityharvest.in/products/pure-and-natural-a2-buffalo-ghee-crafted-using-traditional-vedic-bilona-method-1?variant=43429726486621',
    },
    desi500: {
        label: 'Desi Cow Ghee - 500ml',
        url: 'https://purityharvest.in/products/pure-and-natural-a2-desi-cow-ghee-crafted-using-traditional-vedic-bilona-method?variant=43416440799325',
    },
    desi1: {
        label: 'Desi Cow Ghee - 1 ltr',
        url: 'https://purityharvest.in/products/pure-and-natural-a2-desi-cow-ghee-crafted-using-traditional-vedic-bilona-method?variant=43413517860957',
    },
    desi2: {
        label: 'Desi Cow Ghee - 2 ltr',
        url: 'https://purityharvest.in/products/pure-and-natural-a2-desi-cow-ghee-crafted-using-traditional-vedic-bilona-method?variant=43416440832093',
    },
    desi5: {
        label: 'Desi Cow Ghee - 5 ltr',
        url: 'https://purityharvest.in/products/pure-and-natural-a2-desi-cow-ghee-crafted-using-traditional-vedic-bilona-method?variant=43428579737693',
    },
} as const;

function digitsOnly(s: string): string {
    return s.replace(/\D/g, '');
}

function formatLeadDate(iso: string | null | undefined): string {
    if (iso == null || iso === '') return '—';
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return '—';
    return new Date(t).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

/** Same pattern as `ShopifyOrdersTable` — clipboard API with textarea fallback. */
async function copyTextToClipboard(text: string): Promise<boolean> {
    const trimmed = text.trim();
    if (!trimmed) return false;
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(trimmed);
            return true;
        }
    } catch {
        /* fall through */
    }
    try {
        const ta = document.createElement('textarea');
        ta.value = trimmed;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    } catch {
        return false;
    }
}

const WA_LEADS_NODATE_GROUP_KEY = '__nodate__';

function localDateKeyFromLeadRow(row: LeadApiRow): string {
    const raw = row.time?.trim() ? row.time : row.createdAt;
    if (!raw) return WA_LEADS_NODATE_GROUP_KEY;
    const t = Date.parse(raw);
    if (!Number.isFinite(t)) return WA_LEADS_NODATE_GROUP_KEY;
    const d = new Date(t);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function formatWaLeadsDateGroupTitle(dateKey: string): string {
    if (dateKey === WA_LEADS_NODATE_GROUP_KEY) return 'No lead date';
    const parts = dateKey.split('-').map((x) => parseInt(x, 10));
    const [y, mo, da] = parts;
    if (!y || !mo || !da) return dateKey;
    const d = new Date(y, mo - 1, da);
    return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function leadStatusModifier(status: LeadStatus): string {
    const map: Record<LeadStatus, string> = {
        New: 'new',
        Contacted: 'contacted',
        Converted: 'converted',
        'Not Interested': 'not-interested',
        'No Answer': 'no-answer',
        'Potential Customer': 'potential',
        'Very Interested': 'very-interested',
        CBA: 'cba',
    };
    return map[status];
}

type UiRange = 'all' | 'today' | 'yesterday' | 'last7' | 'currentMonth' | 'lastMonth' | 'custom';

function transformWALeadItem(item: Record<string, unknown>): WALead {
    const statusOk = (s: unknown): s is LeadStatus =>
        typeof s === 'string' && (LEAD_STATUSES as string[]).includes(s);

    if (item.customerName && item.mobile) {
        return {
            id: String(item.id ?? ''),
            customerName: String(item.customerName ?? ''),
            mobile: String(item.mobile ?? ''),
            callingDate: String(item.callingDate ?? ''),
            callingDetail: String(item.callingDetail ?? ''),
            callBackDate: item.callBackDate != null ? String(item.callBackDate) : undefined,
            notes: String(item.notes ?? ''),
            status: statusOk(item.status) ? item.status : 'New',
            platform: item.platform as Platform | undefined,
        };
    }
    return {
        id: String(item.id ?? ''),
        customerName: String(item.customer ?? ''),
        mobile: String(item.customerPhone ?? ''),
        callingDate: String(item.date ?? item.callingDate ?? ''),
        callingDetail: String(item.callingDetail ?? ''),
        callBackDate: item.callBackDate != null ? String(item.callBackDate) : undefined,
        notes: String(item.notes ?? ''),
        status: statusOk(item.status) ? item.status : 'New',
        platform: item.platform as Platform | undefined,
    };
}

export default function WALeads() {
    const [range, setRange] = useState<UiRange>('currentMonth');
    const [phoneSearchInput, setPhoneSearchInput] = useState('');
    const [customStart, setCustomStart] = useState<string>(toInputDate(new Date()));
    const [customEnd, setCustomEnd] = useState<string>(toInputDate(new Date()));
    const [appliedCustomStart, setAppliedCustomStart] = useState<string>(toInputDate(new Date()));
    const [appliedCustomEnd, setAppliedCustomEnd] = useState<string>(toInputDate(new Date()));
    const [showCustom, setShowCustom] = useState(false);
    const customBtnRef = useRef<HTMLButtonElement | null>(null);
    const popoverRef = useRef<HTMLDivElement | null>(null);

    const [showAddLead, setShowAddLead] = useState(false);
    const [editingLead, setEditingLead] = useState<WALead | null>(null);
    const [leadsRows, setLeadsRows] = useState<LeadApiRow[]>([]);
    const [leadsMeta, setLeadsMeta] = useState<LeadsListResponse | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(500);
    const [loading, setLoading] = useState(true);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [showEngageImportModal, setShowEngageImportModal] = useState(false);
    const [engageToken, setEngageToken] = useState<string>(() => {
        if (typeof window === 'undefined') return '';
        try {
            return window.localStorage.getItem(ENGAGE_TOKEN_STORAGE_KEY) ?? '';
        } catch {
            return '';
        }
    });
    const [engageImportLoadingPage, setEngageImportLoadingPage] = useState<number | null>(null);
    const [engageFetchAllLoading, setEngageFetchAllLoading] = useState(false);
    const [showEngageTokenExpiredModal, setShowEngageTokenExpiredModal] = useState(false);
    const [copiedLeadId, setCopiedLeadId] = useState<string | null>(null);
    const [showWhatsAppProductModal, setShowWhatsAppProductModal] = useState(false);
    const [selectedWhatsAppPhone, setSelectedWhatsAppPhone] = useState('');
    const [selectedWhatsAppCustomerName, setSelectedWhatsAppCustomerName] = useState('');
    const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const flashCopied = useCallback((leadId: string) => {
        if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
        setCopiedLeadId(leadId);
        copiedTimerRef.current = setTimeout(() => {
            setCopiedLeadId(null);
            copiedTimerRef.current = null;
        }, 2000);
    }, []);

    useEffect(() => {
        return () => {
            if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
        };
    }, []);

    function showToast(message: string, type: 'success' | 'error' | 'delete' = 'success') {
        const id = `toast-${Date.now()}-${Math.random()}`;
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3000);
    }

    const getLocalDateString = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const dateRangeForApi = useMemo((): { from: string; to: string } => {
        const now = new Date();
        const todayStr = getLocalDateString(now);
        if (range === 'all') {
            return { from: '2024-01-01', to: todayStr };
        }
        if (range === 'custom') {
            return { from: appliedCustomStart, to: appliedCustomEnd };
        }
        if (range === 'today') {
            return { from: todayStr, to: todayStr };
        }
        if (range === 'yesterday') {
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = getLocalDateString(yesterday);
            return { from: yesterdayStr, to: yesterdayStr };
        }
        if (range === 'last7') {
            const start = new Date(now);
            start.setDate(start.getDate() - 6);
            return { from: getLocalDateString(start), to: todayStr };
        }
        if (range === 'currentMonth') {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            return { from: getLocalDateString(start), to: todayStr };
        }
        if (range === 'lastMonth') {
            const year = now.getFullYear();
            const month = now.getMonth();
            const start = new Date(year, month - 1, 1);
            const end = new Date(year, month, 0);
            return { from: getLocalDateString(start), to: getLocalDateString(end) };
        }
        return { from: '2024-01-01', to: todayStr };
    }, [range, appliedCustomStart, appliedCustomEnd]);

    const loadLeads = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (range !== 'all') {
                params.set('from', dateRangeForApi.from);
                params.set('to', dateRangeForApi.to);
            }
            params.set('page', String(page));
            params.set('limit', String(pageSize));
            const res = await apiFetch(`/api/leads?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to load Leads');
            const data: unknown = await res.json();
            let parsed = parseLeadsListResponse(data);
            if (!parsed && Array.isArray(data)) {
                const wal = data.map((item) => transformWALeadItem(item as Record<string, unknown>));
                const rows: LeadApiRow[] = wal.map((w) => ({
                    _id: w.id,
                    name: w.customerName,
                    phoneNumber: digitsOnly(w.mobile).slice(-10) || digitsOnly(w.mobile),
                    countryCode: '+91',
                    message: [w.notes, w.callingDetail].filter(Boolean).join('\n') || '',
                    time: w.callingDate?.trim() ? w.callingDate : null,
                    createdBy: { _id: '', name: '—' },
                    updatedBy: { _id: '', name: '—' },
                    createdAt: w.callingDate || new Date().toISOString(),
                    updatedAt: w.callingDate || new Date().toISOString(),
                    __v: 0,
                }));
                parsed = {
                    count: rows.length,
                    total: rows.length,
                    page: 1,
                    limit: Math.max(rows.length, 1),
                    totalPages: 1,
                    rows,
                };
            }
            if (parsed) {
                setLeadsRows(parsed.rows);
                setLeadsMeta(parsed);
            } else {
                setLeadsRows([]);
                setLeadsMeta(null);
            }
        } catch (err) {
            console.error('Failed to load Leads', err);
            setLeadsRows([]);
            setLeadsMeta(null);
        } finally {
            setLoading(false);
        }
    }, [range, dateRangeForApi.from, dateRangeForApi.to, page, pageSize]);

    useEffect(() => {
        void loadLeads();
    }, [loadLeads]);

    useEffect(() => {
        function onDocClick(e: MouseEvent) {
            if (!showCustom) return;
            const target = e.target as Node;
            if (popoverRef.current?.contains(target)) return;
            if (customBtnRef.current?.contains(target)) return;
            setShowCustom(false);
        }
        document.addEventListener('click', onDocClick);
        return () => document.removeEventListener('click', onDocClick);
    }, [showCustom]);

    useEffect(() => {
        if (!showEngageImportModal && !showEngageTokenExpiredModal && !showWhatsAppProductModal) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [showEngageImportModal, showEngageTokenExpiredModal, showWhatsAppProductModal]);

    useLayoutEffect(() => {
        if (!showCustom) return;
        const pop = popoverRef.current;
        const btn = customBtnRef.current;
        if (pop && btn) {
            pop.style.left = `${btn.offsetLeft}px`;
        }
    }, [showCustom, range]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(ENGAGE_TOKEN_STORAGE_KEY, engageToken);
        } catch {
            // Ignore localStorage write failures (private mode / blocked storage)
        }
    }, [engageToken]);

    const runEngageImport = useCallback(
        async (page: number) => {
            const token = engageToken.trim();
            if (!token) {
                showToast('Enter your Engage token', 'error');
                return;
            }
            setEngageImportLoadingPage(page);
            try {
                const endpoint =
                    page === 1
                        ? '/api/leads/import-engage'
                        : `/api/leads/import-engage?page=${encodeURIComponent(page)}`;
                const res = await apiFetch(endpoint, {
                    method: 'POST',
                    headers: { 'x-engage-token': token },
                });
                const data: unknown = await res.json().catch(() => null);
                if (!res.ok) {
                    const msg =
                        data && typeof data === 'object' && data !== null && 'message' in data
                            ? String((data as { message?: unknown }).message)
                            : `Request failed (${res.status})`;
                    throw new Error(msg);
                }
                showToast(`Engage import page ${page} completed`, 'success');
                await loadLeads();
            } catch (err) {
                console.error('Engage import failed', err);
                showToast(err instanceof Error ? err.message : 'Engage import failed', 'error');
            } finally {
                setEngageImportLoadingPage(null);
            }
        },
        [engageToken, loadLeads],
    );

    const engageImportBusy = engageImportLoadingPage !== null || engageFetchAllLoading;

    const runEngageFetchAll = useCallback(async () => {
        const token = engageToken.trim();
        if (!token) {
            showToast('Enter your Engage token', 'error');
            return;
        }
        setEngageFetchAllLoading(true);
        try {
            const res = await apiFetch('/api/leads/import-engage?mode=full', {
                method: 'POST',
                headers: { 'x-engage-token': token },
            });
            if (!res.ok) {
                setShowEngageTokenExpiredModal(true);
                return;
            }
            showToast('Engage fetch all completed', 'success');
            await loadLeads();
        } catch (err) {
            console.error('Engage fetch all failed', err);
            showToast(err instanceof Error ? err.message : 'Engage fetch all failed', 'error');
        } finally {
            setEngageFetchAllLoading(false);
        }
    }, [engageToken, loadLeads]);

    const openWhatsAppProductPicker = useCallback((phoneDigits: string, customerName: string) => {
        if (!phoneDigits) {
            showToast('No phone number for WhatsApp', 'error');
            return;
        }
        setSelectedWhatsAppPhone(phoneDigits);
        setSelectedWhatsAppCustomerName(customerName || 'Customer');
        setShowWhatsAppProductModal(true);
    }, []);

    const sendWhatsAppProductLink = useCallback(
        (linkKey: keyof typeof WHATSAPP_PRODUCT_LINKS) => {
            if (!selectedWhatsAppPhone) return;
            const link = WHATSAPP_PRODUCT_LINKS[linkKey];
            const text = `Hello Sir/Madam,\nhere is the product link for ${link.label}:\n${link.url}`;
            window.open(
                `https://wa.me/${selectedWhatsAppPhone}?text=${encodeURIComponent(text)}`,
                '_blank',
                'noopener,noreferrer',
            );
            setShowWhatsAppProductModal(false);
        },
        [selectedWhatsAppPhone, selectedWhatsAppCustomerName],
    );

    const sendWhatsAppWithoutProductLink = useCallback(() => {
        if (!selectedWhatsAppPhone) return;
        const text = `Hello Sir/Madam,

My name is Sarita Yadav, Founder of *Purity Harvest*.

If you're looking for pure Desi Cow Ghee, we'd love to serve you. Our ghee is 100% in-house made using traditional methods, with a guarantee of purity for your family's health 💛`;
        window.open(
            `https://wa.me/${selectedWhatsAppPhone}?text=${encodeURIComponent(text)}`,
            '_blank',
            'noopener,noreferrer',
        );
        setShowWhatsAppProductModal(false);
    }, [selectedWhatsAppPhone, selectedWhatsAppCustomerName]);

    const phoneDigits = useMemo(() => digitsOnly(phoneSearchInput), [phoneSearchInput]);
    const isPhoneSearch = phoneDigits.length === MIN_PHONE_SEARCH_DIGITS;

    const existingLeadsForModal = useMemo((): WALead[] => {
        return leadsRows.map((r) => {
            const mob = digitsOnly(r.phoneNumber).slice(-10) || r.phoneNumber;
            return {
                id: r._id,
                customerName: r.name,
                mobile: mob.length === 10 ? mob : digitsOnly(r.phoneNumber) || r.phoneNumber,
                callingDate: '',
                callingDetail: '',
                notes: '',
                status: 'New',
            };
        });
    }, [leadsRows]);

    const sortedLeadRows = useMemo(() => {
        return [...leadsRows].sort((a, b) => {
            const ta = Date.parse(a.createdAt);
            const tb = Date.parse(b.createdAt);
            if (!Number.isFinite(ta) && !Number.isFinite(tb)) return 0;
            if (!Number.isFinite(ta)) return 1;
            if (!Number.isFinite(tb)) return -1;
            return tb - ta;
        });
    }, [leadsRows]);

    const filtered = useMemo(() => {
        return sortedLeadRows.filter((row) => {
            const mobileDigits = digitsOnly(row.phoneNumber).slice(-10);
            const matchesPhone =
                !isPhoneSearch || (mobileDigits.length >= MIN_PHONE_SEARCH_DIGITS && mobileDigits.endsWith(phoneDigits));
            return matchesPhone;
        });
    }, [sortedLeadRows, phoneDigits, isPhoneSearch]);

    const leadsGroupedByDate = useMemo((): { dateKey: string; rows: LeadApiRow[] }[] => {
        const map = new Map<string, LeadApiRow[]>();
        for (const row of filtered) {
            const k = localDateKeyFromLeadRow(row);
            const list = map.get(k);
            if (list) list.push(row);
            else map.set(k, [row]);
        }
        const keys = [...map.keys()].sort((a, b) => {
            if (a === WA_LEADS_NODATE_GROUP_KEY) return 1;
            if (b === WA_LEADS_NODATE_GROUP_KEY) return -1;
            return b.localeCompare(a);
        });
        for (const k of keys) {
            const list = map.get(k)!;
            list.sort((a, b) => {
                const ta = Date.parse(a.createdAt);
                const tb = Date.parse(b.createdAt);
                return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
            });
        }
        return keys.map((dateKey) => ({ dateKey, rows: map.get(dateKey)! }));
    }, [filtered]);

    const metrics = useMemo(() => {
        const totalInRange = leadsMeta?.total ?? 0;
        const rowsOnPage = leadsMeta?.count ?? leadsRows.length;
        const totalLeads = isPhoneSearch ? filtered.length : totalInRange;
        return {
            totalLeads,
            rowsOnPage,
            page: leadsMeta?.page ?? page,
            totalPages: leadsMeta?.totalPages ?? 1,
            perPage: leadsMeta?.limit ?? pageSize,
            phoneMatchesOnPage: isPhoneSearch ? filtered.length : rowsOnPage,
        };
    }, [filtered.length, isPhoneSearch, leadsMeta, leadsRows.length, page, pageSize]);

    return (
        <section className="shopify-page wa-leads">
            {loading ? <Spinner overlay fixed message="Loading leads…" /> : null}
            <ToastContainer toasts={toasts} />
            <div className="card shopify-header-card">
                <div className="shopify-header-title">Leads</div>
                <div className="shopify-header-main">
                    <div className="shopify-header-filters">
                        <div className="filter-group shopify-header-filter-group">
                            <FilterButton active={range === 'all'} onClick={() => { setPage(1); setRange('all'); setShowCustom(false); }}>
                                All
                            </FilterButton>
                            <FilterButton active={range === 'today'} onClick={() => { setPage(1); setRange('today'); setShowCustom(false); }}>
                                Today
                            </FilterButton>
                            <FilterButton active={range === 'yesterday'} onClick={() => { setPage(1); setRange('yesterday'); setShowCustom(false); }}>
                                Yesterday
                            </FilterButton>
                            <FilterButton active={range === 'last7'} onClick={() => { setPage(1); setRange('last7'); setShowCustom(false); }}>
                                Last 7 days
                            </FilterButton>
                            <FilterButton active={range === 'currentMonth'} onClick={() => { setPage(1); setRange('currentMonth'); setShowCustom(false); }}>
                                Current Month
                            </FilterButton>
                            <FilterButton active={range === 'lastMonth'} onClick={() => { setPage(1); setRange('lastMonth'); setShowCustom(false); }}>
                                Last Month
                            </FilterButton>
                            <FilterButton
                                refEl={customBtnRef}
                                active={range === 'custom' || showCustom}
                                onClick={() => {
                                    if (!showCustom) {
                                        setCustomStart(appliedCustomStart);
                                        setCustomEnd(appliedCustomEnd);
                                    }
                                    setShowCustom((v) => !v);
                                }}
                            >
                                Custom
                            </FilterButton>
                        </div>
                        <div className="shopify-header-spacer" />
                        <div className="shopify-search-wrapper">
                            <span className="shopify-search-icon" aria-hidden>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8" />
                                    <path d="m21 21-4.35-4.35" />
                                </svg>
                            </span>
                            <input
                                className="input shopify-search-input"
                                type="search"
                                inputMode="numeric"
                                autoComplete="off"
                                maxLength={MIN_PHONE_SEARCH_DIGITS}
                                placeholder={`Enter ${MIN_PHONE_SEARCH_DIGITS} phone digits to search`}
                                aria-label={`Phone search; enter ${MIN_PHONE_SEARCH_DIGITS} digits`}
                                value={phoneSearchInput}
                                onChange={(e) => {
                                    const digits = e.target.value.replace(/\D/g, '').slice(0, MIN_PHONE_SEARCH_DIGITS);
                                    setPhoneSearchInput(digits);
                                }}
                            />
                        </div>
                        <div className="shopify-header-actions">
                            <button
                                type="button"
                                className="button shopify-add-order-btn"
                                onClick={() => {
                                    setEditingLead(null);
                                    setShowAddLead(true);
                                }}
                            >
                                <span>+</span> Add Lead
                            </button>
                            <button
                                className="button shopify-refresh-btn"
                                type="button"
                                title="Import leads from Engage"
                                onClick={() => setShowEngageImportModal(true)}
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <polyline points="23 4 23 10 17 10" />
                                    <polyline points="1 20 1 14 7 14" />
                                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
                                    <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    {showCustom ? (
                        <div ref={popoverRef} className="date-range-popover shopify-date-range-popover">
                            <div className="shopify-date-range-inner">
                                <div className="shopify-date-range-field">
                                    <label className="label shopify-date-range-label">Start</label>
                                    <div className="shopify-date-range-picker">
                                        <ShopifyDatePicker value={customStart} onChange={setCustomStart} placeholder="Select start date" />
                                    </div>
                                </div>
                                <span className="shopify-date-range-separator">—</span>
                                <div className="shopify-date-range-field">
                                    <label className="label shopify-date-range-label">End</label>
                                    <div className="shopify-date-range-picker">
                                        <ShopifyDatePicker value={customEnd} onChange={setCustomEnd} placeholder="Select end date" />
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="button shopify-date-range-apply"
                                    onClick={() => {
                                        setPage(1);
                                        setAppliedCustomStart(customStart);
                                        setAppliedCustomEnd(customEnd);
                                        setRange('custom');
                                        setShowCustom(false);
                                    }}
                                >
                                    Apply
                                </button>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
            <div className="card wa-leads__metrics-card">
                <div className="admin-metrics-row wa-leads-metrics">
                    <ModernMetricItem
                        icon="👥"
                        label={isPhoneSearch ? 'Matches (this page)' : 'Total in range'}
                        value={metrics.totalLeads.toLocaleString()}
                        isLast={false}
                        isEven={false}
                    />
                    <ModernMetricItem
                        icon="📄"
                        label="Rows (this page)"
                        value={metrics.rowsOnPage.toLocaleString()}
                        isLast={false}
                        isEven={true}
                    />
                    <ModernMetricItem
                        icon="🔢"
                        label="Page"
                        value={`${metrics.page} / ${metrics.totalPages}`}
                        isLast={false}
                        isEven={false}
                    />
                    <ModernMetricItem
                        icon="⚙️"
                        label="Rows per page"
                        value={metrics.perPage.toLocaleString()}
                        isLast={false}
                        isEven={true}
                    />
                    <ModernMetricItem
                        icon="📱"
                        label={isPhoneSearch ? 'Phone filter' : 'List'}
                        value={isPhoneSearch ? metrics.phoneMatchesOnPage.toLocaleString() : '—'}
                        isLast={true}
                        isEven={false}
                    />
                </div>
            </div>

            <div className="card wa-leads__table-card">
                <div className={`table-scroll-wrapper wa-leads__table-scroll${loading ? ' wa-leads__table-scroll--loading' : ''}`}>
                    <table className="orders-table shopify-orders-table wa-leads__table">
                        <colgroup>
                            <col />
                            <col />
                            <col />
                            <col />
                            <col />
                        </colgroup>
                        <thead>
                            <tr>
                                <Th align="center">Phone</Th>
                                <Th>Name</Th>
                                <Th>Message</Th>
                                <Th align="center">WhatsApp</Th>
                                <Th>Lead Date</Th>
                            </tr>
                        </thead>
                        <tbody>
                            {!loading && filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="shopify-td wa-leads__empty-cell">
                                        No leads in this range{isPhoneSearch ? ' matching this phone on the current page' : ''}. Adjust filters or import from Engage.
                                    </td>
                                </tr>
                            ) : loading ? (
                                <tr aria-hidden>
                                    <td colSpan={5} className="shopify-td wa-leads__skeleton-cell" />
                                </tr>
                            ) : (
                                (() => {
                                    let dataRowIndex = 0;
                                    return leadsGroupedByDate.flatMap(({ dateKey, rows: groupRows }) => {
                                        const headerTr = (
                                            <tr key={`wa-date-${dateKey}`} className="wa-leads__date-group-row">
                                                <td colSpan={5} className="shopify-td wa-leads__date-group-header">
                                                    <div className="wa-leads__date-group-inner">
                                                        <span className="wa-leads__date-group-title">
                                                            {formatWaLeadsDateGroupTitle(dateKey)}
                                                        </span>
                                                        <span className="wa-leads__date-group-meta">
                                                            {groupRows.length} lead{groupRows.length === 1 ? '' : 's'}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                        const dataTrs = groupRows.map((row) => {
                                            const isEven = dataRowIndex % 2 === 1;
                                            dataRowIndex += 1;
                                            const e164ish = `${row.countryCode}${row.phoneNumber}`.replace(/\s/g, '');
                                            const displayPhone = `${row.countryCode} ${row.phoneNumber}`.trim();
                                            const rowPhoneDigits = digitsOnly(row.phoneNumber);
                                            const canCall = rowPhoneDigits.length > 0;
                                            const waPhoneDigits = digitsOnly(`${row.countryCode}${row.phoneNumber}`);
                                            const canWhatsApp = waPhoneDigits.length > 0;
                                            const callIcon = (
                                                <svg
                                                    className="wa-leads-call-btn__icon"
                                                    width="24"
                                                    height="24"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    aria-hidden
                                                >
                                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                                </svg>
                                            );
                                            return (
                                                <tr
                                                    key={row._id}
                                                    className={`wa-leads__row${isEven ? ' wa-leads__row--even' : ''}`}
                                                >
                                                    <Td className="wa-leads__td-call">
                                                        {canCall ? (
                                                            <a
                                                                className="wa-leads-call-btn"
                                                                href={`tel:${e164ish}`}
                                                                title={`Call ${row.name || displayPhone}`}
                                                                aria-label={`Call ${row.name || 'lead'} at ${displayPhone}`}
                                                            >
                                                                {callIcon}
                                                            </a>
                                                        ) : (
                                                            <span
                                                                className="wa-leads-call-btn wa-leads-call-btn--disabled"
                                                                title="No phone number"
                                                                aria-label="No phone number to call"
                                                            >
                                                                {callIcon}
                                                            </span>
                                                        )}
                                                    </Td>
                                                    <Td>
                                                        <div className="wa-leads-customer-cell">
                                                            <span className="wa-leads-customer-name">{row.name || '—'}</span>
                                                            {canCall ? (
                                                                copiedLeadId === row._id ? (
                                                                    <span
                                                                        className="shopify-customer-phone-copied"
                                                                        role="status"
                                                                        aria-live="polite"
                                                                    >
                                                                        Copied
                                                                    </span>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        className="shopify-customer-phone shopify-customer-phone--copy"
                                                                        title="Click to copy number"
                                                                        aria-label={`Copy phone number ${displayPhone}`}
                                                                        onClick={async (e) => {
                                                                            e.stopPropagation();
                                                                            const toCopy = `${row.countryCode}${row.phoneNumber}`.replace(
                                                                                /\s/g,
                                                                                '',
                                                                            );
                                                                            const ok = await copyTextToClipboard(toCopy);
                                                                            if (ok) flashCopied(row._id);
                                                                            else showToast('Could not copy', 'error');
                                                                        }}
                                                                    >
                                                                        {displayPhone}
                                                                    </button>
                                                                )
                                                            ) : (
                                                                <span className="wa-leads-customer-tel wa-leads-customer-tel--na">
                                                                    —
                                                                </span>
                                                            )}
                                                        </div>
                                                    </Td>
                                                    <Td className="wa-leads__msg-cell">
                                                        <span className="wa-leads__msg-text">
                                                            {row.message != null && row.message.trim() !== ''
                                                                ? row.message
                                                                : '—'}
                                                        </span>
                                                    </Td>
                                                    <Td className="wa-leads__td-whatsapp">
                                                        {canWhatsApp ? (
                                                            <button
                                                                type="button"
                                                                className="wa-leads-whatsapp-btn"
                                                                title={`Choose product link for ${row.name || displayPhone}`}
                                                                aria-label={`Choose product link for ${row.name || displayPhone}`}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    openWhatsAppProductPicker(waPhoneDigits, row.name || 'Customer');
                                                                }}
                                                            >
                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                                                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                                                </svg>
                                                            </button>
                                                        ) : (
                                                            <span
                                                                className="wa-leads-whatsapp-btn wa-leads-whatsapp-btn--disabled"
                                                                aria-label="No phone number for WhatsApp"
                                                            >
                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                                                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                                                </svg>
                                                            </span>
                                                        )}
                                                    </Td>
                                                    <Td>{formatLeadDate(row.time)}</Td>
                                                </tr>
                                            );
                                        });
                                        return [headerTr, ...dataTrs];
                                    });
                                })()
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <footer className="shopify-pagination" aria-label="Leads pagination">
                <div className="shopify-pagination__range">
                    {loading && !isPhoneSearch ? (
                        <span className="shopify-pagination__muted">Loading…</span>
                    ) : isPhoneSearch ? (
                        <>
                            Phone filter: showing{' '}
                            <strong>
                                {filtered.length === 0 ? 0 : 1}–{filtered.length}
                            </strong>{' '}
                            of <strong>{(leadsMeta?.count ?? leadsRows.length).toLocaleString()}</strong> on this page
                        </>
                    ) : leadsMeta ? (
                        <>
                            Showing{' '}
                            <strong>
                                {leadsMeta.total === 0
                                    ? 0
                                    : (leadsMeta.page - 1) * leadsMeta.limit + 1}
                                –
                                {Math.min(leadsMeta.page * leadsMeta.limit, leadsMeta.total)}
                            </strong>{' '}
                            of <strong>{leadsMeta.total.toLocaleString()}</strong>
                        </>
                    ) : (
                        <span className="shopify-pagination__muted">Total unavailable</span>
                    )}
                </div>
                <label className="shopify-pagination__size">
                    <span className="shopify-pagination__size-lab">Rows per page</span>
                    <select
                        className="shopify-pagination__select"
                        value={pageSize}
                        disabled={loading || isPhoneSearch}
                        aria-label="Rows per page"
                        onChange={(e) => {
                            setPageSize(Number(e.target.value));
                            setPage(1);
                        }}
                    >
                        {[20, 50, 100, 250, 500].map((n) => (
                            <option key={n} value={n}>
                                {n}
                            </option>
                        ))}
                    </select>
                </label>
                <div className="shopify-pagination__nav">
                    <button
                        type="button"
                        className="shopify-page-btn"
                        disabled={loading || isPhoneSearch || page <= 1}
                        onClick={() => setPage(1)}
                    >
                        First
                    </button>
                    <button
                        type="button"
                        className="shopify-page-btn"
                        disabled={loading || isPhoneSearch || page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                        Prev
                    </button>
                    <span className="shopify-pagination__page-of">
                        Page <strong>{isPhoneSearch ? 1 : page}</strong> of{' '}
                        <strong>{isPhoneSearch ? 1 : Math.max(1, leadsMeta?.totalPages ?? 1)}</strong>
                    </span>
                    <button
                        type="button"
                        className="shopify-page-btn"
                        disabled={loading || isPhoneSearch || page >= Math.max(1, leadsMeta?.totalPages ?? 1)}
                        onClick={() => setPage((p) => p + 1)}
                    >
                        Next
                    </button>
                    <button
                        type="button"
                        className="shopify-page-btn"
                        disabled={loading || isPhoneSearch || page >= Math.max(1, leadsMeta?.totalPages ?? 1)}
                        onClick={() => setPage(Math.max(1, leadsMeta?.totalPages ?? 1))}
                    >
                        Last
                    </button>
                </div>
            </footer>

            {showWhatsAppProductModal ? (
                <div
                    className="wa-leads-wa-product-overlay"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="wa-leads-wa-product-title"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setShowWhatsAppProductModal(false);
                    }}
                >
                    <div className="card wa-leads-wa-product-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="wa-leads-wa-product-modal__head">
                            <h3 id="wa-leads-wa-product-title" className="wa-leads-wa-product-modal__title">
                                Select product link to send
                            </h3>
                            <button
                                type="button"
                                className="wa-leads-wa-product-modal__close"
                                aria-label="Close"
                                onClick={() => setShowWhatsAppProductModal(false)}
                            >
                                ✕
                            </button>
                        </div>
                        <p className="wa-leads-wa-product-modal__sub">Choose the link you want to send on WhatsApp.</p>
                        <div className="wa-leads-wa-product-modal__group">
                            <div className="wa-leads-wa-product-modal__group-title">Gir Cow Ghee</div>
                            <div className="wa-leads-wa-product-modal__grid">
                                <button type="button" className="button wa-leads-wa-product-modal__btn" onClick={() => sendWhatsAppProductLink('gir500')}>500ml</button>
                                <button type="button" className="button wa-leads-wa-product-modal__btn" onClick={() => sendWhatsAppProductLink('gir1')}>1 ltr</button>
                                <button type="button" className="button wa-leads-wa-product-modal__btn" onClick={() => sendWhatsAppProductLink('gir2')}>2 ltr</button>
                                <button type="button" className="button wa-leads-wa-product-modal__btn" onClick={() => sendWhatsAppProductLink('gir5')}>5 ltr</button>
                            </div>
                        </div>
                        <div className="wa-leads-wa-product-modal__group">
                            <div className="wa-leads-wa-product-modal__group-title">Buffalo Ghee</div>
                            <div className="wa-leads-wa-product-modal__grid">
                                <button type="button" className="button wa-leads-wa-product-modal__btn" onClick={() => sendWhatsAppProductLink('buffalo500')}>500ml</button>
                                <button type="button" className="button wa-leads-wa-product-modal__btn" onClick={() => sendWhatsAppProductLink('buffalo1')}>1 ltr</button>
                                <button type="button" className="button wa-leads-wa-product-modal__btn" onClick={() => sendWhatsAppProductLink('buffalo2')}>2 ltr</button>
                                <button type="button" className="button wa-leads-wa-product-modal__btn" onClick={() => sendWhatsAppProductLink('buffalo5')}>5 ltr</button>
                            </div>
                        </div>
                        <div className="wa-leads-wa-product-modal__group">
                            <div className="wa-leads-wa-product-modal__group-title">Desi Cow Ghee</div>
                            <div className="wa-leads-wa-product-modal__grid">
                                <button type="button" className="button wa-leads-wa-product-modal__btn" onClick={() => sendWhatsAppProductLink('desi500')}>500ml</button>
                                <button type="button" className="button wa-leads-wa-product-modal__btn" onClick={() => sendWhatsAppProductLink('desi1')}>1 ltr</button>
                                <button type="button" className="button wa-leads-wa-product-modal__btn" onClick={() => sendWhatsAppProductLink('desi2')}>2 ltr</button>
                                <button type="button" className="button wa-leads-wa-product-modal__btn" onClick={() => sendWhatsAppProductLink('desi5')}>5 ltr</button>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="button wa-leads-wa-product-modal__btn wa-leads-wa-product-modal__btn--no-link"
                            onClick={sendWhatsAppWithoutProductLink}
                        >
                            Without Product Link
                        </button>
                    </div>
                </div>
            ) : null}

            {showEngageImportModal ? (
                <div
                    className="wa-leads-engage-backdrop"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="wa-leads-engage-title"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setShowEngageImportModal(false);
                    }}
                >
                    <div className="card wa-leads-engage-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="wa-leads-engage__header">
                            <h2 id="wa-leads-engage-title" className="wa-leads-engage__title">
                                Import from Engage
                            </h2>
                            <button
                                type="button"
                                className="icon-btn"
                                aria-label="Close"
                                onClick={() => setShowEngageImportModal(false)}
                            >
                                ✕
                            </button>
                        </div>
                        <p className="wa-leads-engage__help">
                            Paste your Engage token. Page buttons send{' '}
                            <code className="wa-leads-engage__code">POST /api/leads/import-engage?page=…</code>;{' '}
                            <strong>Fetch All</strong> sends{' '}
                            <code className="wa-leads-engage__code">POST /api/leads/import-engage?mode=full</code> with header{' '}
                            <code className="wa-leads-engage__code">x-engage-token</code>.
                        </p>
                        <label className="label wa-leads-engage__label" htmlFor="wa-leads-engage-token">
                            Engage token
                        </label>
                        <input
                            id="wa-leads-engage-token"
                            className="input wa-leads-engage__token-input"
                            type="password"
                            autoComplete="off"
                            placeholder="x-engage-token value"
                            value={engageToken}
                            onChange={(e) => setEngageToken(e.target.value)}
                        />
                        <div className="wa-leads-engage__grid">
                            {ENGAGE_IMPORT_PAGE_NUMBERS.map((n) => (
                                <button
                                    key={n}
                                    type="button"
                                    className={`button wa-leads-engage__page-btn${engageImportLoadingPage === n ? ' wa-leads-engage__page-btn--active' : ''}`}
                                    disabled={engageImportBusy}
                                    onClick={() => void runEngageImport(n)}
                                >
                                    {engageImportLoadingPage === n ? '…' : n}
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            className="button wa-leads-engage__fetch-all"
                            disabled={engageImportBusy}
                            onClick={() => void runEngageFetchAll()}
                        >
                            {engageFetchAllLoading ? 'Fetching…' : 'Fetch All'}
                        </button>
                    </div>
                </div>
            ) : null}
            {showEngageTokenExpiredModal ? (
                <div
                    className="wa-leads-engage-backdrop"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="wa-leads-engage-token-expired-title"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setShowEngageTokenExpiredModal(false);
                    }}
                >
                    <div className="card wa-leads-engage-modal wa-leads-engage-modal--alert" onClick={(e) => e.stopPropagation()}>
                        <div className="wa-leads-engage__header">
                            <h2 id="wa-leads-engage-token-expired-title" className="wa-leads-engage__title">
                                Alert
                            </h2>
                            <button
                                type="button"
                                className="icon-btn"
                                aria-label="Close"
                                onClick={() => setShowEngageTokenExpiredModal(false)}
                            >
                                ✕
                            </button>
                        </div>
                        <div className="wa-leads-engage__alert-row">
                            <span className="wa-leads-engage__alert-icon" aria-hidden="true">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 9v4" />
                                    <path d="M12 17h.01" />
                                    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.72 3h17a2 2 0 0 0 1.72-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
                                </svg>
                            </span>
                            <p className="wa-leads-engage__alert-message">Engage token expired , Use the Updated token</p>
                        </div>
                        <button
                            type="button"
                            className="button wa-leads-engage__alert-btn"
                            onClick={() => setShowEngageTokenExpiredModal(false)}
                        >
                            OK
                        </button>
                    </div>
                </div>
            ) : null}

            {showAddLead ? (
                <AddLeadModal
                    lead={editingLead}
                    existingLeads={existingLeadsForModal}
                    onClose={() => {
                        setShowAddLead(false);
                        setEditingLead(null);
                    }}
                    onSave={async (lead) => {
                        try {
                            if (editingLead) {
                                const response = await apiFetch(`/api/wa-leads-orders/${editingLead.id}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(lead),
                                });
                                if (!response.ok) throw new Error('Failed to update lead');
                                showToast('Lead updated successfully!', 'success');
                            } else {
                                const response = await apiFetch('/api/wa-leads-orders', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(lead),
                                });
                                if (!response.ok) throw new Error('Failed to save lead');
                                showToast('Lead added successfully!', 'success');
                            }
                            setShowAddLead(false);
                            setEditingLead(null);
                            await loadLeads();
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

function ModernMetricItem({ icon, label, value, isLast, isEven }: { icon: string; label: string; value: string; isLast: boolean; isEven: boolean }) {
    return (
        <div
            className={['wa-leads-metric', isEven ? 'wa-leads-metric--even' : '', isLast ? 'wa-leads-metric--last' : ''].filter(Boolean).join(' ')}
        >
            <div className="wa-leads-metric__hdr">
                <span className="wa-leads-metric__icon">{icon}</span>
                <div className="wa-leads-metric__label">{label}</div>
            </div>
            <div className="wa-leads-metric__value">{value}</div>
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
        <div ref={containerRef} className="wa-leads-dp">
            <div
                ref={inputRef}
                onClick={() => setIsOpen(!isOpen)}
                className="input wa-leads-dp__trigger"
            >
                <span className={displayValue ? 'wa-leads-dp__value' : 'wa-leads-dp__value wa-leads-dp__value--placeholder'}>
                    {displayValue || placeholder || 'Select date'}
                </span>
                <span className="wa-leads-dp__cal-emoji" aria-hidden>
                    📅
                </span>
            </div>
            <input
                type="date"
                className="wa-leads-dp__hidden"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                required={required}
                tabIndex={-1}
            />
            {isOpen && (
                <div ref={popupRef} className="wa-leads-cal" onClick={(e) => e.stopPropagation()}>
                    <div className="wa-leads-cal__nav">
                        <button type="button" onClick={handlePrevMonth} className="wa-leads-cal__nav-btn" aria-label="Previous month">
                            ‹
                        </button>
                        <div className="wa-leads-cal__month-title">
                            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </div>
                        <button type="button" onClick={handleNextMonth} className="wa-leads-cal__nav-btn" aria-label="Next month">
                            ›
                        </button>
                    </div>
                    <div className="wa-leads-cal__weekdays">
                        {weekDays.map((day) => (
                            <div key={day} className="wa-leads-cal__weekday">
                                {day}
                            </div>
                        ))}
                    </div>
                    <div className="wa-leads-cal__days">
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
                            const dayClass = [
                                'wa-leads-cal__day',
                                isSelected ? 'wa-leads-cal__day--selected' : '',
                                !isSelected && isToday ? 'wa-leads-cal__day--today' : '',
                            ]
                                .filter(Boolean)
                                .join(' ');
                            return (
                                <button key={day} type="button" onClick={() => handleDateSelect(day)} className={dayClass}>
                                    {day}
                                </button>
                            );
                        })}
                    </div>
                    <button type="button" onClick={handleToday} className="wa-leads-cal__today-btn">
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

    const statusConfig: Record<LeadStatus, { icon: string }> = {
        New: { icon: '🆕' },
        Contacted: { icon: '📞' },
        Converted: { icon: '✅' },
        'Not Interested': { icon: '❌' },
        'No Answer': { icon: '🔇' },
        'Potential Customer': { icon: '⭐' },
        'Very Interested': { icon: '🔥' },
        CBA: { icon: '💬' },
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
        <div ref={containerRef} className="wa-leads-sd">
            <div ref={buttonRef} onClick={() => setIsOpen(!isOpen)} className="input wa-leads-sd__trigger">
                <div className="wa-leads-sd__trigger-inner">
                    <span className="wa-leads-sd__trigger-icon">{currentStatus.icon}</span>
                    <span className="wa-leads-sd__trigger-label">{value}</span>
                </div>
                <span className="wa-leads-sd__chevron" aria-hidden>
                    ▼
                </span>
            </div>
            <select
                className="wa-leads-dp__hidden"
                value={value}
                onChange={(e) => onChange(e.target.value as LeadStatus)}
                required={required}
                tabIndex={-1}
            >
                {statusOptions.map((s) => (
                    <option key={s} value={s}>
                        {s}
                    </option>
                ))}
            </select>
            {isOpen && (
                <div ref={popupRef} className="wa-leads-sd__popup" onClick={(e) => e.stopPropagation()}>
                    {statusOptions.map((status) => {
                        const config = statusConfig[status];
                        const isSelected = value === status;
                        const mod = leadStatusModifier(status);
                        const optClass = ['wa-leads-sd__opt', `wa-leads-sd__opt--${mod}`, isSelected ? 'wa-leads-sd__opt--selected' : '']
                            .filter(Boolean)
                            .join(' ');
                        return (
                            <div
                                key={status}
                                role="button"
                                tabIndex={0}
                                className={optClass}
                                onClick={() => {
                                    onChange(status);
                                    setIsOpen(false);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        onChange(status);
                                        setIsOpen(false);
                                    }
                                }}
                            >
                                <span className="wa-leads-sd__opt-icon">{config.icon}</span>
                                <span className="wa-leads-sd__opt-label">{status}</span>
                                {isSelected ? <span className="wa-leads-sd__opt-check">✓</span> : null}
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
        <div role="dialog" aria-modal="true" onClick={onClose} className="wa-leads-modal-backdrop">
            <div className="card wa-leads-modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="wa-leads-modal__header">
                    <h3 className="wa-leads-modal__title">{lead ? 'Edit Lead' : 'Add Lead'}</h3>
                    <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
                        ✕
                    </button>
                </div>
                <form onSubmit={submit} className="wa-leads-modal__form">
                    <div className="wa-leads-modal__grid-2">
                        <div>
                            <label className="label">Customer Name</label>
                            <input className="input wa-leads-modal__input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
                        </div>
                        <div>
                            <label className="label">Mobile</label>
                            <input
                                className={['input', 'wa-leads-modal__input', mobileError ? 'wa-leads-modal__input--error' : ''].filter(Boolean).join(' ')}
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
                            {mobile && mobile.length !== 10 && !mobileError ? (
                                <div className="wa-leads-modal__field-error">Mobile number must be exactly 10 digits</div>
                            ) : null}
                            {mobileError ? <div className="wa-leads-modal__field-error">{mobileError}</div> : null}
                        </div>
                    </div>

                    <div className="wa-leads-modal__grid-4">
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
                                className="input wa-leads-modal__select"
                                value={platform}
                                onChange={(e) => setPlatform(e.target.value as Platform | '')}
                            >
                                <option value="">Select Platform</option>
                                <option value="STW">STW</option>
                                <option value="Abandoned">Abandoned</option>
                                <option value="Whatsapp">Whatsapp</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="label">Calling Detail</label>
                        <textarea className="input wa-leads-modal__textarea" value={callingDetail} onChange={(e) => setCallingDetail(e.target.value)} />
                    </div>

                    <div>
                        <label className="label">Notes</label>
                        <textarea className="input wa-leads-modal__textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </div>

                    <div className="wa-leads-modal__footer">
                        <button type="button" className="icon-btn" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="button wa-leads-modal__submit">
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
        <div className="wa-leads-toast-host">
            {toasts.map((toast) => (
                <div key={toast.id} className="toast wa-leads-toast" data-type={toast.type}>
                    <div className="wa-leads-toast__row">
                        <span className="wa-leads-toast__icon" aria-hidden>
                            {toast.type === 'success' ? '✓' : toast.type === 'delete' ? '🗑' : '✕'}
                        </span>
                        <span>{toast.message}</span>
                    </div>
                </div>
            ))}
        </div>
    );
}
