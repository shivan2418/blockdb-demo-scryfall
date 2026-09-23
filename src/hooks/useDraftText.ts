import { useEffect, useState } from "react";

const DEBOUNCE_MS = 250;

/**
 * Local text for an input whose committed value lives in the URL. The URL codec trims, so
 * binding the input to it directly would eat a trailing space mid-typing ("human " before
 * "soldier"). Typing stays local and is pushed upward on a debounce, so each keystroke also
 * isn't its own query. External changes (back button, cleared filters) flow back in.
 */
export function useDraftText(
  value: string,
  onCommit: (value: string) => void,
): [string, (next: string) => void] {
  const [text, setText] = useState(value);

  // Our own commit comes back trimmed; that's not an outside change, so keep the typed spaces.
  useEffect(
    () => setText((current) => (current.trim() === value.trim() ? current : value)),
    [value],
  );

  useEffect(() => {
    if (text.trim() === value.trim()) return;
    const timer = setTimeout(() => onCommit(text), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  return [text, setText];
}
