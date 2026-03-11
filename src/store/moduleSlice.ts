import { createSlice } from '@reduxjs/toolkit';
import type { ModuleRecord } from '../types/modules';

type ModulesState = {
	modules: ModuleRecord[];
	loading: boolean;
};

const initialState: ModulesState = {
	modules: [],
	loading: true,
};

const moduleSlice = createSlice({
	name: 'modules',
	initialState,
	reducers: {
		setModules: (state, action: { payload: ModuleRecord[] }) => {
			state.modules = action.payload;
			state.loading = false;
		},
		setModulesLoading: (state, action: { payload: boolean }) => {
			state.loading = action.payload;
		},
		updateModuleInStore: (state, action: { payload: ModuleRecord }) => {
			const idx = state.modules.findIndex((m) => m.id === action.payload.id);
			if (idx !== -1) state.modules[idx] = action.payload;
		},
		removeModuleFromStore: (state, action: { payload: string }) => {
			state.modules = state.modules.filter((m) => m.id !== action.payload);
		},
		clearModules: (state) => {
			state.modules = [];
		},
	},
});

export const {
	setModules,
	setModulesLoading,
	updateModuleInStore,
	removeModuleFromStore,
	clearModules,
} = moduleSlice.actions;

export default moduleSlice.reducer;

