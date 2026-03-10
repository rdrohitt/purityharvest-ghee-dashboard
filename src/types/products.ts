/**
 * Category reference as returned inside a product (populated or ref).
 */
export interface ProductCategoryRef {
  _id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  __v?: number;
}

/**
 * Single variant of a product (GET /api/products response).
 */
export interface ProductVariantApi {
  name: string;
  price: number;
  actualPrice: number | null;
  stock: number;
}

/**
 * Product as returned by GET /api/products.
 */
export interface ProductApiItem {
  _id: string;
  name: string;
  shopifyProductId?: string;
  isShopify?: boolean;
  price: number;
  actualPrice: number | null;
  category: ProductCategoryRef | string | null;
  variants: ProductVariantApi[];
  createdAt?: string;
  updatedAt?: string;
  __v?: number;
}

/**
 * One table row: product + one variant (for UI).
 */
export interface ProductVariantRow {
  productId: string;
  productName: string;
  categoryName: string;
  variantName: string;
  price: number;
  actualPrice: number | null;
  stock: number;
  variantIndex: number;
  isShopify?: boolean;
}
