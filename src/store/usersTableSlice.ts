import { createSlice } from '@reduxjs/toolkit';
import type { UserRecord } from '../types/users';

type UsersTableState = {
	users: UserRecord[];
	loading: boolean;
};

const initialState: UsersTableState = {
	users: [],
	loading: true,
};

const usersTableSlice = createSlice({
	name: 'usersTable',
	initialState,
	reducers: {
		setUsers: (state, action: { payload: UserRecord[] }) => {
			state.users = action.payload;
			state.loading = false;
		},
		setUsersLoading: (state, action: { payload: boolean }) => {
			state.loading = action.payload;
		},
		updateUserInStore: (state, action: { payload: UserRecord }) => {
			const idx = state.users.findIndex((u) => u.id === action.payload.id);
			if (idx !== -1) state.users[idx] = action.payload;
		},
		removeUserFromStore: (state, action: { payload: string }) => {
			state.users = state.users.filter((u) => u.id !== action.payload);
		},
		clearUsers: (state) => {
			state.users = [];
		},
	},
});

export const {
	setUsers,
	setUsersLoading,
	updateUserInStore,
	removeUserFromStore,
	clearUsers,
} = usersTableSlice.actions;

export default usersTableSlice.reducer;

