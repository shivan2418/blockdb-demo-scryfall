import { useDraftText } from "../hooks/useDraftText";

export function SearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [text, setText] = useDraftText(value, onChange);

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
