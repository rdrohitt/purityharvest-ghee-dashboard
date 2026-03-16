import { createSlice } from '@reduxjs/toolkit';
import type { MeUser, MeMenuItem, MeResponse as MeResponseType } from '../types/users';

/** User from GET /api/users/me */
export type User = MeUser;

/** Menu item from GET /api/users/me */
export type MenuItem = MeMenuItem;

/** Payload from GET /api/users/me */
export type MeResponse = MeResponseType;

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
