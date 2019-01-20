import axios from 'axios';
import { all, call, put, PutEffect, takeLatest } from 'redux-saga/effects';
import {
	authTypeKeys,
	handleLogin,
	handleLogOut,
	handleRegister,
	IHandleLoginAction,
	IHandleLogOutAction,
	IHandleRegisterAction,
	populateUserStateFromLocalStorageIfAvailable
} from './actions';
import { api, USER } from './constants';
import { addTokenToDefaultHeader } from './services';
import {
	isInLocalStorage,
	removeFromLocalStorage,
	addToLocalStorage
} from '../Core';
import { IUser } from './types';

function* handleLoginAsync(action: IHandleLoginAction) {
	try {
		const { data } = yield call(
			axios.post,
			api.login,
			action.payload.loginInfo
		);
		addTokenToDefaultHeader(data.token);
		addToLocalStorage(data, USER);

		const actions = action.payload.additionalActions
			? [...action.payload.additionalActions.map(f => put(f()))]
			: [];
		actions.push(put(handleLogin.success(data)));
		yield all(actions);
	} catch (error) {
		yield put(handleLogin.failure(error));
	}
}

function* watchHandleLogin() {
	yield takeLatest(authTypeKeys.LOGIN, handleLoginAsync);
}

function* handleRegisterAsync(action: IHandleRegisterAction) {
	try {
		const { data } = yield call(axios.post, api.register, action.payload);
		yield put(handleRegister.success(data));
	} catch (error) {
		yield put(handleRegister.failure(error));
	}
}

function* watchHandleRegister() {
	yield takeLatest(authTypeKeys.REGISTER, handleRegisterAsync);
}

function* handleLogOutLocalStorage(action: IHandleLogOutAction) {
	try {
		if (isInLocalStorage(USER)) {
			removeFromLocalStorage(USER);
		}
		const actions: Array<PutEffect<any>> = action.payload
			? [...action.payload.map(f => put(f()))]
			: [];
		actions.push(put(handleLogOut.success()));
		yield all(actions);
	} catch (error) {
		yield put(handleLogOut.failure(error));
	}
}

function* watchHandleLogOutLocalStorage() {
	yield takeLatest(authTypeKeys.LOGOUT, handleLogOutLocalStorage);
}

function* handlePopulateUserStateFromLocalStorageIfAvailable() {
	try {
		const storedUser = localStorage.getItem(USER);
		if (storedUser !== null) {
			const user: IUser = JSON.parse(storedUser);
			addTokenToDefaultHeader(user.token);
			yield put(
				populateUserStateFromLocalStorageIfAvailable.success(user)
			);
		}
	} catch (error) {
		yield put(populateUserStateFromLocalStorageIfAvailable.failure(error));
	}
}

function* watchHandlePopulateUserStateFromLocalStorageIfAvailable() {
	yield takeLatest(
		authTypeKeys.POPULATE_USER_STATE_FROM_LOCAL_STORAGE_IF_AVAILABLE,
		handlePopulateUserStateFromLocalStorageIfAvailable
	);
}

export const sagas = [
	watchHandleLogin,
	watchHandleRegister,
	watchHandleLogOutLocalStorage,
	watchHandlePopulateUserStateFromLocalStorageIfAvailable
];
