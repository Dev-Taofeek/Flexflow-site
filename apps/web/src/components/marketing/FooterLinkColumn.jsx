"use client";

import Link from "next/link";
import { useI18n } from "@/i18n";

export function FooterLinkColumn({ column }) {
  const { t } = useI18n();
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-(--text-secondary)">
        {t(column.headingKey)}
      </h3>
      <ul className="mt-4 space-y-2.5">
        {column.links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-sm text-(--text-tertiary) transition-colors hover:text-(--text-primary)"
            >
              {t(link.labelKey)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
