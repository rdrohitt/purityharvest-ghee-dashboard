import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import userReducer from './userSlice';
import productReducer from './productSlice';
import modulesReducer from './moduleSlice';
import usersTableReducer from './usersTableSlice';
import marketingSpendReducer from './marketingSpendSlice';

export const store = configureStore({
	reducer: {
		user: userReducer,
		products: productReducer,
		modules: modulesReducer,
		usersTable: usersTableReducer,
		marketingSpend: marketingSpendReducer,
	},
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

export { setMe, clearMe } from './userSlice';
export type { User, MenuItem, MeResponse } from './userSlice';
export {
	setProducts,
	setProductsLoading,
	addProductToStore,
	updateProductInStore,
	removeProduct,
	clearProducts,
} from './productSlice';

export {
	setModules,
	setModulesLoading,
	updateModuleInStore,
	removeModuleFromStore,
	clearModules,
} from './moduleSlice';

export {
	setUsers,
	setUsersLoading,
	updateUserInStore,
	removeUserFromStore,
	clearUsers,
} from './usersTableSlice';

export {
	setMarketingSpendRecords,
	setMarketingSpendLoading,
	clearMarketingSpendRecords,
} from './marketingSpendSlice';
