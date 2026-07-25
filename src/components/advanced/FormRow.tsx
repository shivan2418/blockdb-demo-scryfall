import type { ReactNode } from "react";

/**
 * One row of the advanced form: a fixed label gutter on the left, controls on the right,
 * an italic hint under them. Every section uses this, which is what keeps the column
 * alignment identical down the whole page.
 *
 * `unavailable` marks a row the build cannot answer — the controls still render, disabled,
 * with the reason in their place.
 */
export function FormRow({
  label,
  icon,
  hint,
  unavailable,
  children,
}: {
  label: string;
  icon: string;
  hint?: string;
  unavailable?: string;
  children: ReactNode;
}) {
  return (
    <section className={`adv-row ${unavailable ? "adv-row-off" : ""}`}>
      <div className="adv-label">
        <span className="adv-icon" aria-hidden="true">
          {icon}
        </span>
        <span>{label}</span>
      </div>
      <div className="adv-control">
        <fieldset disabled={Boolean(unavailable)}>{children}</fieldset>
        {unavailable ? (
          <p className="adv-unavailable">
            <strong>Not available in this build.</strong> {unavailable}
          </p>
        ) : (
          hint && <p className="adv-hint">{hint}</p>
        )}
      </div>
    </section>
  );
}

/** Puts several controls on one line, the way Scryfall's Stats and Preferences rows read. */
export function ControlLine({ children }: { children: ReactNode }) {
  return <div className="adv-line">{children}</div>;
}
