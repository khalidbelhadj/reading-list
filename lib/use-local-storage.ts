import React from "react";

// useState + localStorage, where the write happens in the setter (not an
// effect). This avoids the redundant initial-render write back of the value
// just read and limits writes to actual mutations.
export const useLocalStorage = <T>(
  key: string,
  defaultValue: T,
  parse: (raw: string) => T,
  serialize: (value: T) => string,
): readonly [T, React.Dispatch<React.SetStateAction<T>>] => {
  const parseRef = React.useRef(parse);
  parseRef.current = parse;
  const serializeRef = React.useRef(serialize);
  serializeRef.current = serialize;

  const [value, setValueState] = React.useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    try {
      return parseRef.current(raw);
    } catch {
      return defaultValue;
    }
  });

  const setValue = React.useCallback<React.Dispatch<React.SetStateAction<T>>>(
    (next) => {
      setValueState((prev) => {
        const resolved =
          typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        try {
          if (typeof window !== "undefined") {
            localStorage.setItem(key, serializeRef.current(resolved));
          }
        } catch {}
        return resolved;
      });
    },
    [key],
  );

  return [value, setValue] as const;
};
