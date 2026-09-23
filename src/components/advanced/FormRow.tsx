import type { ReactNode } from "react";

/**
 * One row of the advanced form: a fixed label gutter on the left, controls on the right,
 * an italic hint under them. Every section uses this, which is what keeps the column
 * alignment identical down the whole page.
 */
export function FormRow({
  label,
  icon,
  hint,
  children,
}: {
  label: string;
  icon: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="adv-row">
      <div className="adv-label">
        <span className="adv-icon" aria-hidden="true">
          {icon}
        </span>
        <span>{label}</span>
      </div>
      <div className="adv-control">
        <fieldset>{children}</fieldset>
        {hint && <p className="adv-hint">{hint}</p>}
      </div>
    </section>
  );
}

/** Puts several controls on one line, the way Scryfall's Stats and Preferences rows read. */
export function ControlLine({ children }: { children: ReactNode }) {
  return <div className="adv-line">{children}</div>;
}
