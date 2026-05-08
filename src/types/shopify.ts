/**
 * Shipping/tracking details from Shopify order API.
 */
export interface ShopifyShippingDetails {
    trackingNumber?: string;
    trackingStatus?: string;
    trackingUrl?: string;
    trackingCompany?: string;
    pickedUpDate?: string;
    deliveredAt?: string;
    returnedAt?: string;
}

/**
 * Customer as returned by GET /api/customers/search?phone=...
 */
export interface CustomerSearchResult {
    _id: string;
    name: string;
    phoneNumber: string;
    email?: string;
    address: string;
    state: string;
    pincode: string;
    shopifyCustomerId?: string;
    createdAt?: string;
    updatedAt?: string;
    __v?: number;
    countryCode?: string;
}

/**
 * Customer as returned by GET /api/customers.
 * Same shape as search result, but modelled separately for clarity.
 */
export interface CustomerApi extends CustomerSearchResult {}

export interface CustomersDashboardResponse {
    count: number;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    rows: CustomerApi[];
}

/**
 * Customer as returned in Shopify order (populated or ref).
 */
export interface ShopifyOrderCustomer {
    _id: string;
    name: string;
    phoneNumber: string;
    email?: string;
    address: string;
    state: string;
    pincode: string;
    shopifyCustomerId?: string;
    countryCode?: string;
    createdAt?: string;
    updatedAt?: string;
    __v?: number;
    /** Present when customer record was last updated by a user (id or populated ref). */
    updatedBy?: string | ShopifyOrderUserRef;
}

/** Category embedded on populated `productId` in GET /api/orders rows. */
export interface ShopifyOrderProductCategory {
    _id: string;
    name: string;
}

/**
 * Populated product on an order line (GET /orders often includes `category`).
 */
export interface ShopifyOrderProductPopulated {
    _id: string;
    name: string;
    category?: ShopifyOrderProductCategory;
}

/**
 * Product line in a Shopify order (productId may be populated).
 */
export interface ShopifyOrderProduct {
    /**
     * In some responses this is a populated object (with optional `category`), in others it's just the id string.
     */
    productId: ShopifyOrderProductPopulated | string;
    variantId?: string;
    variantName: string;
    variantSku?: string | null;
    variantPrice: number;
    /** Unit/list price context from API (optional). */
    actualPrice?: number;
    quantity: number;
    price: number;
}

/**
 * Shopify order as returned by GET /api/orders (customer may be populated object or id).
 */
export interface ShopifyOrderUserRef {
    _id: string;
    name: string;
}

export interface ShopifyOrderApi {
    _id: string;
    shopifyOrderId?: string;
    customer?: ShopifyOrderCustomer | string;
    customerName?: string;
    phoneNumber?: string;
    address?: string;
    date: string;
    state: string;
    pincode: string;
    type: string;
    products: ShopifyOrderProduct[];
    platform: string;
    paymentMode: string;
    /** Order condition/status note from API root payload. */
    condition?: string;
    /** Free-form remarks from API root payload. */
    remarks?: string;
    fulfillmentStatus: string;
    returnStatus: boolean;
    /** Whether the order has been shipped (from API / backend). */
    is_shipped?: boolean;
    codCharges: number;
    shippingCharges: number;
    partialAmount?: number;
    discount: number;
    totalAmount: number;
    notes: string;
    updatedBy?: ShopifyOrderUserRef;
    shippingDetails?: ShopifyShippingDetails;
    /** Some APIs expose these on the order root as well as under `shippingDetails`. */
    pickedUpDate?: string;
    deliveredAt?: string;
    returnedAt?: string;
    createdAt?: string;
    updatedAt?: string;
    __v?: number;
}

/**
 * Response from GET /api/orders/customer/:id.
 */
export interface CustomerOrdersResponse {
    customer: ShopifyOrderCustomer;
    count: number;
    orders: ShopifyOrderApi[];
}
