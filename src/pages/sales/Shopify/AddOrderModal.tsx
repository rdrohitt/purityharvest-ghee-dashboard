import {
    cloneElement,
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type ReactElement,
    type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
    type Order,
    type OrderItem,
    type PaymentStatus,
    type FulfillmentStatus,
    type DeliveryStatus,
    type Platform,
    type OrderType,
} from '../../../utils/orders';
import type { CustomerSearchResult } from '../../../types/shopify';
import { searchCustomersByPhone } from '../../../utils/customers';
import { INDIAN_STATES_AND_UTS } from '../../../utils/indianStates';
import {
    toInputDate,
    ModernSelect,
    ORDER_MODAL_TYPE_OPTIONS,
    ORDER_MODAL_PLATFORM_OPTIONS,
    ORDER_MODAL_PAYMENT_OPTIONS,
    ORDER_MODAL_FULFILLMENT_OPTIONS,
    ORDER_MODAL_DELIVERY_OPTIONS,
    ORDER_MODAL_TRACKING_COMPANY_OPTIONS,
    type TrackingCompany,
} from './ShopifyShared';
import { DatePicker } from './DatePicker';
import { Spinner } from '../../../components/Spinner';
import { buildDefaultTrackingUrlFromCourier } from '../../../utils/shopify-orders';
import { apiFetch } from '../../../api';
import './Shopify.scss';

const DEBOUNCE_MS = 350;

/** Map API ISO / date string to YYYY-MM-DD for `DatePicker` (local calendar date). */
function orderDateFieldToYmd(v?: string): string {
    if (!v?.trim()) return '';
    const t = v.trim();
    const d = new Date(t);
    if (Number.isNaN(d.getTime())) {
        const m = t.match(/^(\d{4}-\d{2}-\d{2})/);
        return m ? m[1] : '';
    }
    return toInputDate(d);
}

function ModalFieldSvg({ children }: { children: ReactNode }) {
    return (
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
            aria-hidden
        >
            {children}
        </svg>
    );
}

/** Prefix icons for Add / Edit order modal fields (stroke SVGs, no extra dependency). */
export const ADD_MODAL_FIELD_ICONS = {
    phone: (
        <ModalFieldSvg>
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </ModalFieldSvg>
    ),
    user: (
        <ModalFieldSvg>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </ModalFieldSvg>
    ),
    mapPin: (
        <ModalFieldSvg>
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
        </ModalFieldSvg>
    ),
    hash: (
        <ModalFieldSvg>
            <line x1="4" y1="9" x2="20" y2="9" />
            <line x1="4" y1="15" x2="20" y2="15" />
            <line x1="10" y1="3" x2="8" y2="21" />
            <line x1="16" y1="3" x2="14" y2="21" />
        </ModalFieldSvg>
    ),
    building: (
        <ModalFieldSvg>
            <path d="M3 21h18" />
            <path d="M5 21V7l8-4v18" />
            <path d="M19 21V11l-6-4" />
            <line x1="9" y1="9" x2="9" y2="9.01" />
            <line x1="9" y1="12" x2="9" y2="12.01" />
            <line x1="9" y1="15" x2="9" y2="15.01" />
            <line x1="9" y1="18" x2="9" y2="18.01" />
        </ModalFieldSvg>
    ),
    package: (
        <ModalFieldSvg>
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
        </ModalFieldSvg>
    ),
    layers: (
        <ModalFieldSvg>
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
        </ModalFieldSvg>
    ),
    rupee: (
        <ModalFieldSvg>
            <path d="M6 3h12M6 8h12" />
            <path d="M6 13c0 3.314 2.686 6 6 6h2M6 8c0 2.21 1.79 4 4 4h4" />
        </ModalFieldSvg>
    ),
    wallet: (
        <ModalFieldSvg>
            <path d="M21 12V7H5a2 2 0 0 1 0-4h18v4" />
            <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
            <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
        </ModalFieldSvg>
    ),
    truck: (
        <ModalFieldSvg>
            <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
            <path d="M15 18H9" />
            <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
            <circle cx="17" cy="18" r="2" />
            <circle cx="7" cy="18" r="2" />
        </ModalFieldSvg>
    ),
    percent: (
        <ModalFieldSvg>
            <line x1="19" y1="5" x2="5" y2="19" />
            <circle cx="6.5" cy="6.5" r="2.5" />
            <circle cx="17.5" cy="17.5" r="2.5" />
        </ModalFieldSvg>
    ),
    sigma: (
        <ModalFieldSvg>
            <path d="M18 7V5H6l6 7-6 7h12v-2" />
        </ModalFieldSvg>
    ),
    notes: (
        <ModalFieldSvg>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
        </ModalFieldSvg>
    ),
    mail: (
        <ModalFieldSvg>
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22 6 12 13 2 6" />
        </ModalFieldSvg>
    ),
    barcode: (
        <ModalFieldSvg>
            <path d="M3 5v14M7 5v14M11 5v14M15 5v14M19 5v14" />
        </ModalFieldSvg>
    ),
};

export function AddModalInputWrap({
    icon,
    children,
    variant = 'default',
}: {
    icon: ReactNode;
    children: ReactElement<{ className?: string }>;
    variant?: 'default' | 'textarea';
}) {
    const mergedClass = `${children.props.className || ''} shopify-add-modal-input--with-prefix`.trim();
    return (
        <div
            className={
                'shopify-add-modal-input-wrap' +
                (variant === 'textarea' ? ' shopify-add-modal-input-wrap--textarea' : '')
            }
        >
            <span className="shopify-add-modal-input-wrap__icon">{icon}</span>
            {cloneElement(children, { className: mergedClass })}
        </div>
    );
}

export function AddModalSection({
    id,
    title,
    description,
    children,
}: {
    id: string;
    title: string;
    description?: string;
    children: ReactNode;
}) {
    return (
        <section className="shopify-add-modal-section" aria-labelledby={id}>
            <header className="shopify-add-modal-section__head">
                <h4 id={id} className="shopify-add-modal-section__title">
                    {title}
                </h4>
                {description ? (
                    <p className="shopify-add-modal-section__desc">{description}</p>
                ) : null}
            </header>
            <div className="shopify-add-modal-section__body">{children}</div>
        </section>
    );
}

function normalizeTrackingCompany(v: string | undefined): TrackingCompany | '' {
    if (!v?.trim()) return '';
    const lower = v.trim().toLowerCase();
    if (lower.includes('delhivery')) return 'Delhivery';
    if (lower.includes('amazon')) return 'Amazon';
    if (lower.includes('shiprocket')) return 'Shiprocket';
    return '';
}

export type ProductVariantOption = { id: string; name: string; size: string; price: number };

/** Matches how line items are labeled in the add-order UI (name only when there is no size). */
export function formatVariantLabel(product: ProductVariantOption): string {
    return product.size ? `${product.name} - ${product.size}` : product.name;
}

/** Must match the warehouse name registered in your Delhivery account (case-sensitive). */
const DELHIVERY_PICKUP_WAREHOUSE_NAME = 'Gurugram';

function guessCityFromAddress(addr: string, stateFallback: string): string {
    const parts = addr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    if (parts.length >= 2) return parts[parts.length - 1];
    return stateFallback.trim() || '';
}

function buildDelhiveryCmuPayload(params: {
    name: string;
    phone: string;
    address: string;
    pincode: string;
    state: string;
    payment: PaymentStatus;
    amount: string;
    items: Array<{ variant: string; quantity: number }>;
    orderRef: string;
    orderDateIso: string;
}): { shipments: Record<string, unknown>[]; pickup_location: { name: string } } {
    const digits = params.phone.replace(/\D/g, '').slice(-10);
    const phoneNum = Number(digits);
    const pinNum = Number(params.pincode);
    const totalQty = params.items.reduce((s, i) => s + Math.max(0, i.quantity), 0);
    const payMode = params.payment === 'COD' ? 'COD' : 'Prepaid';
    const amt = Number(params.amount) || 0;
    const codAmt = params.payment === 'COD' ? amt : 0;
    const d = params.orderDateIso ? new Date(params.orderDateIso) : new Date();
    const orderDate = Number.isNaN(d.getTime())
        ? new Date().toISOString().slice(0, 19).replace('T', ' ')
        : d.toISOString().slice(0, 19).replace('T', ' ');

    const city = guessCityFromAddress(params.address, params.state) || params.state || 'India';
    const productsDesc =
        params.items
            .filter((i) => i.variant)
            .map((i) => `${i.variant} x${i.quantity}`)
            .join('; ') || 'Ghee';

    return {
        shipments: [
            {
                add: params.address,
                address_type: 'home',
                phone: phoneNum,
                payment_mode: payMode,
                name: params.name,
                pin: pinNum,
                order: params.orderRef,
                shipping_mode: 'Surface',
                hsn_code: '04059020',
                city,
                commodity_value: String(amt),
                weight: String(Math.max(200, totalQty * 450 || 500)),
                fragile_shipment: false,
                shipment_height: 10,
                shipment_width: 11,
                shipment_length: 12,
                category_of_goods: 'Ghee',
                cod_amount: codAmt,
                products_desc: productsDesc,
                state: params.state,
                dangerous_good: 'False',
                waybill: '',
                order_date: orderDate,
                total_amount: amt,
                country: 'India',
                quantity: String(Math.max(1, totalQty || 1)),
                invoice_reference: params.orderRef,
            },
        ],
        pickup_location: { name: DELHIVERY_PICKUP_WAREHOUSE_NAME },
    };
}

function delhiveryCreateErrorMessage(data: unknown): string | null {
    if (!data || typeof data !== 'object') return null;
    const o = data as Record<string, unknown>;
    const succ = o.success;
    if (succ === false || succ === 'false') {
        const rmk = o.rmk ?? o.message ?? o.error;
        if (typeof rmk === 'string') return rmk;
        if (rmk != null) return String(rmk);
        return 'Delhivery rejected the shipment.';
    }
    return null;
}

function parseWaybillFromDelhiveryCreate(data: unknown): string | null {
    if (!data || typeof data !== 'object') return null;
    const o = data as Record<string, unknown>;
    const pkgs = o.packages;
    if (Array.isArray(pkgs) && pkgs[0] && typeof pkgs[0] === 'object') {
        const w = (pkgs[0] as Record<string, unknown>).waybill;
        if (w != null && String(w).trim()) return String(w).trim();
    }
    const single = o.waybill;
    if (single != null && String(single).trim()) return String(single).trim();

    const upload = o.upload_wbn;
    if (Array.isArray(upload) && upload[0] != null && String(upload[0]).trim()) {
        return String(upload[0]).trim();
    }

    const shipmentData = o.ShipmentData;
    if (Array.isArray(shipmentData) && shipmentData[0] && typeof shipmentData[0] === 'object') {
        const sh = (shipmentData[0] as Record<string, unknown>).Shipment;
        if (sh && typeof sh === 'object') {
            const awb = (sh as Record<string, unknown>).AWB;
            if (awb != null && String(awb).trim()) return String(awb).trim();
        }
    }
    return null;
}

function PhoneDropdown({
    selectedPhone,
    onSelectSearchResult,
    onNewPhone,
    phone,
    required,
    skipSearch,
    disabled,
}: {
    selectedPhone: string;
    phone: string;
    onSelectSearchResult: (customer: CustomerSearchResult) => void;
    onNewPhone?: (phone: string) => void;
    required?: boolean;
    /** When true, do not call customer search API (e.g. in edit mode when phone is prefilled). */
    skipSearch?: boolean;
    /** When true, phone cannot be changed (e.g. edit order — customer identity is fixed). */
    disabled?: boolean;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<CustomerSearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const digits = (searchQuery.trim() || phone.trim()).replace(/\D/g, '');

    const runSearch = useCallback((value: string) => {
        const d = value.replace(/\D/g, '');
        if (d.length < 5) {
            setSearchResults([]);
            return;
        }
        setSearching(true);
        searchCustomersByPhone(d)
            .then((list) => setSearchResults(list))
            .catch(() => setSearchResults([]))
            .finally(() => setSearching(false));
    }, []);

    useEffect(() => {
        if (disabled) {
            setIsOpen(false);
        }
    }, [disabled]);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (skipSearch || disabled || !digits) {
            if (!digits) setSearchResults([]);
            return;
        }
        debounceRef.current = setTimeout(() => runSearch(digits), DEBOUNCE_MS);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [digits, runSearch, skipSearch, disabled]);

    const showCreateNew =
        digits.length >= 10 &&
        searchResults.length === 0 &&
        !searching;

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setSearchQuery('');
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && containerRef.current && popupRef.current) {
            const containerRect = containerRef.current.getBoundingClientRect();
            const popup = popupRef.current;
            const gutter = 12;
            const popupWidth = Math.min(400, Math.max(260, window.innerWidth - gutter * 2));
            popup.style.width = `${popupWidth}px`;
            popup.style.maxWidth = `${popupWidth}px`;
            popup.style.minWidth = '0';

            const estHeight = Math.min(300, window.innerHeight - gutter * 2);
            let top = containerRect.bottom + 4;
            if (containerRect.bottom + estHeight > window.innerHeight - gutter) {
                top = containerRect.top - estHeight - 4;
            }
            top = Math.max(gutter, Math.min(top, window.innerHeight - estHeight - gutter));

            let left = containerRect.left;
            left = Math.min(left, window.innerWidth - popupWidth - gutter);
            left = Math.max(gutter, left);

            popup.style.top = `${top}px`;
            popup.style.left = `${left}px`;
        }
    }, [isOpen, searchResults.length]);

    return (
        <div ref={containerRef} className="shopify-phonedrop-root">
            <div className="shopify-phonedrop-inner shopify-add-modal-input-wrap shopify-add-modal-input-wrap--phonedrop">
                <span className="shopify-add-modal-input-wrap__icon">{ADD_MODAL_FIELD_ICONS.phone}</span>
                <input
                    type="tel"
                    className={`input shopify-phonedrop-input shopify-add-modal-input--with-prefix${disabled ? ' shopify-add-modal-input--readonly' : ''}`}
                    value={phone}
                    onChange={(e) => {
                        if (disabled) return;
                        const value = e.target.value.replace(/\D/g, '');
                        if (value.length <= 10) {
                            if (onNewPhone) onNewPhone(value);
                            setSearchQuery(value);
                            setIsOpen(true);
                        }
                    }}
                    onFocus={() => {
                        if (!disabled) setIsOpen(true);
                    }}
                    placeholder="Type phone number to search..."
                    maxLength={10}
                    pattern="[0-9]{10}"
                    required={required && !disabled}
                    disabled={disabled}
                />
                <div
                    className={`shopify-phonedrop-chevron${disabled ? ' shopify-phonedrop-chevron--disabled' : ''}`}
                    onClick={() => {
                        if (!disabled) setIsOpen((o) => !o);
                    }}
                    aria-hidden
                >
                    <span>▼</span>
                </div>
            </div>
            {isOpen && !disabled && (
                <div ref={popupRef} className="shopify-phonedrop-popup" onClick={(e) => e.stopPropagation()}>
                    <input
                        ref={inputRef}
                        type="tel"
                        className="shopify-phonedrop-search"
                        placeholder="Search by phone number..."
                        value={searchQuery || phone}
                        onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '');
                            if (value.length <= 10) {
                                setSearchQuery(value);
                                if (onNewPhone) onNewPhone(value);
                            }
                        }}
                        maxLength={10}
                        pattern="[0-9]{10}"
                        onClick={(e) => e.stopPropagation()}
                    />
                    <div className="shopify-phonedrop-list">
                        {searching ? (
                            <div className="shopify-phonedrop-empty">Searching...</div>
                        ) : searchResults.length === 0 && !showCreateNew ? (
                            <div className="shopify-phonedrop-empty">
                                {digits.length >= 5 ? 'No customers found' : 'Type at least 5 digits to search...'}
                            </div>
                        ) : (
                            <>
                                {searchResults.map((customer) => {
                                    const phoneDigits = (customer.phoneNumber || '').replace(/\D/g, '');
                                    const isSelected = selectedPhone.replace(/\D/g, '') === phoneDigits;
                                    return (
                                        <div
                                            key={customer._id}
                                            onClick={() => {
                                                onSelectSearchResult(customer);
                                                setIsOpen(false);
                                                setSearchQuery('');
                                            }}
                                            className={`shopify-phonedrop-item${isSelected ? ' shopify-phonedrop-item--selected' : ''}`}
                                        >
                                            <span className="shopify-phonedrop-item-name">{customer.name}</span>
                                            <span className="shopify-phonedrop-item-phone">{customer.phoneNumber}</span>
                                        </div>
                                    );
                                })}
                                {showCreateNew && (
                                    <div
                                        onClick={() => {
                                            if (onNewPhone) onNewPhone(searchQuery.trim() || phone.trim());
                                            setIsOpen(false);
                                            setSearchQuery('');
                                        }}
                                        className="shopify-phonedrop-create"
                                    >
                                        <span className="shopify-phonedrop-create-icon">➕</span>
                                        <div className="shopify-phonedrop-create-text">
                                            <span className="shopify-phonedrop-create-title">Create new customer</span>
                                            <span className="shopify-phonedrop-create-sub">Phone: "{searchQuery.trim() || phone.trim()}"</span>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
            <input type="hidden" value={selectedPhone} required={required} />
        </div>
    );
}

function StateSearchDropdown({
    value,
    onChange,
    placeholder = 'Select state',
    required,
    disabled,
}: {
    value: string;
    onChange: (state: string) => void;
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);

    const allOptions = useMemo(() => {
        const list = [...INDIAN_STATES_AND_UTS];
        const v = value.trim();
        if (v && !list.some((s) => s.toLowerCase() === v.toLowerCase())) {
            list.unshift(v);
        }
        return list;
    }, [value]);

    const searchLower = searchQuery.trim().toLowerCase();
    const filteredOptions =
        searchLower === ''
            ? allOptions
            : allOptions.filter((s) => s.toLowerCase().includes(searchLower));

    useEffect(() => {
        if (disabled) setIsOpen(false);
    }, [disabled]);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            const target = e.target as Node;
            const inContainer = containerRef.current?.contains(target);
            const inPopup = popupRef.current?.contains(target);
            if (!inContainer && !inPopup) {
                setIsOpen(false);
                setSearchQuery('');
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    useLayoutEffect(() => {
        if (!isOpen || !popupRef.current || !triggerRef.current) return;

        const positionPopup = () => {
            if (!popupRef.current || !triggerRef.current) return;
            const rect = triggerRef.current.getBoundingClientRect();
            const popup = popupRef.current;
            const gutter = 12;
            const popupWidth = Math.max(280, rect.width);
            let left = rect.left;
            if (left + popupWidth > window.innerWidth - gutter) {
                left = window.innerWidth - popupWidth - gutter;
            }
            left = Math.max(gutter, left);
            popup.style.left = `${left}px`;
            popup.style.width = `${popupWidth}px`;
            popup.style.maxWidth = `${Math.max(280, window.innerWidth - gutter * 2)}px`;

            const popupHeight = Math.min(popup.offsetHeight || 320, window.innerHeight - gutter * 2);
            const spaceBelow = window.innerHeight - rect.bottom;
            const shouldOpenUp = spaceBelow < popupHeight + 8 && rect.top > popupHeight + 8;
            let top = shouldOpenUp ? rect.top - popupHeight - 4 : rect.bottom + 4;
            top = Math.max(gutter, Math.min(top, window.innerHeight - popupHeight - gutter));
            popup.style.top = `${top}px`;
        };

        positionPopup();
        const rafId = window.requestAnimationFrame(positionPopup);
        const onViewportChange = () => positionPopup();
        window.addEventListener('resize', onViewportChange);
        window.addEventListener('scroll', onViewportChange, true);
        return () => {
            window.cancelAnimationFrame(rafId);
            window.removeEventListener('resize', onViewportChange);
            window.removeEventListener('scroll', onViewportChange, true);
        };
    }, [isOpen, searchQuery, filteredOptions.length]);

    const displayLabel = value.trim() ? value.trim() : placeholder;

    return (
        <div ref={containerRef} className="state-search-dropdown">
            <AddModalInputWrap icon={ADD_MODAL_FIELD_ICONS.building}>
                <button
                    ref={triggerRef}
                    type="button"
                    className={`input shopify-add-modal-input shopify-add-modal-input--with-prefix state-search-dropdown__trigger${disabled ? ' shopify-add-modal-input--readonly' : ''}`}
                    onClick={() => !disabled && setIsOpen((o) => !o)}
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                    aria-label="State"
                    disabled={disabled}
                >
                    <span
                        className={`state-search-dropdown__value${!value.trim() ? ' state-search-dropdown__value--placeholder' : ''}`}
                    >
                        {displayLabel}
                    </span>
                    <span className="state-search-dropdown__chev" aria-hidden>
                        {isOpen ? '▲' : '▼'}
                    </span>
                </button>
            </AddModalInputWrap>
            <input type="hidden" value={value} required={required} readOnly tabIndex={-1} aria-hidden />
            {isOpen && !disabled && typeof document !== 'undefined' && document.body
                ? createPortal(
                      <div
                          ref={popupRef}
                          className="variant-dropdown-popup state-search-dropdown__popup"
                          role="listbox"
                          style={{
                              position: 'fixed',
                              minWidth: 280,
                              maxWidth: 400,
                              maxHeight: 320,
                              zIndex: 10001,
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                      >
                          <div className="variant-dropdown-search-wrap">
                              <svg
                                  className="variant-dropdown-search-icon"
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-hidden
                              >
                                  <circle cx="11" cy="11" r="8" />
                                  <path d="m21 21-4.35-4.35" />
                              </svg>
                              <input
                                  type="text"
                                  className="variant-dropdown-search"
                                  placeholder="Search state…"
                                  value={searchQuery}
                                  onChange={(e) => setSearchQuery(e.target.value)}
                                  onKeyDown={(e) => {
                                      e.stopPropagation();
                                      if (e.key === 'Enter') e.preventDefault();
                                  }}
                                  autoFocus
                              />
                          </div>
                          <div className="variant-dropdown-list">
                              {filteredOptions.length === 0 ? (
                                  <div className="variant-dropdown-empty">No matching state</div>
                              ) : (
                                  filteredOptions.map((name) => {
                                      const isSelected = value.trim().toLowerCase() === name.toLowerCase();
                                      return (
                                          <button
                                              type="button"
                                              key={name}
                                              role="option"
                                              aria-selected={isSelected}
                                              className={`variant-dropdown-option state-search-dropdown__option${isSelected ? ' variant-dropdown-option--selected' : ''}`}
                                              onClick={() => {
                                                  onChange(name);
                                                  setIsOpen(false);
                                                  setSearchQuery('');
                                              }}
                                          >
                                              <span className="variant-dropdown-option-title">{name}</span>
                                          </button>
                                      );
                                  })
                              )}
                          </div>
                      </div>,
                      document.body
                  )
                : null}
        </div>
    );
}

function VariantDropdown({
    value,
    options,
    onChange,
    placeholder = 'Select product',
    required,
}: {
    value: string;
    options: ProductVariantOption[];
    onChange: (variantValue: string) => void;
    placeholder?: string;
    required?: boolean;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);

    // Filter on every render from current search so list updates on every key press
    const list = Array.isArray(options) ? options : [];
    const searchLower = searchQuery.trim().toLowerCase();
    const filteredOptions =
        searchLower === ''
            ? list
            : list.filter((p) => {
                  const name = String(p?.name ?? '').toLowerCase();
                  const size = String(p?.size ?? '').toLowerCase();
                  const combined = `${name} - ${size}`;
                  return (
                      name.includes(searchLower) ||
                      size.includes(searchLower) ||
                      combined.includes(searchLower)
                  );
              });

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            const target = e.target as Node;
            const inContainer = containerRef.current?.contains(target);
            const inPopup = popupRef.current?.contains(target);
            if (!inContainer && !inPopup) {
                setIsOpen(false);
                setSearchQuery('');
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    useLayoutEffect(() => {
        if (!isOpen || !popupRef.current || !triggerRef.current) return;

        const positionPopup = () => {
            if (!popupRef.current || !triggerRef.current) return;
            const rect = triggerRef.current.getBoundingClientRect();
            const popup = popupRef.current;
            const gutter = 12;

            const popupWidth = Math.max(280, rect.width);
            let left = rect.left;
            if (left + popupWidth > window.innerWidth - gutter) {
                left = window.innerWidth - popupWidth - gutter;
            }
            left = Math.max(gutter, left);

            popup.style.left = `${left}px`;
            popup.style.width = `${popupWidth}px`;
            popup.style.maxWidth = `${Math.max(280, window.innerWidth - gutter * 2)}px`;

            // Measure after width is applied so open-up/open-down is based on actual content height.
            const popupHeight = Math.min(popup.offsetHeight || 320, window.innerHeight - gutter * 2);
            const spaceBelow = window.innerHeight - rect.bottom;
            const shouldOpenUp = spaceBelow < popupHeight + 8 && rect.top > popupHeight + 8;

            let top = shouldOpenUp ? rect.top - popupHeight - 4 : rect.bottom + 4;
            top = Math.max(gutter, Math.min(top, window.innerHeight - popupHeight - gutter));
            popup.style.top = `${top}px`;
        };

        positionPopup();
        const rafId = window.requestAnimationFrame(positionPopup);
        const onViewportChange = () => positionPopup();
        window.addEventListener('resize', onViewportChange);
        window.addEventListener('scroll', onViewportChange, true);

        return () => {
            window.cancelAnimationFrame(rafId);
            window.removeEventListener('resize', onViewportChange);
            window.removeEventListener('scroll', onViewportChange, true);
        };
    }, [isOpen, searchQuery, filteredOptions.length]);

    const displayLabel = value || placeholder;

    return (
        <div ref={containerRef} className="variant-dropdown-root">
            <label className="label">Variant</label>
            <button
                ref={triggerRef}
                type="button"
                className="variant-dropdown-trigger"
                onClick={() => setIsOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-label={displayLabel}
            >
                <span className="variant-dropdown-trigger__prefix" aria-hidden>
                    {ADD_MODAL_FIELD_ICONS.package}
                </span>
                <span className={`variant-dropdown-trigger__label${!value ? ' variant-dropdown-placeholder' : ''}`}>
                    {displayLabel}
                </span>
                <span className="variant-dropdown-chevron" aria-hidden>
                    {isOpen ? '▲' : '▼'}
                </span>
            </button>
            <input type="hidden" value={value} required={required} />
            {isOpen && typeof document !== 'undefined' && document.body
                ? createPortal(
                    <div
                        ref={popupRef}
                        className="variant-dropdown-popup"
                        role="listbox"
                        style={{ position: 'fixed', minWidth: 280, maxWidth: 400, maxHeight: 320, zIndex: 10001 }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <div className="variant-dropdown-search-wrap">
                        <svg className="variant-dropdown-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                        <input
                            type="text"
                            className="variant-dropdown-search"
                            placeholder="Search product or variant..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
                            onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === 'Enter') e.preventDefault();
                            }}
                            autoFocus
                        />
                    </div>
                    <div className="variant-dropdown-list">
                        {filteredOptions.length === 0 ? (
                            <div className="variant-dropdown-empty">
                                {options.length === 0
                                    ? 'No products available'
                                    : `No matches for "${searchQuery.trim()}"`}
                            </div>
                        ) : (
                            filteredOptions.map((product) => {
                                const variantStr = formatVariantLabel(product);
                                const isSelected = value === variantStr;
                                return (
                                    <button
                                        type="button"
                                        key={`${product.id}-${product.size}`}
                                        role="option"
                                        aria-selected={isSelected}
                                        className={`variant-dropdown-option ${isSelected ? 'variant-dropdown-option--selected' : ''}`}
                                        onClick={() => {
                                            onChange(variantStr);
                                            setIsOpen(false);
                                            setSearchQuery('');
                                        }}
                                    >
                                        <span className="variant-dropdown-option-title">
                                            {product.name}
                                        </span>
                                        <span className="variant-dropdown-option-meta">
                                            {product.size
                                                ? `${product.size} · ₹${product.price.toLocaleString('en-IN')}`
                                                : `₹${product.price.toLocaleString('en-IN')}`}
                                        </span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>,
                    document.body
                )
                : null}
        </div>
    );
}

function AddOrderModal({
    products,
    orders,
    mode = 'add',
    initialOrder,
    onClose,
    onCreate,
}: {
    products: ProductVariantOption[];
    orders: Order[];
    mode?: 'add' | 'edit';
    initialOrder?: Order;
    onClose: () => void;
    onCreate: (o: Order) => void | Promise<void>;
}) {
    const normalizePlatform = (p?: Platform | ''): Platform | '' => {
        if (!p) return '';
        const lower = String(p).toLowerCase();
        if (lower === 'shopify') return 'Shopify';
        if (lower === 'abandoned') return 'Abandoned';
        if (lower === 'whatsapp') return 'Whatsapp';
        if (lower === 'amazon') return 'Amazon';
        if (lower === 'flipkart') return 'Flipkart';
        if (lower === 'calling') return 'Calling';
        if (lower === 'collaboration') return 'Collaboration';
        return p;
    };

    const [date, setDate] = useState<string>(
        initialOrder ? toInputDate(new Date(initialOrder.date)) : toInputDate(new Date())
    );
    const [name, setName] = useState(initialOrder?.customer || '');
    const [phone, setPhone] = useState(
        initialOrder?.customerPhone
            ? initialOrder.customerPhone.replace(/\D/g, '').slice(-10)
            : ''
    );
    const [address, setAddress] = useState(initialOrder?.customerAddress || '');
    const [state, setState] = useState(initialOrder?.state || '');
    const [pincode, setPincode] = useState(initialOrder?.pincode || '');
    const [type, setType] = useState<OrderType | ''>(initialOrder?.type || (mode === 'add' ? 'New' : ''));
    /** Edit or add+Repeat: lock customer fields (not Date). Type is driven by phone/order only (dropdown always disabled). */
    const customerSectionLocked =
        mode === 'edit' || (mode === 'add' && type === 'Repeat');
    const [payment, setPayment] = useState<PaymentStatus | ''>(
        initialOrder?.paymentStatus || ''
    );
    const [fulfillment, setFulfillment] = useState<FulfillmentStatus>(
        initialOrder?.fulfillmentStatus || 'Fulfilled'
    );
    const [delivery, setDelivery] = useState<DeliveryStatus>(
        initialOrder?.deliveryStatus || 'in_transit'
    );
    const [platform, setPlatform] = useState<Platform | ''>(
        normalizePlatform(initialOrder?.platform as Platform | '')
    );
    const [codCharges, setCodCharges] = useState<string>(
        initialOrder?.codCharges?.toString() ||
            initialOrder?.shippingAmount?.toString() ||
            ''
    );
    const [partialAmount, setPartialAmount] = useState<string>(
        initialOrder?.partialAmount !== undefined && initialOrder?.partialAmount !== null
            ? String(initialOrder.partialAmount)
            : initialOrder?.shippingCharges?.toString() || ''
    );
    const [discount, setDiscount] = useState<string>(
        initialOrder?.discountAmount?.toString() || ''
    );
    const [notes, setNotes] = useState<string>(initialOrder?.notes || '');
    const [items, setItems] = useState<
        Array<{ variant: string; quantity: number; variantPrice: number }>
    >(
        initialOrder?.items && initialOrder.items.length > 0
            ? initialOrder.items.map((it) => {
                  // `lineAmount` is always line total; unit price matches API `variantPrice`.
                  const variantPrice =
                      it.quantity > 0 ? it.lineAmount / it.quantity : 0;
                  return { variant: it.variant, quantity: it.quantity, variantPrice };
              })
            : [{ variant: '', quantity: 1, variantPrice: 0 }]
    );
    const [amount, setAmount] = useState<string>('');
    const [awb, setAwb] = useState<string>(initialOrder?.awbNumber || '');
    const [isShipped, setIsShipped] = useState(initialOrder?.is_shipped ?? false);

    useEffect(() => {
        setIsShipped(initialOrder?.is_shipped ?? false);
    }, [initialOrder?.id]);

    const [pickedUpDateInput, setPickedUpDateInput] = useState(() =>
        orderDateFieldToYmd(initialOrder?.pickedUpDate),
    );
    const [deliveredAtInput, setDeliveredAtInput] = useState(() =>
        orderDateFieldToYmd(initialOrder?.deliveredAt),
    );
    const [returnedAtInput, setReturnedAtInput] = useState(() =>
        orderDateFieldToYmd(initialOrder?.returnedAt),
    );

    useEffect(() => {
        setPickedUpDateInput(orderDateFieldToYmd(initialOrder?.pickedUpDate));
        setDeliveredAtInput(orderDateFieldToYmd(initialOrder?.deliveredAt));
        setReturnedAtInput(orderDateFieldToYmd(initialOrder?.returnedAt));
    }, [
        initialOrder?.id,
        initialOrder?.pickedUpDate,
        initialOrder?.deliveredAt,
        initialOrder?.returnedAt,
    ]);

    const [delhiveryWaybillLoading, setDelhiveryWaybillLoading] = useState(false);
    const [delhiveryWaybillError, setDelhiveryWaybillError] = useState<string | null>(null);

    const [shippingTrackingCompanyInput, setShippingTrackingCompanyInput] = useState<
        TrackingCompany | ''
    >(() => normalizeTrackingCompany(initialOrder?.shippingTrackingCompany));

    useEffect(() => {
        setShippingTrackingCompanyInput(
            normalizeTrackingCompany(initialOrder?.shippingTrackingCompany)
        );
    }, [initialOrder?.id]);

    const courierForDefaultUrl = shippingTrackingCompanyInput.trim() || 'Delhivery';
    const resolvedTrackingUrl = buildDefaultTrackingUrlFromCourier(awb, courierForDefaultUrl);

    /** Line items + COD − discount − partial (same as Total Amount field − partial). */
    const amountToCollect = useMemo(() => {
        const itemsSubtotal = items.reduce((sum, it) => sum + it.variantPrice * it.quantity, 0);
        return (
            itemsSubtotal +
            (Number(codCharges) || 0) -
            (Number(discount) || 0) -
            (Number(partialAmount) || 0)
        );
    }, [items, codCharges, discount, partialAmount]);

    const [saving, setSaving] = useState(false);

    const getAvailableProducts = (currentIdx: number) => {
        const selectedVariants = items
            .map((it, idx) => (idx !== currentIdx ? it.variant : ''))
            .filter(Boolean);
        return products.filter((product) => {
            const variantStr = formatVariantLabel(product);
            return !selectedVariants.includes(variantStr);
        });
    };

    useEffect(() => {
        const itemsTotal = items.reduce((sum, it) => sum + it.variantPrice * it.quantity, 0);
        const codChargesAmount = Number(codCharges) || 0;
        const discountAmount = Number(discount) || 0;
        const total = itemsTotal + codChargesAmount - discountAmount;
        setAmount(String(total));
    }, [items, codCharges, discount]);

    const generateDelhiveryWaybill = useCallback(async () => {
        if (delhiveryWaybillLoading) return;
        setDelhiveryWaybillError(null);
        if (!name.trim()) {
            setDelhiveryWaybillError('Customer name is required.');
            return;
        }
        if (phone.replace(/\D/g, '').length < 10) {
            setDelhiveryWaybillError('Valid 10-digit phone is required.');
            return;
        }
        if (!address.trim()) {
            setDelhiveryWaybillError('Address is required.');
            return;
        }
        if (pincode.length !== 6) {
            setDelhiveryWaybillError('6-digit pincode is required.');
            return;
        }
        if (!state.trim()) {
            setDelhiveryWaybillError('State is required.');
            return;
        }
        if (!payment) {
            setDelhiveryWaybillError('Select payment mode first.');
            return;
        }
        const orderRef =
            (initialOrder?.id && String(initialOrder.id).trim()) ||
            `PH-${phone.replace(/\D/g, '').slice(-10)}-${pincode}-${Date.now()}`;
        const payload = buildDelhiveryCmuPayload({
            name: name.trim(),
            phone,
            address: address.trim(),
            pincode,
            state: state.trim(),
            payment,
            amount,
            items,
            orderRef,
            orderDateIso: new Date(date).toISOString(),
        });

        try {
            setDelhiveryWaybillLoading(true);
            const res = await apiFetch('/api/delhivery-create-waybill', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify(payload),
            });
            const data: unknown = await res.json().catch(() => null);
            if (!res.ok) {
                const o = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
                const msg =
                    (o?.message != null && String(o.message)) ||
                    (o?.rmk != null && String(o.rmk)) ||
                    `Request failed (${res.status})`;
                throw new Error(msg);
            }
            const apiErr = delhiveryCreateErrorMessage(data);
            if (apiErr) throw new Error(apiErr);
            const wb = parseWaybillFromDelhiveryCreate(data);
            if (!wb) {
                throw new Error(
                    'No waybill in Delhivery response. Confirm pickup warehouse name and GST/HSN settings with Delhivery.'
                );
            }
            setAwb(wb);
            setShippingTrackingCompanyInput('Delhivery');
        } catch (e) {
            setDelhiveryWaybillError(e instanceof Error ? e.message : 'Failed to generate waybill');
        } finally {
            setDelhiveryWaybillLoading(false);
        }
    }, [
        delhiveryWaybillLoading,
        name,
        phone,
        address,
        pincode,
        state,
        payment,
        amount,
        items,
        date,
        initialOrder?.id,
    ]);

    function addItem() {
        setItems((prev) => [...prev, { variant: '', quantity: 1, variantPrice: 0 }]);
    }
    function removeItem(idx: number) {
        setItems((prev) => prev.filter((_, i) => i !== idx));
    }
    function updateItem(
        idx: number,
        key: 'variant' | 'quantity' | 'variantPrice',
        value: string | number
    ) {
        setItems((prev) => {
            const updated = prev.map((it, i) => {
                if (i === idx) {
                    if (key === 'variant') {
                        const variantStr = value as string;
                        const product = products.find(
                            (p) => formatVariantLabel(p) === variantStr
                        );
                        return {
                            ...it,
                            variant: variantStr,
                            variantPrice: product ? product.price : 0,
                        };
                    } else if (key === 'quantity') {
                        return { ...it, quantity: Number(value) || 0 };
                    } else {
                        return { ...it, variantPrice: Number(value) || 0 };
                    }
                }
                return it;
            });
            return updated;
        });
    }

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        if (saving) return;
        if (!type) {
            alert('Please select Type');
            return;
        }
        if (!payment || !platform) {
            alert('Please select both Platform and Payment Mode');
            return;
        }
        const order: Order = {
            id: initialOrder?.id || '',
            date: new Date(date).toISOString(),
            customer: name,
            customerPhone: phone,
            customerAddress: address,
            items: items.map(
                (it) =>
                    ({
                        variant: it.variant,
                        quantity: it.quantity,
                        lineAmount: it.variantPrice * it.quantity,
                    } as OrderItem)
            ),
            amount: Number(amount || 0),
            paymentStatus: payment as PaymentStatus,
            fulfillmentStatus: fulfillment,
            deliveryStatus: delivery,
            pincode: pincode || undefined,
            codCharges: codCharges ? Number(codCharges) : undefined,
            partialAmount: partialAmount !== '' ? Number(partialAmount) || 0 : 0,
            discountAmount: discount ? Number(discount) : undefined,
            awbNumber: awb.trim(),
            shippingTrackingUrl: resolvedTrackingUrl || undefined,
            shippingTrackingCompany: shippingTrackingCompanyInput || undefined,
            notes: notes || undefined,
            state,
            platform: platform as Platform,
            type: (type || initialOrder?.type || 'New') as OrderType,
            is_shipped: isShipped,
            pickedUpDate: pickedUpDateInput.trim() || undefined,
            deliveredAt: deliveredAtInput.trim() || undefined,
            returnedAt: returnedAtInput.trim() || undefined,
        };
        try {
            setSaving(true);
            await Promise.resolve(onCreate(order));
        } finally {
            setSaving(false);
        }
    }

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    return (
        <div role="dialog" aria-modal="true" className="shopify-add-modal-backdrop">
            <div className="card shopify-add-modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="shopify-add-modal-header">
                    <h3 className="shopify-add-modal-title">
                        {mode === 'edit' ? 'Edit Order' : 'Add Order'}
                    </h3>
                    <button
                        className="icon-btn shopify-add-modal-close"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>
                <form onSubmit={submit} className="shopify-add-modal-form">
                    <div className="shopify-add-modal-body">
                        <div className="shopify-add-modal-grid">
                            <div className="shopify-add-modal-left">
                                <AddModalSection id="add-modal-section-customer" title="Customer">
                                    <div className="shopify-add-modal-section-grid shopify-add-modal-section-grid--customer-top">
                                        <div>
                                            <label className="label">Phone</label>
                                            <PhoneDropdown
                                                selectedPhone={phone}
                                                phone={phone}
                                                onSelectSearchResult={(customer) => {
                                                    setName(customer.name);
                                                    setPhone(
                                                        customer.phoneNumber.replace(/\D/g, '').slice(-10)
                                                    );
                                                    setAddress(customer.address || '');
                                                    setState(customer.state || '');
                                                    setPincode(customer.pincode || '');
                                                    setType('Repeat');
                                                }}
                                                onNewPhone={(newPhone) => {
                                                    setPhone(newPhone);
                                                    setName('');
                                                    setAddress('');
                                                    setState('');
                                                    setPincode('');
                                                    setType('New');
                                                }}
                                                required
                                                skipSearch={
                                                    mode === 'edit' ||
                                                    (mode === 'add' && type === 'Repeat')
                                                }
                                                disabled={customerSectionLocked}
                                            />
                                        </div>
                                        <div>
                                            <label className="label">Customer name</label>
                                            <AddModalInputWrap icon={ADD_MODAL_FIELD_ICONS.user}>
                                                <input
                                                    className={`input shopify-add-modal-input${customerSectionLocked ? ' shopify-add-modal-input--readonly' : ''}`}
                                                    type="text"
                                                    value={name}
                                                    onChange={(e) => setName(e.target.value)}
                                                    required={!customerSectionLocked}
                                                    disabled={customerSectionLocked}
                                                />
                                            </AddModalInputWrap>
                                        </div>
                                        <div>
                                            <label className="label">Type</label>
                                            <ModernSelect<OrderType | ''>
                                                variant="default"
                                                value={type}
                                                onChange={(v) => setType(v)}
                                                options={ORDER_MODAL_TYPE_OPTIONS}
                                                placeholder="Select type"
                                                aria-label="Order type"
                                                disabled
                                            />
                                        </div>
                                    </div>
                                    <div className="shopify-add-modal-single-column shopify-add-modal-single-column--tight">
                                        <div>
                                            <label className="label">Address</label>
                                            <AddModalInputWrap icon={ADD_MODAL_FIELD_ICONS.mapPin}>
                                                <input
                                                    className={`input shopify-add-modal-input${customerSectionLocked ? ' shopify-add-modal-input--readonly' : ''}`}
                                                    value={address}
                                                    onChange={(e) => setAddress(e.target.value)}
                                                    required={!customerSectionLocked}
                                                    disabled={customerSectionLocked}
                                                />
                                            </AddModalInputWrap>
                                        </div>
                                    </div>
                                    <div className="shopify-add-modal-section-grid shopify-add-modal-section-grid--customer-loc">
                                        <div>
                                            <label className="label">Pincode</label>
                                            <AddModalInputWrap icon={ADD_MODAL_FIELD_ICONS.hash}>
                                                <input
                                                    className={`input shopify-add-modal-input${customerSectionLocked ? ' shopify-add-modal-input--readonly' : ''}`}
                                                    type="tel"
                                                    value={pincode}
                                                    onChange={(e) => {
                                                        const value = e.target.value.replace(/\D/g, '');
                                                        if (value.length <= 6) {
                                                            setPincode(value);
                                                        }
                                                    }}
                                                    maxLength={6}
                                                    pattern="[0-9]{6}"
                                                    required={!customerSectionLocked}
                                                    disabled={customerSectionLocked}
                                                />
                                            </AddModalInputWrap>
                                        </div>
                                        <div>
                                            <label className="label">State</label>
                                            <StateSearchDropdown
                                                value={state}
                                                onChange={setState}
                                                placeholder="Select state"
                                                required={!customerSectionLocked}
                                                disabled={customerSectionLocked}
                                            />
                                        </div>
                                        <div>
                                            <label className="label">Date</label>
                                            <DatePicker
                                                value={date}
                                                onChange={setDate}
                                                placeholder="Select date"
                                            />
                                        </div>
                                    </div>
                                </AddModalSection>

                                <AddModalSection id="add-modal-section-order" title="Order details">
                                    <div className="shopify-add-modal-subblock">
                                        <div className="shopify-add-modal-subblock__title">
                                            Line items
                                        </div>
                                        <div className="shopify-add-modal-items">
                                        {items.map((it, idx) => {
                                            const availableProducts = getAvailableProducts(idx);
                                            return (
                                                <div
                                                    key={idx}
                                                    className="shopify-add-modal-item-row"
                                                >
                                                    <div>
                                                        <VariantDropdown
                                                            value={it.variant}
                                                            options={availableProducts}
                                                            onChange={(variantStr) =>
                                                                updateItem(idx, 'variant', variantStr)
                                                            }
                                                            placeholder="Select product"
                                                            required
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="label">Quantity</label>
                                                        <AddModalInputWrap icon={ADD_MODAL_FIELD_ICONS.layers}>
                                                            <input
                                                                className="input shopify-add-modal-input"
                                                                type="number"
                                                                min={1}
                                                                value={it.quantity}
                                                                onChange={(e) =>
                                                                    updateItem(idx, 'quantity', e.target.value)
                                                                }
                                                                required
                                                            />
                                                        </AddModalInputWrap>
                                                    </div>
                                                    <div>
                                                        <label className="label">Price (₹)</label>
                                                        <AddModalInputWrap icon={ADD_MODAL_FIELD_ICONS.rupee}>
                                                            <input
                                                                className="input shopify-add-modal-input"
                                                                type="number"
                                                                min={0}
                                                                value={it.variantPrice || ''}
                                                                onChange={(e) =>
                                                                    updateItem(idx, 'variantPrice', e.target.value)
                                                                }
                                                                required
                                                            />
                                                        </AddModalInputWrap>
                                                    </div>
                                                    <div>
                                                        <label className="label shopify-add-modal-label-hidden">
                                                            Remove
                                                        </label>
                                                        <button
                                                            type="button"
                                                            className="icon-btn"
                                                            onClick={() => removeItem(idx)}
                                                            aria-label="Remove item"
                                                        >
                                                            –
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <button
                                            type="button"
                                            className="filter-btn shopify-add-modal-add-item-btn"
                                            onClick={addItem}
                                        >
                                            + Add item
                                        </button>
                                        </div>
                                    </div>

                                <div className="shopify-add-modal-section-grid">
                                    <div>
                                        <label className="label">Platform</label>
                                        <ModernSelect<Platform | ''>
                                            variant="default"
                                            value={platform}
                                            onChange={(v) => setPlatform(v)}
                                            options={ORDER_MODAL_PLATFORM_OPTIONS}
                                            placeholder="Select Platform"
                                            aria-label="Platform"
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Payment Mode</label>
                                        <ModernSelect<PaymentStatus | ''>
                                            variant="default"
                                            value={payment}
                                            onChange={(v) => setPayment(v)}
                                            options={ORDER_MODAL_PAYMENT_OPTIONS}
                                            placeholder="Select Payment Mode"
                                            aria-label="Payment mode"
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Fulfillment status</label>
                                        <ModernSelect<FulfillmentStatus>
                                            variant="default"
                                            value={fulfillment}
                                            onChange={(v) => setFulfillment(v as FulfillmentStatus)}
                                            options={ORDER_MODAL_FULFILLMENT_OPTIONS}
                                            aria-label="Fulfillment status"
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Shipping status</label>
                                        <ModernSelect<DeliveryStatus>
                                            variant="default"
                                            value={delivery}
                                            onChange={(v) => setDelivery(v as DeliveryStatus)}
                                            options={ORDER_MODAL_DELIVERY_OPTIONS}
                                            aria-label="Shipping status"
                                        />
                                    </div>
                                </div>

                                <div className="shopify-add-modal-section-grid">
                                    <div>
                                        <label className="label">COD Charges (₹)</label>
                                        <AddModalInputWrap icon={ADD_MODAL_FIELD_ICONS.wallet}>
                                            <input
                                                className="input shopify-add-modal-input"
                                                type="number"
                                                min={0}
                                                step="0.01"
                                                value={codCharges}
                                                onChange={(e) => setCodCharges(e.target.value)}
                                            />
                                        </AddModalInputWrap>
                                    </div>
                                    <div>
                                        <label className="label">Partial amount (₹)</label>
                                        <AddModalInputWrap icon={ADD_MODAL_FIELD_ICONS.rupee}>
                                            <input
                                                className="input shopify-add-modal-input"
                                                type="number"
                                                min={0}
                                                step="0.01"
                                                value={partialAmount}
                                                onChange={(e) => setPartialAmount(e.target.value)}
                                            />
                                        </AddModalInputWrap>
                                    </div>
                                    <div>
                                        <label className="label">Discount (₹)</label>
                                        <AddModalInputWrap icon={ADD_MODAL_FIELD_ICONS.percent}>
                                            <input
                                                className="input shopify-add-modal-input"
                                                type="number"
                                                min={0}
                                                step="0.01"
                                                value={discount}
                                                onChange={(e) => setDiscount(e.target.value)}
                                            />
                                        </AddModalInputWrap>
                                    </div>
                                    <div>
                                        <label className="label">Total Amount (₹)</label>
                                        <AddModalInputWrap icon={ADD_MODAL_FIELD_ICONS.sigma}>
                                            <input
                                                className="input shopify-add-modal-input shopify-add-modal-input--readonly"
                                                type="number"
                                                min={0}
                                                value={amount}
                                                readOnly
                                                required
                                            />
                                        </AddModalInputWrap>
                                    </div>
                                </div>

                                <div className="shopify-add-modal-notes shopify-add-modal-notes--in-section">
                                    <label className="label">Notes</label>
                                    <AddModalInputWrap icon={ADD_MODAL_FIELD_ICONS.notes} variant="textarea">
                                        <textarea
                                            className="input shopify-add-modal-notes-textarea"
                                            placeholder="Internal notes about this order (optional)"
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                        />
                                    </AddModalInputWrap>
                                </div>
                                </AddModalSection>
                            </div>

                            <div className="shopify-add-modal-sidebar">
                                <AddModalSection id="add-modal-section-tracking" title="Tracking details">
                                    <div className="shopify-add-modal-shipped-row shopify-add-modal-shipped-row--section">
                                        <span
                                            className="shopify-add-modal-shipped-label"
                                            id="shipped-toggle-label"
                                        >
                                            Marked as shipped
                                        </span>
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={isShipped}
                                            aria-labelledby="shipped-toggle-label"
                                            className={
                                                'shopify-add-modal-shipped-toggle' +
                                                (isShipped ? ' shopify-add-modal-shipped-toggle--on' : '')
                                            }
                                            onClick={() => setIsShipped((v) => !v)}
                                        >
                                            <span
                                                className="shopify-add-modal-shipped-toggle-knob"
                                                aria-hidden
                                            />
                                        </button>
                                    </div>

                                    <div className="shopify-add-modal-tracking-fields">
                                        <label className="label shopify-add-modal-tracking-label">
                                            AWB number
                                        </label>
                                        <AddModalInputWrap icon={ADD_MODAL_FIELD_ICONS.barcode}>
                                            <input
                                                className="input shopify-add-modal-tracking-input"
                                                type="text"
                                                value={awb}
                                                onChange={(e) => setAwb(e.target.value)}
                                                placeholder="Waybill or tracking ID"
                                            />
                                        </AddModalInputWrap>
                                        <label className="label shopify-add-modal-tracking-label">
                                            Tracking company
                                        </label>
                                        <ModernSelect<TrackingCompany>
                                            variant="default"
                                            value={shippingTrackingCompanyInput}
                                            onChange={(v) => setShippingTrackingCompanyInput(v)}
                                            options={ORDER_MODAL_TRACKING_COMPANY_OPTIONS}
                                            placeholder="Select carrier"
                                            aria-label="Tracking company"
                                            className="shopify-add-modal-tracking-input"
                                        />
                                    </div>

                                    <div className="shopify-add-modal-timeline-block">
                                        <div className="shopify-add-modal-shipping-dates">
                                            <label className="label shopify-add-modal-tracking-label">
                                                Pickup date
                                            </label>
                                            <DatePicker
                                                value={pickedUpDateInput}
                                                onChange={setPickedUpDateInput}
                                                placeholder="Select pickup date"
                                            />
                                            <label className="label shopify-add-modal-tracking-label">
                                                Delivered on
                                            </label>
                                            <DatePicker
                                                value={deliveredAtInput}
                                                onChange={setDeliveredAtInput}
                                                placeholder="Select date"
                                                disabled
                                            />
                                            <label className="label shopify-add-modal-tracking-label">
                                                Returned on
                                            </label>
                                            <DatePicker
                                                value={returnedAtInput}
                                                onChange={setReturnedAtInput}
                                                placeholder="Select date"
                                                disabled
                                            />
                                        </div>
                                        <div className="shopify-delhivery-waybill-actions">
                                            <button
                                                type="button"
                                                className="button shopify-delhivery-waybill-btn"
                                                onClick={() => void generateDelhiveryWaybill()}
                                                disabled={
                                                    delhiveryWaybillLoading ||
                                                    saving ||
                                                    !name.trim() ||
                                                    phone.replace(/\D/g, '').length < 10 ||
                                                    !address.trim() ||
                                                    pincode.length !== 6 ||
                                                    !state.trim() ||
                                                    !payment
                                                }
                                            >
                                                {delhiveryWaybillLoading ? (
                                                    <>
                                                        <Spinner
                                                            size="sm"
                                                            className="shopify-delhivery-waybill-btn-spinner"
                                                        />{' '}
                                                        Generating…
                                                    </>
                                                ) : (
                                                    'Generate waybill'
                                                )}
                                            </button>
                                            {delhiveryWaybillError ? (
                                                <p
                                                    className="shopify-delhivery-waybill-error"
                                                    role="alert"
                                                >
                                                    {delhiveryWaybillError}
                                                </p>
                                            ) : null}
                                        </div>
                                        {resolvedTrackingUrl ? (
                                            <div className="shopify-tracking-link-wrap">
                                                <a
                                                    href={resolvedTrackingUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="shopify-tracking-link"
                                                >
                                                    Open tracking in new tab
                                                </a>
                                            </div>
                                        ) : null}
                                    </div>

                                    <div
                                        className="shopify-add-modal-amount-to-collect"
                                        aria-live="polite"
                                    >
                                        <div className="shopify-add-modal-amount-to-collect__label">
                                            Amount to Collect
                                        </div>
                                        <div className="shopify-add-modal-amount-to-collect__value">
                                            ₹
                                            {amountToCollect.toLocaleString('en-IN', {
                                                maximumFractionDigits: 2,
                                            })}
                                        </div>
                                    </div>
                                </AddModalSection>
                            </div>
                        </div>
                    </div>

                    <div className="shopify-add-modal-footer">
                        <button type="button" className="icon-btn" onClick={onClose} disabled={saving}>
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="button shopify-add-modal-submit"
                            disabled={saving}
                        >
                            {saving ? (
                                <>
                                    <Spinner size="sm" className="shopify-add-modal-submit-spinner" />{' '}
                                    {mode === 'edit' ? 'Saving…' : 'Creating…'}
                                </>
                            ) : (
                                mode === 'edit' ? 'Save changes' : 'Create order'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default AddOrderModal;
