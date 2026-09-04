import { useCallback, useEffect, useMemo, useState } from 'react';
import { MSG91 } from '../../config/msg91';
import { Spinner } from '../../components/Spinner';
import { ModernSelect, Th, Td, type ModernSelectOption } from '../sales/Shopify/ShopifyShared';
import '../sales/Shopify/Shopify.scss';
import { fetchMonthlyOrderCustomers } from '../../utils/analytics';
import {
    buildSendTemplateRequest,
    fetchWhatsAppTemplates,
    getTemplatePreviewContent,
    parsePhoneNumbers,
    pickTemplateLanguage,
    sendWhatsAppTemplate,
} from '../../utils/whatsapp-templates';
import type { Msg91WhatsAppTemplate } from '../../types/whatsapp-templates';
import type { MonthlyOrderCustomer } from '../../types/analytics-monthly-order-customers';

type ToMode = 'customer' | 'manual' | 'csv';

const MONTH_OPTIONS: ModernSelectOption<string>[] = [
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
];

function buildYearOptions(): ModernSelectOption<string>[] {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, index) => {
        const year = String(currentYear - index);
        return { value: year, label: year };
    });
}

function normalizeFetchedCustomers(customers: MonthlyOrderCustomer[]): MonthlyOrderCustomer[] {
    const seen = new Set<string>();
    const rows: MonthlyOrderCustomer[] = [];
    for (const customer of customers) {
        const phone = parsePhoneNumbers(customer.phoneNumber || '')[0] ?? '';
        if (!phone || seen.has(phone)) continue;
        seen.add(phone);
        rows.push({
            customerId: customer.customerId || phone,
            name: customer.name?.trim() || '—',
            phoneNumber: phone,
        });
    }
    return rows;
}

function csvEscapeCell(value: string): string {
    if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
}

function downloadCustomersCsv(rows: MonthlyOrderCustomer[], month: string, year: string) {
    const lines = [
        'Name,Phone no',
        ...rows.map((row) => `${csvEscapeCell(row.name)},${csvEscapeCell(row.phoneNumber)}`),
    ];
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `customers_${year}-${month}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function RefreshIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
            <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
        </svg>
    );
}

function WhatsAppPhonePreview({ template }: { template: Msg91WhatsAppTemplate | null }) {
    const preview = template ? getTemplatePreviewContent(template) : null;

    return (
        <div className="wa-phone" aria-label="Template preview">
            <div className="wa-phone-notch" />
            <div className="wa-phone-bar">
                <div className="wa-phone-bar-left">
                    <span className="wa-phone-avatar" aria-hidden>
                        PH
                    </span>
                    <div>
                        <div className="wa-phone-name">Purity Harvest</div>
                        <div className="wa-phone-status">online</div>
                    </div>
                </div>
                <div className="wa-phone-bar-icons" aria-hidden>
                    <span>🎥</span>
                    <span>📞</span>
                    <span>⋮</span>
                </div>
            </div>
            <div className="wa-phone-chat">
                {preview ? (
                    <div className="wa-phone-bubble">
                        {preview.headerImageUrl ? (
                            <img
                                className="wa-phone-image"
                                src={preview.headerImageUrl}
                                alt=""
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                }}
                            />
                        ) : null}
                        <div className="wa-phone-text">{preview.body || 'Select a template to preview the message.'}</div>
                        {preview.footer ? <div className="wa-phone-foot">{preview.footer}</div> : null}
                        <div className="wa-phone-time">now ✓✓</div>
                    </div>
                ) : (
                    <div className="wa-phone-bubble wa-phone-bubble--empty">
                        <div className="wa-phone-text wa-phone-text--muted">Select a template to preview the message.</div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function SendTemplateModal({
    defaultIntegratedNumber,
    onClose,
}: {
    defaultIntegratedNumber: string;
    onClose: () => void;
}) {
    const [toMode, setToMode] = useState<ToMode>('customer');
    const [customerMonth, setCustomerMonth] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'));
    const [customerYear, setCustomerYear] = useState(() => String(new Date().getFullYear()));
    const [integratedNumber, setIntegratedNumber] = useState(defaultIntegratedNumber);
    const [templateName, setTemplateName] = useState('');
    const [phones, setPhones] = useState('');
    const [fetchedCustomers, setFetchedCustomers] = useState<MonthlyOrderCustomer[]>([]);
    const [headerMediaUrl, setHeaderMediaUrl] = useState('');
    const [templates, setTemplates] = useState<Msg91WhatsAppTemplate[]>([]);
    const [loadingTemplates, setLoadingTemplates] = useState(true);
    const [sending, setSending] = useState(false);
    const [fetchingCustomers, setFetchingCustomers] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    const close = useCallback(() => {
        if (!sending) onClose();
    }, [onClose, sending]);

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close();
        };
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = prev;
            window.removeEventListener('keydown', onKey);
        };
    }, [close]);

    const loadTemplates = useCallback(async () => {
        setLoadingTemplates(true);
        setError(null);
        try {
            const data = await fetchWhatsAppTemplates(integratedNumber);
            setTemplates(data);
        } catch (err) {
            setTemplates([]);
            setError(err instanceof Error ? err.message : 'Failed to load templates');
        } finally {
            setLoadingTemplates(false);
        }
    }, [integratedNumber]);

    useEffect(() => {
        setTemplateName('');
        setHeaderMediaUrl('');
        setSuccess(null);
        void loadTemplates();
    }, [integratedNumber, reloadKey, loadTemplates]);

    const selectedTemplate = useMemo(
        () => templates.find((t) => t.name === templateName) ?? null,
        [templates, templateName],
    );

    const needsHeaderImage = useMemo(() => {
        if (!selectedTemplate) return false;
        const lang = pickTemplateLanguage(selectedTemplate);
        return Boolean(lang?.variables.some((v) => lang.variable_type[v]?.type.toLowerCase() === 'image'));
    }, [selectedTemplate]);

    useEffect(() => {
        if (!selectedTemplate) {
            setHeaderMediaUrl('');
            return;
        }
        const preview = getTemplatePreviewContent(selectedTemplate);
        setHeaderMediaUrl(preview.headerImageUrl ?? '');
    }, [selectedTemplate]);

    const recipientCount =
        toMode === 'customer' ? fetchedCustomers.length : parsePhoneNumbers(phones).length;

    const templateOptions = useMemo((): ModernSelectOption<string>[] => {
        return templates.map((t) => ({
            value: t.name,
            label: t.name,
            icon: '💬',
        }));
    }, [templates]);

    const yearOptions = useMemo(() => buildYearOptions(), []);

    const numberOptions = useMemo((): ModernSelectOption<string>[] => {
        return MSG91.numberOptions.map((opt) => ({
            value: opt.value,
            label: opt.label,
            icon: '📱',
        }));
    }, []);

    async function handleFetchCustomers() {
        setError(null);
        setSuccess(null);
        if (!customerMonth || !customerYear) {
            setError('Select month and year.');
            return;
        }
        setFetchingCustomers(true);
        try {
            const data = await fetchMonthlyOrderCustomers(customerMonth, customerYear);
            const rows = normalizeFetchedCustomers(data.customers ?? []);
            setFetchedCustomers(rows);
            setPhones(rows.map((row) => row.phoneNumber).join(', '));
            if (rows.length === 0) {
                setError('No customer numbers found for this month.');
            }
        } catch (err) {
            setPhones('');
            setFetchedCustomers([]);
            setError(err instanceof Error ? err.message : 'Failed to fetch customers');
        } finally {
            setFetchingCustomers(false);
        }
    }

    function handleExportCsv() {
        if (fetchedCustomers.length === 0) return;
        downloadCustomersCsv(fetchedCustomers, customerMonth, customerYear);
    }

    async function handleCsv(file: File | undefined) {
        if (!file) return;
        const text = await file.text();
        const extracted = text
            .split(/[\n,;]+/)
            .map((s) => s.trim())
            .filter(Boolean)
            .join(', ');
        setPhones(extracted);
        setToMode('manual');
    }

    async function handleSend() {
        setError(null);
        setSuccess(null);
        if (!integratedNumber) {
            setError('Select a WhatsApp number.');
            return;
        }
        if (!selectedTemplate) {
            setError('Select a template.');
            return;
        }
        const to =
            toMode === 'customer'
                ? fetchedCustomers.map((row) => row.phoneNumber)
                : parsePhoneNumbers(phones);
        if (to.length === 0) {
            setError('Enter at least one mobile number with country code.');
            return;
        }
        if (needsHeaderImage && !headerMediaUrl.trim()) {
            setError('This template needs a header image URL.');
            return;
        }
        setSending(true);
        try {
            await sendWhatsAppTemplate(
                buildSendTemplateRequest({
                    integratedNumber,
                    template: selectedTemplate,
                    to,
                    headerMediaUrl: headerMediaUrl.trim() || undefined,
                }),
            );
            setSuccess(`Sent to ${to.length} recipient${to.length === 1 ? '' : 's'}.`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to send template');
        } finally {
            setSending(false);
        }
    }

    return (
        <div
            className="wa-composer-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wa-composer-title"
            onClick={close}
        >
            <div className="wa-composer" onClick={(e) => e.stopPropagation()}>
                <header className="wa-composer-head">
                    <div>
                        <h3 id="wa-composer-title">Send WhatsApp Message</h3>
                        <p className="wa-composer-sub">Choose recipients, a template, and review before sending.</p>
                    </div>
                    <button type="button" className="wa-composer-x" onClick={close} disabled={sending} aria-label="Close">
                        ✕
                    </button>
                </header>

                <div className="wa-composer-scroll">
                    <div className="wa-composer-grid">
                    <div className="wa-composer-main">
                    <section className="wa-composer-section">
                        <div className="wa-composer-section-head">
                            <span className="wa-composer-kicker">To</span>
                            <div className="wa-composer-modes" role="tablist" aria-label="Recipient input">
                                <button
                                    type="button"
                                    role="tab"
                                    className={toMode === 'customer' ? 'is-active' : ''}
                                    aria-selected={toMode === 'customer'}
                                    onClick={() => setToMode('customer')}
                                >
                                    Customer
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    className={toMode === 'manual' ? 'is-active' : ''}
                                    aria-selected={toMode === 'manual'}
                                    onClick={() => setToMode('manual')}
                                >
                                    Enter manually
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    className={toMode === 'csv' ? 'is-active' : ''}
                                    aria-selected={toMode === 'csv'}
                                    onClick={() => setToMode('csv')}
                                >
                                    CSV file
                                </button>
                            </div>
                        </div>

                        {toMode === 'customer' ? (
                            <>
                            <div className="wa-composer-from-grid wa-composer-customer-row">
                                <div className="wa-composer-field">
                                    <span>Month *</span>
                                    <ModernSelect
                                        className="wa-composer-modern-select"
                                        value={customerMonth}
                                        onChange={(value) => value && setCustomerMonth(value)}
                                        options={MONTH_OPTIONS}
                                        placeholder="Select month"
                                        disabled={sending || fetchingCustomers}
                                        aria-label="Customer month"
                                    />
                                </div>
                                <div className="wa-composer-field">
                                    <span>Year *</span>
                                    <ModernSelect
                                        className="wa-composer-modern-select"
                                        value={customerYear}
                                        onChange={(value) => value && setCustomerYear(value)}
                                        options={yearOptions}
                                        placeholder="Select year"
                                        disabled={sending || fetchingCustomers}
                                        aria-label="Customer year"
                                    />
                                </div>
                                <div className="wa-composer-field wa-composer-fetch-field">
                                    <span className="wa-composer-fetch-spacer" aria-hidden>
                                        &nbsp;
                                    </span>
                                    <button
                                        type="button"
                                        className="wa-composer-fetch"
                                        onClick={() => void handleFetchCustomers()}
                                        disabled={sending || fetchingCustomers}
                                    >
                                        {fetchingCustomers ? 'Fetching…' : 'Fetch'}
                                    </button>
                                </div>
                            </div>
                            {fetchedCustomers.length > 0 ? (
                                <div className="wa-composer-customers">
                                    <div className="wa-composer-customers-scroll">
                                        <table className="orders-table wa-composer-customers-table">
                                            <thead>
                                                <tr>
                                                    <Th>Name</Th>
                                                    <Th>Phone no</Th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {fetchedCustomers.map((row) => (
                                                    <tr key={row.customerId}>
                                                        <Td>{row.name}</Td>
                                                        <Td>{row.phoneNumber}</Td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : null}
                            </>
                        ) : toMode === 'manual' ? (
                            <div className="wa-composer-outline">
                                <span className="wa-composer-outline-label">Mobile Numbers *</span>
                                <textarea
                                    className="wa-composer-textarea"
                                    value={phones}
                                    onChange={(e) => setPhones(e.target.value)}
                                    disabled={sending}
                                    placeholder="91989XXXXXX0, 91978XXXXXX9"
                                    aria-label="Mobile numbers"
                                    rows={2}
                                />
                            </div>
                        ) : (
                            <label className="wa-composer-drop">
                                <input
                                    type="file"
                                    accept=".csv,.txt"
                                    hidden
                                    disabled={sending}
                                    onChange={(e) => void handleCsv(e.target.files?.[0])}
                                />
                                <strong>Drop a CSV or click to upload</strong>
                                <span>We’ll read numbers from the file and fill the recipient list.</span>
                            </label>
                        )}
                        {toMode === 'customer' ? (
                            <div className="wa-composer-hint-row">
                                <p className="wa-composer-hint">
                                    Customers from {MONTH_OPTIONS.find((m) => m.value === customerMonth)?.label} {customerYear}.
                                    {recipientCount > 0 ? (
                                        <span className="wa-composer-count">
                                            {recipientCount} recipient{recipientCount === 1 ? '' : 's'}
                                        </span>
                                    ) : null}
                                </p>
                                <button
                                    type="button"
                                    className="wa-composer-export"
                                    onClick={handleExportCsv}
                                    disabled={sending || fetchingCustomers || fetchedCustomers.length === 0}
                                >
                                    Export CSV
                                </button>
                            </div>
                        ) : (
                            <p className="wa-composer-hint">
                                Comma-separated numbers <strong>with country code</strong>, no + sign.
                                {recipientCount > 0 ? (
                                    <span className="wa-composer-count">
                                        {recipientCount} recipient{recipientCount === 1 ? '' : 's'}
                                    </span>
                                ) : null}
                            </p>
                        )}
                    </section>

                    <section className="wa-composer-from">
                        <span className="wa-composer-kicker">From</span>
                        <div className="wa-composer-from-grid">
                            <div className="wa-composer-field">
                                <span>Template *</span>
                                <ModernSelect
                                    className="wa-composer-modern-select"
                                    value={templateName}
                                    onChange={(value) => setTemplateName(value)}
                                    options={templateOptions}
                                    placeholder={loadingTemplates ? 'Loading templates…' : 'Select template'}
                                    disabled={sending || loadingTemplates}
                                    aria-label="Template name"
                                />
                            </div>
                            <div className="wa-composer-field">
                                <span>Select number *</span>
                                <div className="wa-composer-number-row">
                                    <ModernSelect
                                        className="wa-composer-modern-select"
                                        value={integratedNumber}
                                        onChange={(value) => value && setIntegratedNumber(value)}
                                        options={numberOptions}
                                        placeholder="Select number"
                                        disabled={sending}
                                        aria-label="Integrated number"
                                    />
                                    <button
                                        type="button"
                                        className="wa-composer-refresh"
                                        onClick={() => setReloadKey((k) => k + 1)}
                                        disabled={sending || loadingTemplates}
                                        title="Refresh templates"
                                        aria-label="Refresh templates"
                                    >
                                        <RefreshIcon />
                                    </button>
                                </div>
                            </div>
                        </div>
                        {needsHeaderImage ? (
                            <label className="wa-composer-field">
                                Header image URL *
                                <input
                                    className="wa-composer-select"
                                    value={headerMediaUrl}
                                    onChange={(e) => setHeaderMediaUrl(e.target.value)}
                                    disabled={sending}
                                    placeholder="https://"
                                />
                            </label>
                        ) : null}
                    </section>
                    </div>

                    <div className="wa-composer-preview-col">
                        <span className="wa-composer-kicker">Template Preview</span>
                        <WhatsAppPhonePreview template={selectedTemplate} />
                    </div>
                    </div>

                    {error ? <div className="wa-send-alert wa-send-alert--error">{error}</div> : null}
                    {success ? <div className="wa-send-alert wa-send-alert--success">{success}</div> : null}
                </div>

                <footer className="wa-composer-foot">
                    <button type="button" className="wa-composer-cancel" onClick={close} disabled={sending}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="wa-composer-send"
                        onClick={() => void handleSend()}
                        disabled={sending || fetchingCustomers || loadingTemplates}
                    >
                        {sending ? 'Sending…' : 'Review & Send'}
                    </button>
                </footer>

                {sending ? <Spinner overlay message="Sending template…" /> : null}
                {fetchingCustomers ? <Spinner overlay message="Fetching customers…" /> : null}
            </div>
        </div>
    );
}
