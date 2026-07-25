import { useEffect, useState } from "react";

const DEBOUNCE_MS = 250;

/**
 * Keeps typing local and pushes upward on a debounce, so each keystroke doesn't
 * become a query. External changes (back button, cleared filters) flow back in.
 */
export function SearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [text, setText] = useState(value);

  useEffect(() => setText(value), [value]);

  useEffect(() => {
    if (text === value) return;
    const timer = setTimeout(() => onChange(text), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="search-bar">
      <input
        type="search"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Search card names…"
        aria-label="Search card names"
        autoComplete="off"
      />
    </div>
  );
}
