/**
 * Shipping/tracking details from Shopify order API.
 */
export interface ShopifyShippingDetails {
    trackingNumber: string;
    trackingStatus: string;
    trackingUrl: string;
    trackingCompany: string;
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
}

/**
 * Customer as returned in Shopify order (populated or ref).
 */
export interface ShopifyOrderCustomer {
    _id: string;
    name: string;
    phoneNumber: string;
    email: string;
    address: string;
    state: string;
    pincode: string;
    shopifyCustomerId: string;
    createdAt?: string;
    updatedAt?: string;
    __v?: number;
}

/**
 * Product line in a Shopify order (productId may be populated).
 */
export interface ShopifyOrderProduct {
    /**
     * In some responses this is a populated object, in others it's just the id string.
     */
    productId:
        | {
              _id: string;
              name: string;
          }
        | string;
    variantId: string;
    variantName: string;
    variantSku: string | null;
    variantPrice: number;
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
    fulfillmentStatus: string;
    returnStatus: boolean;
    codCharges: number;
    shippingCharges: number;
    discount: number;
    totalAmount: number;
    notes: string;
    updatedBy?: ShopifyOrderUserRef;
    shippingDetails?: ShopifyShippingDetails;
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
