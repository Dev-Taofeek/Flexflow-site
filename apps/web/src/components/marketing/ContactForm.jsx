"use client";

import { useState } from "react";
import { Translated, useTranslatedText } from "@/lib/translate";

export function ContactForm() {
  const [sent, setSent] = useState(false);
  const [optGeneral, optSales, optSupport, optPartnerships, optCareers] = [
    useTranslatedText("General question"),
    useTranslatedText("Sales / enterprise"),
    useTranslatedText("Support"),
    useTranslatedText("Partnerships"),
    useTranslatedText("Careers"),
  ];

  function handleSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = form.get("name");
    const email = form.get("email");
    const subject = form.get("subject");
    const message = form.get("message");

    const mailto = `mailto:hello@flexflow.app?subject=${encodeURIComponent(
      `[${subject || "Contact"}] from ${name || "a visitor"}`,
    )}&body=${encodeURIComponent(`${message}\n\n— ${name} (${email})`)}`;

    window.location.href = mailto;
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-success-500/40 bg-success-500/10 p-6 text-sm leading-relaxed text-(--text-secondary)">
        <p className="font-semibold text-success-500">
          <Translated>Thanks your email app should be opening.</Translated>
        </p>
        <p className="mt-1">
          <Translated>If it didn&apos;t, email us directly at </Translated>
          <a href="mailto:hello@flexflow.app" className="font-medium text-brand-500 hover:text-brand-400">
            hello@flexflow.app
          </a>
          <Translated>. We usually reply within one business day.</Translated>
        </p>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-lg border border-(--border) bg-(--bg-elevated) px-3.5 py-2.5 text-sm text-(--text-primary) placeholder-(--text-tertiary) outline-none transition-colors focus:border-brand-500";
  const labelClass = "mb-1.5 block text-sm font-medium text-(--text-primary)";

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="contact-name" className={labelClass}>
          <Translated>Name</Translated>
        </label>
        <input id="contact-name" name="name" required className={inputClass} placeholder="Ada Lovelace" />
      </div>
      <div>
        <label htmlFor="contact-email" className={labelClass}>
          <Translated>Email</Translated>
        </label>
        <input id="contact-email" name="email" type="email" required className={inputClass} placeholder="ada@team.com" />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="contact-subject" className={labelClass}>
          <Translated>Subject</Translated>
        </label>
        <select id="contact-subject" name="subject" className={inputClass} defaultValue="General question">
          <option value="General question">{optGeneral}</option>
          <option value="Sales / enterprise">{optSales}</option>
          <option value="Support">{optSupport}</option>
          <option value="Partnerships">{optPartnerships}</option>
          <option value="Careers">{optCareers}</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="contact-message" className={labelClass}>
          <Translated>Message</Translated>
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={5}
          className={`${inputClass} resize-y`}
          placeholder="Tell us what you need…"
        />
      </div>
      <div className="sm:col-span-2">
        <button
          type="submit"
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-500"
        >
          <Translated>Send message</Translated>
        </button>
        <p className="mt-3 text-xs leading-relaxed text-(--text-tertiary)">
          <Translated>Submitting opens your email app with the message pre-filled. Prefer live support? Check the </Translated>
          <a href="/help" className="font-medium text-brand-500 hover:text-brand-400">
            <Translated>help center</Translated>
          </a>
          <Translated> first.</Translated>
        </p>
      </div>
    </form>
  );
}