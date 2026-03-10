import { createSlice } from '@reduxjs/toolkit';

/** User from GET /api/users/me */
export type User = {
	_id: string;
	name: string;
	username: string;
	phoneNumber: string;
	role: string;
};

/** Menu item from GET /api/users/me */
export type MenuItem = {
	module: string;
	label: string;
	path: string;
};

/** Payload from GET /api/users/me */
export type MeResponse = {
	user: User;
	menu: MenuItem[];
};

type UserState = {
	user: User | null;
	menu: MenuItem[];
};

const initialState: UserState = {
	user: null,
	menu: [],
};

const userSlice = createSlice({
	name: 'user',
	initialState,
	reducers: {
		setMe: (state, action: { payload: MeResponse }) => {
			state.user = action.payload.user;
			state.menu = action.payload.menu ?? [];
		},
		clearMe: (state) => {
			state.user = null;
			state.menu = [];
		},
	},
});

export const { setMe, clearMe } = userSlice.actions;
export default userSlice.reducer;
