import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type Dispatch,
  type ReactNode,
} from "react";
import type { SafarState } from "../domain/types";
import { reducer, type SafarAction } from "./reducer";
import { clearState, loadState, saveState } from "./storage";

interface SafarContextValue {
  state: SafarState;
  dispatch: Dispatch<SafarAction>;
  storageNotice?: string;
  dismissStorageNotice: () => void;
  resetDemoData: () => void;
}

const SafarContext = createContext<SafarContextValue | null>(null);

function init(): { state: SafarState; notice?: string } {
  const loaded = loadState();
  return { state: loaded.state, notice: loaded.notice };
}

export function SafarProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(init);
  const [state, dispatch] = useReducer(reducer, initial.state);
  const [storageNotice, setStorageNotice] = useState<string | undefined>(initial.notice);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const dismissStorageNotice = useCallback(() => setStorageNotice(undefined), []);
  const resetDemoData = useCallback(() => {
    clearState();
    dispatch({ type: "RESET_SCENARIO" });
  }, []);

  const value = useMemo<SafarContextValue>(
    () => ({ state, dispatch, storageNotice, dismissStorageNotice, resetDemoData }),
    [state, storageNotice, dismissStorageNotice, resetDemoData],
  );

  return <SafarContext.Provider value={value}>{children}</SafarContext.Provider>;
}

export function useSafarState(): SafarContextValue {
  const context = useContext(SafarContext);
  if (!context) {
    throw new Error("useSafarState must be used inside <SafarProvider>.");
  }
  return context;
}
