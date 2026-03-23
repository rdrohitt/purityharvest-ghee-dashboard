import { createSlice } from '@reduxjs/toolkit';
import type { MarketingSpendApiItem } from '../types/marketing-spend';

type MarketingSpendState = {
	records: MarketingSpendApiItem[];
	loading: boolean;
};

const initialState: MarketingSpendState = {
	records: [],
	loading: false,
};

const marketingSpendSlice = createSlice({
	name: 'marketingSpend',
	initialState,
	reducers: {
		setMarketingSpendRecords: (state, action: { payload: MarketingSpendApiItem[] }) => {
			state.records = action.payload;
			state.loading = false;
		},
		setMarketingSpendLoading: (state, action: { payload: boolean }) => {
			state.loading = action.payload;
		},
		clearMarketingSpendRecords: (state) => {
			state.records = [];
		},
	},
});

export const { setMarketingSpendRecords, setMarketingSpendLoading, clearMarketingSpendRecords } =
	marketingSpendSlice.actions;
export default marketingSpendSlice.reducer;
