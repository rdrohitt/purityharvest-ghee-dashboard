import { createSlice } from '@reduxjs/toolkit';
import type { ProductApiItem } from '../types/products';

type ProductsState = {
	products: ProductApiItem[];
	loading: boolean;
};

const initialState: ProductsState = {
	products: [],
	loading: true,
};

const productSlice = createSlice({
	name: 'products',
	initialState,
	reducers: {
		setProducts: (state, action: { payload: ProductApiItem[] }) => {
			state.products = action.payload;
			state.loading = false;
		},
		setProductsLoading: (state, action: { payload: boolean }) => {
			state.loading = action.payload;
		},
		addProduct: (state, action: { payload: ProductApiItem }) => {
			state.products.unshift(action.payload);
		},
		updateProduct: (state, action: { payload: ProductApiItem }) => {
			const idx = state.products.findIndex((p) => p._id === action.payload._id);
			if (idx !== -1) state.products[idx] = action.payload;
		},
		removeProduct: (state, action: { payload: string }) => {
			state.products = state.products.filter((p) => p._id !== action.payload);
		},
		clearProducts: (state) => {
			state.products = [];
		},
	},
});

export const {
	setProducts,
	setProductsLoading,
	addProduct: addProductToStore,
	updateProduct: updateProductInStore,
	removeProduct,
	clearProducts,
} = productSlice.actions;
export default productSlice.reducer;
