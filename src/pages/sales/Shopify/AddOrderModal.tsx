import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { toInputDate } from './ShopifyShared';
import { DatePicker } from './DatePicker';
import { Spinner } from '../../../components/Spinner';
import './Shopify.scss';

const DEBOUNCE_MS = 350;

export type ProductVariantOption = { id: string; name: string; size: string; price: number };

function PhoneDropdown({
    selectedPhone,
    onSelectSearchResult,
    onNewPhone,
    phone,
    required,
    skipSearch,
}: {
    selectedPhone: string;
    phone: string;
    onSelectSearchResult: (customer: CustomerSearchResult) => void;
    onNewPhone?: (phone: string) => void;
    required?: boolean;
    /** When true, do not call customer search API (e.g. in edit mode when phone is prefilled). */
    skipSearch?: boolean;
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
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (skipSearch || !digits) {
            if (!digits) setSearchResults([]);
            return;
        }
        debounceRef.current = setTimeout(() => runSearch(digits), DEBOUNCE_MS);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [digits, runSearch, skipSearch]);

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
            const popupHeight = 300;
            const popupWidth = 400;
            let top = containerRect.bottom + window.scrollY + 4;
            let left = containerRect.left + window.scrollX;
            if (containerRect.bottom + popupHeight > window.innerHeight) {
                top = containerRect.top + window.scrollY - popupHeight - 4;
            }
            if (containerRect.left + popupWidth > window.innerWidth) {
                left = window.innerWidth - popupWidth - 10;
            }
            popup.style.top = `${top}px`;
            popup.style.left = `${left}px`;
        }
    }, [isOpen, searchResults.length]);

    return (
        <div ref={containerRef} className="shopify-phonedrop-root">
            <div className="shopify-phonedrop-inner">
                <input
                    type="tel"
                    className="input shopify-phonedrop-input"
                    value={phone}
                    onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        if (value.length <= 10) {
                            if (onNewPhone) onNewPhone(value);
                            setSearchQuery(value);
                            setIsOpen(true);
                        }
                    }}
                    onFocus={() => setIsOpen(true)}
                    placeholder="Type phone number to search..."
                    maxLength={10}
                    pattern="[0-9]{10}"
                    required={required}
                />
                <div className="shopify-phonedrop-chevron" onClick={() => setIsOpen((o) => !o)}>
                    <span>▼</span>
                </div>
            </div>
            {isOpen && (
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
        if (!isOpen || !popupRef.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const popup = popupRef.current;
        const popupHeight = 320;
        let top = rect.bottom + 4;
        let left = rect.left;
        if (rect.bottom + popupHeight > window.innerHeight) {
            top = rect.top - popupHeight - 4;
        }
        if (rect.left + 320 > window.innerWidth) {
            left = window.innerWidth - 320 - 12;
        }
        popup.style.top = `${top}px`;
        popup.style.left = `${left}px`;
    }, [isOpen, searchQuery, filteredOptions.length]);

    const displayLabel = value || placeholder;

    return (
        <div ref={containerRef} className="variant-dropdown-root">
            <label className="label">Variant</label>
            <button
                type="button"
                className="variant-dropdown-trigger"
                onClick={() => setIsOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-label={displayLabel}
            >
                <span className={!value ? 'variant-dropdown-placeholder' : ''}>
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
                                    : 'No matches for “‘ + searchQuery.trim() + ’"'}
                            </div>
                        ) : (
                            filteredOptions.map((product) => {
                                const variantStr = `${product.name} - ${product.size}`;
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
                                            {product.size} · ₹{product.price.toLocaleString('en-IN')}
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
    const [payment, setPayment] = useState<PaymentStatus | ''>(
        initialOrder?.paymentStatus || ''
    );
    const [fulfillment, setFulfillment] = useState<FulfillmentStatus>(
        initialOrder?.fulfillmentStatus || 'Fulfilled'
    );
    const [delivery, setDelivery] = useState<DeliveryStatus>(
        initialOrder?.deliveryStatus || 'In Transit'
    );
    const [platform, setPlatform] = useState<Platform | ''>(initialOrder?.platform || '');
    const [codCharges, setCodCharges] = useState<string>(
        initialOrder?.codCharges?.toString() ||
            initialOrder?.shippingAmount?.toString() ||
            ''
    );
    const [shippingCharges, setShippingCharges] = useState<string>(
        initialOrder?.shippingCharges?.toString() || ''
    );
    const [discount, setDiscount] = useState<string>(
        initialOrder?.discountAmount?.toString() || ''
    );
    const [notes, setNotes] = useState<string>(initialOrder?.notes || '');
    const [items, setItems] = useState<
        Array<{ variant: string; quantity: number; price: number }>
    >(
        initialOrder?.items && initialOrder.items.length > 0
            ? initialOrder.items.map((it) => {
                  const price =
                      mode === 'edit'
                          ? it.lineAmount
                          : it.quantity > 0
                          ? it.lineAmount / it.quantity
                          : 0;
                  return { variant: it.variant, quantity: it.quantity, price };
              })
            : [{ variant: '', quantity: 1, price: 0 }]
    );
    const [amount, setAmount] = useState<string>('');
    const [awb, setAwb] = useState<string>(initialOrder?.awbNumber || '');
    const [tracking, setTracking] = useState<{
        awb: string;
        statusText?: string;
        statusLocation?: string;
        statusDateTime?: string;
        expectedDeliveryDate?: string;
        pickupDate?: string;
        origin?: string;
        destination?: string;
        scans: Array<{
            status: string;
            instructions: string;
            location: string;
            dateTime: string;
        }>;
    } | null>(null);
    const [trackingLoading, setTrackingLoading] = useState(false);
    const [trackingError, setTrackingError] = useState<string | null>(null);

    const trackingUrlFromApi = initialOrder?.shippingTrackingUrl || '';
    const trackingCompanyFromApi = initialOrder?.shippingTrackingCompany || '';
    const trackingUrl = trackingUrlFromApi
        ? trackingUrlFromApi
        : awb.trim()
        ? `https://www.delhivery.com/track/package/${encodeURIComponent(awb.trim())}`
        : '';
    const [saving, setSaving] = useState(false);

    const getAvailableProducts = (currentIdx: number) => {
        const selectedVariants = items
            .map((it, idx) => (idx !== currentIdx ? it.variant : ''))
            .filter(Boolean);
        return products.filter((product) => {
            const variantStr = `${product.name} - ${product.size}`;
            return !selectedVariants.includes(variantStr);
        });
    };

    useEffect(() => {
        const itemsTotal = items.reduce((sum, it) => sum + it.price * it.quantity, 0);
        const codChargesAmount = Number(codCharges) || 0;
        const shippingChargesAmount = Number(shippingCharges) || 0;
        const discountAmount = Number(discount) || 0;
        const total = itemsTotal + codChargesAmount + shippingChargesAmount - discountAmount;
        setAmount(String(total));
    }, [items, codCharges, shippingCharges, discount]);

    useEffect(() => {
        const trimmed = awb.trim();
        if (!trimmed) {
            setTracking(null);
            setTrackingError(null);
            return;
        }

        let cancelled = false;
        setTrackingLoading(true);
        setTrackingError(null);

        fetch(
                `https://track.delhivery.com/api/v1/packages/json/?waybill=${encodeURIComponent(trimmed)}`,
                {
                    headers: {
                        Authorization: 'Token cd8c22b7d58baf249855b7c02e66c71a07779a02',
                        'Content-Type': 'application/json',
                    },
                }
            )
            .then(async (res) => {
                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(text || `Request failed with ${res.status}`);
                }
                return res.json();
            })
            .then((data) => {
                if (cancelled) return;
                const shipment = data?.ShipmentData?.[0]?.Shipment;
                if (!shipment) {
                    setTracking(null);
                    setTrackingError('No tracking information found for this AWB.');
                    return;
                }

                const status = shipment.Status || {};
                const scans = Array.isArray(shipment.Scans)
                    ? shipment.Scans.map((s: any) => s.ScanDetail).filter(Boolean)
                    : [];

                const mappedScans =
                    scans
                        .map((scan: any) => ({
                            status: scan.Scan || '',
                            instructions: scan.Instructions || '',
                            location: scan.ScannedLocation || '',
                            dateTime: scan.ScanDateTime || '',
                        }))
                        .sort(
                            (a: any, b: any) =>
                                new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
                        ) ?? [];

                setTracking({
                    awb: shipment.AWB,
                    statusText: status.Status || '',
                    statusLocation: status.StatusLocation || '',
                    statusDateTime: status.StatusDateTime || '',
                    expectedDeliveryDate:
                        shipment.ExpectedDeliveryDate ||
                        shipment.PromisedDeliveryDate ||
                        null,
                    pickupDate: shipment.PickUpDate || shipment.PickedupDate || null,
                    origin: shipment.Origin || shipment.PickupLocation || '',
                    destination:
                        shipment.Destination ||
                        (shipment.Consignee && shipment.Consignee.City) ||
                        '',
                    scans: mappedScans,
                });
            })
            .catch((err) => {
                if (cancelled) return;
                console.error('Failed to load Delhivery tracking', err);
                setTracking(null);
                setTrackingError('Failed to load tracking details. Please try again.');
            })
            .finally(() => {
                if (!cancelled) {
                    setTrackingLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [awb]);

    function addItem() {
        setItems((prev) => [...prev, { variant: '', quantity: 1, price: 0 }]);
    }
    function removeItem(idx: number) {
        setItems((prev) => prev.filter((_, i) => i !== idx));
    }
    function updateItem(
        idx: number,
        key: 'variant' | 'quantity' | 'price',
        value: string | number
    ) {
        setItems((prev) => {
            const updated = prev.map((it, i) => {
                if (i === idx) {
                    if (key === 'variant') {
                        const variantStr = value as string;
                        const product = products.find(
                            (p) => `${p.name} - ${p.size}` === variantStr
                        );
                        return { ...it, variant: variantStr, price: product ? product.price : 0 };
                    } else if (key === 'quantity') {
                        return { ...it, quantity: Number(value) || 0 };
                    } else {
                        return { ...it, price: Number(value) || 0 };
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
                        lineAmount: it.price * it.quantity,
                    } as OrderItem)
            ),
            amount: Number(amount || 0),
            paymentStatus: payment as PaymentStatus,
            fulfillmentStatus: fulfillment,
            deliveryStatus: delivery,
            pincode: pincode || undefined,
            codCharges: codCharges ? Number(codCharges) : undefined,
            shippingCharges: shippingCharges ? Number(shippingCharges) : undefined,
            discountAmount: discount ? Number(discount) : undefined,
            awbNumber: awb || undefined,
            shippingTrackingUrl: trackingUrl || undefined,
            shippingTrackingCompany: trackingCompanyFromApi || undefined,
            notes: notes || undefined,
            state,
            platform: platform as Platform,
            type: type ? (type as OrderType) : undefined,
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
                                <div className="shopify-add-modal-section-grid">
                                    <div className="shopify-add-modal-field-half">
                                        <label className="label">Phone</label>
                                        <PhoneDropdown
                                            selectedPhone={phone}
                                            phone={phone}
                                            onSelectSearchResult={(customer) => {
                                                setName(customer.name);
                                                setPhone(customer.phoneNumber.replace(/\D/g, '').slice(-10));
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
                                            skipSearch={mode === 'edit'}
                                        />
                                    </div>
                                    <div className="shopify-add-modal-field-half">
                                        <label className="label">Customer Name</label>
                                        <input
                                            className="input shopify-add-modal-input"
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="shopify-add-modal-single-column">
                                    <div>
                                        <label className="label">Address</label>
                                        <input
                                            className="input shopify-add-modal-input"
                                            value={address}
                                            onChange={(e) => setAddress(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="shopify-add-modal-section-grid">
                                    <div>
                                        <label className="label">Date</label>
                                        <DatePicker
                                            value={date}
                                            onChange={setDate}
                                            placeholder="Select date"
                                        />
                                    </div>
                                    <div>
                                        <label className="label">State</label>
                                        <input
                                            className="input shopify-add-modal-input"
                                            value={state}
                                            onChange={(e) => setState(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Pincode</label>
                                        <input
                                            className="input shopify-add-modal-input"
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
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Type</label>
                                        <select
                                            className="input shopify-add-modal-input"
                                            value={type}
                                            onChange={(e) =>
                                                setType(e.target.value as OrderType | '')
                                            }
                                            required
                                        >
                                            <option value="">Select Type</option>
                                            <option value="New">New</option>
                                            <option value="Repeat">Repeat</option>
                                            <option value="Reference">Reference</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
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
                                                    </div>
                                                    <div>
                                                        <label className="label">Price (₹)</label>
                                                        <input
                                                            className="input shopify-add-modal-input"
                                                            type="number"
                                                            min={0}
                                                            value={it.price || ''}
                                                            onChange={(e) =>
                                                                updateItem(idx, 'price', e.target.value)
                                                            }
                                                            required
                                                        />
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
                                        <select
                                            className="input shopify-add-modal-input"
                                            value={platform}
                                            onChange={(e) =>
                                                setPlatform(e.target.value as Platform | '')
                                            }
                                            required
                                        >
                                            <option value="">Select Platform</option>
                                            {(['Shopify', 'Abandoned', 'Whatsapp', 'Amazon', 'Flipkart'] as Platform[]).map(
                                                (p) => (
                                                    <option key={p} value={p}>
                                                        {p}
                                                    </option>
                                                )
                                            )}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="label">Payment Mode</label>
                                        <select
                                            className="input shopify-add-modal-input"
                                            value={payment}
                                            onChange={(e) =>
                                                setPayment(e.target.value as PaymentStatus | '')
                                            }
                                            required
                                        >
                                            <option value="">Select Payment Mode</option>
                                            {(['COD', 'PAID'] as PaymentStatus[]).map((p) => (
                                                <option key={p} value={p}>
                                                    {p}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="label">Fullfillment Status</label>
                                        <select
                                            className="input shopify-add-modal-input"
                                            value={fulfillment}
                                            onChange={(e) =>
                                                setFulfillment(e.target.value as FulfillmentStatus)
                                            }
                                            required
                                        >
                                            {(['Unfulfilled', 'Fulfilled', 'Partial'] as FulfillmentStatus[]).map(
                                                (p) => (
                                                    <option key={p} value={p}>
                                                        {p}
                                                    </option>
                                                )
                                            )}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="label">Shipping Status</label>
                                        <select
                                            className="input shopify-add-modal-input"
                                            value={delivery}
                                            onChange={(e) =>
                                                setDelivery(e.target.value as DeliveryStatus)
                                            }
                                            required
                                        >
                                            {(['In Transit', 'Delivered', 'RTO', 'Pending Pickup'] as DeliveryStatus[]).map(
                                                (p) => (
                                                    <option key={p} value={p}>
                                                        {p}
                                                    </option>
                                                )
                                            )}
                                        </select>
                                    </div>
                                </div>

                                <div className="shopify-add-modal-section-grid">
                                    <div>
                                        <label className="label">COD Charges (₹)</label>
                                        <input
                                            className="input shopify-add-modal-input"
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={codCharges}
                                            onChange={(e) => setCodCharges(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Shipping Charges (₹)</label>
                                        <input
                                            className="input shopify-add-modal-input"
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={shippingCharges}
                                            onChange={(e) =>
                                                setShippingCharges(e.target.value)
                                            }
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Discount (₹)</label>
                                        <input
                                            className="input shopify-add-modal-input"
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={discount}
                                            onChange={(e) => setDiscount(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Total Amount (₹)</label>
                                        <input
                                            className="input shopify-add-modal-input shopify-add-modal-input--readonly"
                                            type="number"
                                            min={0}
                                            value={amount}
                                            readOnly
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="shopify-add-modal-notes">
                                    <label className="label">Notes</label>
                                    <textarea
                                        className="input shopify-add-modal-notes-textarea"
                                        placeholder="Internal notes about this order (optional)"
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="shopify-add-modal-sidebar">
                                <div className="shopify-add-modal-tracking-card">
                                    <label className="label shopify-add-modal-tracking-label">
                                        AWB No
                                    </label>
                                    <input
                                        className="input shopify-add-modal-tracking-input"
                                        type="text"
                                        value={awb}
                                        onChange={(e) => setAwb(e.target.value)}
                                        placeholder="Enter AWB"
                                    />
                                </div>
                                <div>
                                    <div className="label shopify-add-modal-shipping-timeline-label">
                                        Shipping timeline
                                    </div>
                                    <ShippingTimeline
                                        status={delivery}
                                        awb={awb}
                                        tracking={tracking}
                                        loading={trackingLoading}
                                        error={trackingError}
                                        trackingCompany={trackingCompanyFromApi}
                                    />
                                    {trackingUrl && (
                                        <div className="shopify-tracking-link-wrap">
                                            <a
                                                href={trackingUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="shopify-tracking-link"
                                            >
                                                Open tracking in new tab
                                            </a>
                                        </div>
                                    )}
                                </div>
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

function ShippingTimeline({
    status,
    awb,
    tracking,
    loading,
    error,
    trackingCompany,
}: {
    status: DeliveryStatus;
    awb: string;
    tracking: {
        awb: string;
        statusText?: string;
        statusLocation?: string;
        statusDateTime?: string;
        expectedDeliveryDate?: string;
        pickupDate?: string;
        origin?: string;
        destination?: string;
        scans: Array<{
            status: string;
            instructions: string;
            location: string;
            dateTime: string;
        }>;
    } | null;
    loading: boolean;
    error: string | null;
    trackingCompany?: string;
}) {
    const steps: DeliveryStatus[] = ['Pending Pickup', 'In Transit', 'Delivered', 'RTO'];
    const [blinkOn, setBlinkOn] = useState(true);

    useEffect(() => {
        const id = setInterval(() => {
            setBlinkOn((v) => !v);
        }, 800);
        return () => clearInterval(id);
    }, []);

    function formatShortDate(input?: string) {
        if (!input) return '';
        const d = new Date(input);
        if (Number.isNaN(d.getTime())) return input;
        return d.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    const currentStepIndex = steps.indexOf(status);
    const safeCurrentStep = currentStepIndex === -1 ? 0 : currentStepIndex;

    const scans = tracking?.scans ?? [];
    const sortedScans = [...scans].sort(
        (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
    );

    const hasAwb = awb.trim().length > 0;

    if (!hasAwb) {
        return (
            <div className="shopify-timeline-empty">
                <span className="shopify-timeline-empty-icon">📦</span>
                Enter an AWB number above to view live Delhivery tracking.
            </div>
        );
    }

    const hasTrackingInfo =
        !!tracking &&
        (sortedScans.length > 0 || tracking.statusText || tracking.statusLocation);

    if (!hasTrackingInfo && !loading && !error) {
        return (
            <div className="shopify-timeline-empty">
                <span className="shopify-timeline-empty-icon">🔍</span>
                No tracking information found for this AWB yet.
            </div>
        );
    }

    return (
        <div className="shopify-timeline-card">
            <div className={`shopify-timeline-header${tracking?.statusText === 'Delivered' ? ' shopify-timeline-header--delivered' : ''}`}>
                <div className="shopify-timeline-header-row">
                    <div className="shopify-timeline-awb-wrap">
                        <div className="shopify-timeline-awb-label">AWB</div>
                        <div className="shopify-timeline-awb-value">{awb || 'Not assigned'}</div>
                    </div>
                    <div className="shopify-timeline-badge">
                        <span>🚚</span>
                        <span>{trackingCompany || 'Delhivery'}</span>
                    </div>
                </div>

                {tracking && (
                    <div className="shopify-timeline-dates">
                        <div>
                            <div className="shopify-timeline-date-label">Pickup</div>
                            <div className="shopify-timeline-date-value">{formatShortDate(tracking.pickupDate) || '—'}</div>
                        </div>
                        <div>
                            <div className="shopify-timeline-date-label">Expected Delivery</div>
                            <div className="shopify-timeline-date-value">{formatShortDate(tracking.expectedDeliveryDate) || '—'}</div>
                        </div>
                    </div>
                )}
            </div>

            {hasTrackingInfo && (
                <div className="shopify-timeline-steps">
                    {steps.map((step, index) => {
                        const isActive = index === safeCurrentStep;
                        const isPast = index < safeCurrentStep;

                        let activeColor = '#0f172a';
                        let glowColor = 'rgba(15,23,42,0.15)';
                        if (step === 'In Transit') {
                            activeColor = '#2563eb';
                            glowColor = 'rgba(37,99,235,0.20)';
                        } else if (step === 'Delivered') {
                            activeColor = '#16a34a';
                            glowColor = 'rgba(22,163,74,0.20)';
                        } else if (step === 'RTO') {
                            activeColor = '#b91c1c';
                            glowColor = 'rgba(185,28,28,0.25)';
                        }

                        return (
                            <div key={step} className="shopify-timeline-step">
                                <div
                                    className="shopify-timeline-step-dot"
                                    style={{
                                        borderColor: isActive ? activeColor : isPast ? '#4b5563' : '#d1d5db',
                                        background: isActive ? activeColor : isPast ? '#4b5563' : '#f9fafb',
                                        opacity: isActive ? (blinkOn ? 1 : 0.25) : 1,
                                        boxShadow: isActive && blinkOn ? `0 0 0 4px ${glowColor}` : 'none',
                                    }}
                                />
                                <div
                                    className="shopify-timeline-step-label"
                                    style={{
                                        fontWeight: isActive ? 700 : isPast ? 600 : 500,
                                        color: isActive ? activeColor : isPast ? '#4b5563' : '#9ca3af',
                                    }}
                                >
                                    {step}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="shopify-timeline-footer">
                {loading && <div className="tracking-loading">Loading live tracking…</div>}
                {!loading && error && <div className="tracking-error">{error}</div>}
            </div>

            {tracking && sortedScans.length > 0 && (
                <div className="tracking-scans">
                    <div className="tracking-scans-title">Latest updates</div>
                    <div className="tracking-scans-list">
                        {[...sortedScans].reverse().map((scan, idx) => {
                            const d = scan.dateTime ? new Date(scan.dateTime) : null;
                            const ts = d
                                ? d.toLocaleString('en-IN', {
                                      day: '2-digit',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                  })
                                : scan.dateTime;
                            return (
                                <div
                                    key={`${scan.status}-${scan.dateTime}-${idx}`}
                                    className="tracking-scan-item"
                                >
                                    <div className="tracking-scan-header">
                                        <div className="tracking-scan-status">{scan.status}</div>
                                        {ts && <span className="tracking-scan-ts">{ts}</span>}
                                    </div>
                                    {scan.instructions && (
                                        <div className="tracking-scan-instructions">
                                            {scan.instructions}
                                        </div>
                                    )}
                                    {scan.location && (
                                        <div className="tracking-scan-location">
                                            📍 {scan.location}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

export default AddOrderModal;
