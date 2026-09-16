export function ContentPage({ eyebrow, title, description, children, narrow = true }) {
  return (
    <div className="mx-auto w-full px-6 py-16 lg:px-8 lg:py-20">
      <div className={narrow ? "mx-auto max-w-3xl" : "mx-auto max-w-5xl"}>
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-500">{eyebrow}</p>
        ) : null}
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-(--text-primary) md:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-4 text-base leading-relaxed text-(--text-secondary)">{description}</p>
        ) : null}
        <div className="prose-invert mt-10 border-t border-(--border) pt-10">{children}</div>
      </div>
    </div>
  );
}

// Shared typographic classes for content pages. Kept local so static pages stay
// dependency-free rather than pulling in a typography plugin.
export function Prose({ children }) {
  return (
    <div className="space-y-6 text-[15px] leading-relaxed text-(--text-secondary)">
      {children}
    </div>
  );
}

export function ProseH2({ children }) {
  return (
    <h2 className="mt-10! text-lg font-semibold tracking-tight text-(--text-primary)">
      {children}
    </h2>
  );
}

export function ProseH3({ children }) {
  return <h3 className="text-base font-semibold text-(--text-primary)">{children}</h3>;
}

export function ProseUl({ children }) {
  return (
    <ul className="list-disc space-y-2 pl-5 marker:text-(--text-tertiary)">{children}</ul>
  );
}

export function ProseLi({ children }) {
  return <li className="pl-1">{children}</li>;
}

export function ProseCode({ children }) {
  return (
    <code className="rounded border border-(--border) bg-(--bg-elevated) px-1.5 py-0.5 font-mono text-[13px] text-(--text-primary)">
      {children}
    </code>
  );
}