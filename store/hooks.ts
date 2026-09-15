"use client";

import {
  useDispatch,
  useSelector,
  useStore,
  type TypedUseSelectorHook,
} from "react-redux";
import type { AppDispatch, AppStore, RootState } from "./index";

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
/** Full store instance; do not pass AppStore as useStore's state generic. */
export const useAppStore = () => useStore() as AppStore;
