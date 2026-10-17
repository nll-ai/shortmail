/**
 * ShortMail embeddable widget — a vanilla-TS custom element with an open
 * shadow root (plan §3.5). Loaded by a single <script src="/widget.js">;
 * mounted via `<shortmail-widget vanity="demo">` or
 * `ShortmailWidget.mount(el, { vanity })`.
 *
 * Also IS the hosted-page contact form: the /send/{vanity} page mounts the
 * same element, so theming and behavior have exactly one implementation.
 *
 * Trust model (disclosed in /embed-docs): the host page can read what
 * visitors type into an embedded widget — embed only on sites you trust.
 * Owners may restrict embedding via embedAllowedOrigins.
 */

import { presetById } from "./presets";
import { WIDGET_CHANGE_EVENT, type WidgetChange } from "./liveUpdates";
const CONVEX_SITE = process.env.WIDGET_CONVEX_SITE_URL ?? "";
const convexSiteUrl = () => CONVEX_SITE;

type EmbedConfig = {
  vanityName: string;
  displayName: string;
  headings: string[];
  faqs: { question: string; answer: string }[];
  isPaid: boolean;
  theme: { preset: string; customCss: string | null } | null;
  embedAllowedOrigins: string[];
};

const MAX_MESSAGE_LENGTH = 500;

const BASE_STYLES = `
  :host {
    /* preset tokens land as inline vars on the host; these are fallbacks */
    --sm-accent: #111111;
    --sm-accent-text: #ffffff;
    --sm-bg: #ffffff;
    --sm-surface: #f9fafb;
    --sm-text: #111111;
    --sm-muted: #6b7280;
    --sm-border: #d1d5db;
    --sm-radius: 0.5rem;
    --sm-font: system-ui, sans-serif;

    all: initial;
    display: block;
    font-family: var(--sm-font);
    color: var(--sm-text);
  }
  :host([hidden]) { display: none; }
  * { box-sizing: border-box; font-family: inherit; }
  .form { display: flex; flex-direction: column; gap: 0.9rem;
          background: var(--sm-bg); padding: 1rem;
          border-radius: var(--sm-radius); }
  .heading { font-weight: 600; margin: 0 0 0.25rem; }
  .faq { margin: 0; font-size: 0.85rem; color: var(--sm-muted); }
  label { display: block; font-size: 0.85rem; }
  .label-text { display: block; margin-bottom: 0.25rem; font-weight: 500; }
  input, select, textarea {
    width: 100%; padding: 0.5rem 0.65rem; font-size: 0.9rem;
    border: 1px solid var(--sm-border); border-radius: var(--sm-radius);
    background: var(--sm-surface); color: var(--sm-text);
  }
  textarea { resize: vertical; min-height: 5rem; }
  .counter { text-align: right; font-size: 0.7rem; color: var(--sm-muted); }
  .row { display: flex; gap: 1rem; }
  .error { color: #b91c1c; font-size: 0.85rem; }
  .success { border: 1px solid #86efac; background: #f0fdf4; color: #166534;
             padding: 1rem; border-radius: var(--sm-radius); text-align: center; }
  .note { font-size: 0.75rem; color: var(--sm-muted); }
  button.send {
    background: var(--sm-accent); color: var(--sm-accent-text);
    border: none; border-radius: 999px; padding: 0.6rem 1.4rem;
    font-size: 0.9rem; font-weight: 600; cursor: pointer;
  }
  button.send:disabled { opacity: 0.4; cursor: not-allowed; }
`;

function upgradeProperty<T extends HTMLElement>(el: T, prop: string): void {
  if (Object.prototype.hasOwnProperty.call(el, prop)) {
    const value = el[prop as keyof T];
    delete (el as unknown as Record<string, unknown>)[prop];
    Object.defineProperty(el, prop, { value, configurable: true, enumerable: true });
  }
}

function stripQuery(value: string, max: number): string | undefined {
  const noQuery = value.split("?")[0].slice(0, max);
  return noQuery.length > 0 ? noQuery : undefined;
}

function dnt(): boolean {
  return (
    navigator.doNotTrack === "1" ||
    (window as { doNotTrack?: string }).doNotTrack === "1"
  );
}

class ShortmailWidget extends HTMLElement {
  private shadow!: ShadowRoot;
  private vanity = "";
  private config: EmbedConfig | null = null;
  private changeHandler = (e: Event): void =>
    this.applyWidgetChange((e as CustomEvent<WidgetChange>).detail);

  static get observedAttributes(): string[] {
    return ["vanity"];
  }

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: "open" });
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(BASE_STYLES);
    this.shadow.adoptedStyleSheets = [sheet];
  }

  connectedCallback(): void {
    upgradeProperty(this, "vanity");
    if (!this.vanity) {
      this.vanity = this.getAttribute("vanity") ?? "";
    }
    // Live updates: editors dispatch granular WidgetChange events; the widget
    // patches exactly the affected DOM nodes (no re-render flash).
    this.changeHandler = (e: Event) =>
      this.applyWidgetChange((e as CustomEvent<WidgetChange>).detail);
    window.addEventListener(WIDGET_CHANGE_EVENT, this.changeHandler);
    void this.load();
  }

  disconnectedCallback(): void {
    window.removeEventListener(WIDGET_CHANGE_EVENT, this.changeHandler);
  }

  /** Granular live-update: patch only the nodes a change touches. */
  private applyWidgetChange(change: WidgetChange): void {
    switch (change.kind) {
      case "display-name": {
        if (this.config) this.config.displayName = change.value;
        const heading = this.shadow.querySelector(".heading");
        if (heading) {
          heading.textContent = `Send a shortmail to ${change.value}`;
        }
        break;
      }
      case "heading-added": {
        if (this.config && !this.config.headings.includes(change.heading)) {
          this.config.headings.push(change.heading);
        }
        const select = this.shadow.querySelector("select");
        if (select) {
          const opt = document.createElement("option");
          opt.value = change.heading;
          opt.textContent = change.heading;
          select.appendChild(opt);
        }
        break;
      }
      case "heading-removed": {
        if (this.config) {
          this.config.headings = this.config.headings.filter(
            (h) => h !== change.heading,
          );
        }
        const select = this.shadow.querySelector("select");
        const opt = [...(select?.options ?? [])].find(
          (o) => o.value === change.heading,
        );
        const wasSelected = opt?.selected ?? false;
        opt?.remove();
        if (wasSelected && select) {
          select.value = "";
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
        break;
      }
      case "faq-added": {
        if (this.config) {
          this.config.faqs.push({
            question: change.question,
            answer: change.answer,
          });
        }
        const form = this.shadow.querySelector(".form");
        const headingEl = this.shadow.querySelector(".heading");
        const faq = document.createElement("p");
        faq.className = "faq";
        faq.setAttribute("part", "faq");
        faq.textContent = change.question;
        if (form && headingEl) form.insertBefore(faq, headingEl.nextSibling);
        break;
      }
      case "faq-edited": {
        if (this.config) {
          const faq = this.config.faqs.find(
            (f) => f.question === change.question,
          );
          if (faq) faq.answer = change.answer;
        }
        const faqEls = [...this.shadow.querySelectorAll(".faq")];
        const el = faqEls.find((f) => f.textContent === change.question);
        if (el) el.textContent = change.question;
        break;
      }
      case "faq-removed": {
        if (this.config) {
          this.config.faqs = this.config.faqs.filter(
            (f) => f.question !== change.question,
          );
        }
        const faqEls = [...this.shadow.querySelectorAll(".faq")];
        const el = faqEls.find((f) => f.textContent === change.question);
        el?.remove();
        break;
      }
      case "theme": {
        if (this.config) {
          this.config.theme = {
            preset: change.preset,
            customCss: change.customCss,
          };
        }
        this.applyTheme();
        break;
      }
      case "vanity": {
        this.setAttribute("vanity", change.vanity); // triggers full reload
        break;
      }
    }
  }

  attributeChangedCallback(): void {
    const next = this.getAttribute("vanity") ?? "";
    if (next && next !== this.vanity) {
      this.vanity = next;
      if (this.isConnected) void this.load();
    }
  }

  /** Programmatic mount API. */
  mount(container: HTMLElement, cfg: { vanity: string }): void {
    this.setAttribute("vanity", cfg.vanity);
    container.appendChild(this);
  }

  private async load(): Promise<void> {
    if (!this.vanity) {
      this.renderMessage("shortmail-widget: no vanity configured", true);
      return;
    }
    this.renderMessage("Loading…");
    try {
      const res = await fetch(`${convexSiteUrl()}/api/embed/${encodeURIComponent(this.vanity)}/config`);
      if (res.status === 403) {
        this.renderMessage("This form is not allowed to be embedded on this site.");
        return;
      }
      if (!res.ok) {
        this.renderMessage("This shortmail page could not be found.");
        return;
      }
      this.config = (await res.json()) as EmbedConfig;
      this.applyTheme();
      this.renderForm();
      this.beaconView();
    } catch {
      this.renderMessage("Could not load the form — network error.");
    }
  }

  private applyTheme(): void {
    if (!this.config) return;
    const preset = presetById(this.config.theme?.preset ?? null);
    for (const [key, value] of Object.entries(preset.vars)) {
      this.style.setProperty(key, value);
    }
    if (this.config.theme?.customCss) {
      // The stored CSS was sanitized at save time (convex/lib/cssSanitize);
      // it renders inside this shadow root only.
      try {
        const ownerSheet = new CSSStyleSheet();
        ownerSheet.replaceSync(this.config.theme.customCss);
        this.shadow.adoptedStyleSheets = [
          ...(this.shadow.adoptedStyleSheets ?? []).slice(0, 1),
          ownerSheet,
        ];
      } catch {
        // a malformed sheet must never break the form
      }
    }
  }

  private beaconView(): void {
    if (dnt() || !this.config) return;
    try {
      const payload = JSON.stringify({
        event: "form_view",
        path: `/send/${this.config.vanityName}`,
        ref: document.referrer || undefined,
      });
      const url = `${convexSiteUrl()}/api/collect/${encodeURIComponent(this.config.vanityName)}`;
      const delivered =
        typeof navigator.sendBeacon === "function" &&
        navigator.sendBeacon(url, payload);
      if (!delivered) {
        void fetch(url, {
          method: "POST",
          keepalive: true,
          headers: { "Content-Type": "text/plain" },
          body: payload,
        }).catch(() => undefined);
      }
    } catch {
      // analytics must never break the form
    }
  }

  private renderMessage(text: string, isError = false): void {
    this.shadow.innerHTML = "";
    const note = document.createElement("p");
    note.textContent = text;
    if (isError) note.className = "error";
    this.shadow.appendChild(note);
  }

  private renderForm(): void {
    if (!this.config) return;
    const cfg = this.config;
    this.shadow.innerHTML = "";

    const form = document.createElement("form");
    form.setAttribute("part", "form");
    form.className = "form";

    const heading = document.createElement("h3");
    heading.className = "heading";
    heading.setAttribute("part", "heading");
    heading.textContent = `Send a shortmail to ${cfg.displayName}`;
    form.appendChild(heading);

    for (const faq of cfg.faqs) {
      const p = document.createElement("p");
      p.className = "faq";
      p.setAttribute("part", "faq");
      p.textContent = faq.question;
      form.appendChild(p);
    }

    const nameField = this.textField("Your name", "name");
    const emailField = this.textField("Your email", "email");
    emailField.input.type = "email";
    emailField.input.required = true;
    nameField.input.required = true;
    form.appendChild(nameField.label);
    form.appendChild(emailField.label);

    const replyLabel = document.createElement("label");
    replyLabel.className = "label-text";
    replyLabel.textContent = "Do you need a reply?";
    const row = document.createElement("div");
    row.className = "row";
    let replyNeededValue = "no";
    for (const [value, text] of [
      ["no", "No"],
      ["yes", "Yes"],
    ] as const) {
      const l = document.createElement("label");
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "reply_needed";
      radio.value = value;
      radio.checked = value === "no";
      radio.addEventListener("change", () => {
        if (radio.checked) replyNeededValue = value;
      });
      l.appendChild(radio);
      l.append(text);
      row.appendChild(l);
    }
    replyLabel.appendChild(row);
    form.appendChild(replyLabel);

    const subjectLabel = document.createElement("label");
    subjectLabel.className = "label-text";
    subjectLabel.textContent = "Subject";
    const select = document.createElement("select");
    select.setAttribute("part", "input");
    select.required = true;
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Pick a subject…";
    select.appendChild(placeholder);
    for (const heading of cfg.headings) {
      const opt = document.createElement("option");
      opt.value = heading;
      opt.textContent = heading;
      select.appendChild(opt);
    }
    const other = document.createElement("option");
    other.value = "OTHER";
    other.textContent = "Other…";
    select.appendChild(other);
    subjectLabel.appendChild(select);

    const customWrap = document.createElement("div");
    customWrap.style.display = "none";
    const customInput = document.createElement("input");
    customInput.placeholder = "Your own subject";
    customWrap.appendChild(customInput);
    select.addEventListener("change", () => {
      customWrap.style.display = select.value === "OTHER" ? "block" : "none";
    });
    subjectLabel.appendChild(customWrap);
    form.appendChild(subjectLabel);

    const messageLabel = document.createElement("label");
    messageLabel.className = "label-text";
    messageLabel.textContent = "Message";
    const message = document.createElement("textarea");
    message.setAttribute("part", "input");
    message.required = true;
    message.maxLength = MAX_MESSAGE_LENGTH + 1;
    const counter = document.createElement("div");
    counter.className = "counter";
    counter.textContent = `0/${MAX_MESSAGE_LENGTH}`;
    message.addEventListener("input", () => {
      counter.textContent = `${message.value.length}/${MAX_MESSAGE_LENGTH}`;
      syncCanSubmit();
    });
    messageLabel.appendChild(message);
    messageLabel.appendChild(counter);
    form.appendChild(messageLabel);

    // Honeypot: invisible to humans, catnip for bots.
    const honeypot = document.createElement("input");
    honeypot.type = "text";
    honeypot.name = "website";
    honeypot.tabIndex = -1;
    honeypot.autocomplete = "off";
    honeypot.style.cssText = "position:absolute;left:-9999px;height:0;width:0;opacity:0;";
    form.appendChild(honeypot);

    const errorLine = document.createElement("p");
    errorLine.className = "error";
    errorLine.style.display = "none";
    form.appendChild(errorLine);

    const sendButton = document.createElement("button");
    sendButton.type = "submit";
    sendButton.className = "send";
    sendButton.setAttribute("part", "button");
    sendButton.textContent = "Send shortmail";
    sendButton.disabled = true;
    form.appendChild(sendButton);

    const canSubmit = (): boolean =>
      nameField.input.value.trim().length > 0 &&
      emailField.input.validity.valid &&
      message.value.trim().length > 0 &&
      (select.value === "OTHER"
        ? customInput.value.trim().length > 0
        : select.value !== "");

    function syncCanSubmit(): void {
      sendButton.disabled = !canSubmit();
    }
    for (const el of [nameField.input, emailField.input, customInput]) {
      el.addEventListener("input", syncCanSubmit);
    }
    select.addEventListener("change", syncCanSubmit);
    syncCanSubmit();

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (sendButton.disabled) return;
      if (honeypot.value !== "") return;
      errorLine.style.display = "none";

      const body = new URLSearchParams({
        sender_name: nameField.input.value,
        sender_email: emailField.input.value,
        reply_needed: replyNeededValue,
        subject: select.value,
        custom_subject: customInput.value,
        message: message.value,
        website: honeypot.value,
      });

      sendButton.disabled = true;
      try {
        const res = await fetch(`${convexSiteUrl()}/api/send/${encodeURIComponent(cfg.vanityName)}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
        });
        if (res.ok) {
          form.replaceWith(this.successNote());
          return;
        }
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        errorLine.textContent =
          data.error === "daily_cap_exceeded"
            ? "This person is receiving too many messages today — please try again tomorrow."
            : data.error === "disposable_email"
              ? "Please use a non-disposable email address."
              : "Something went wrong — please try again.";
        errorLine.style.display = "block";
        sendButton.disabled = false;
      } catch {
        errorLine.textContent = "Network error — please try again.";
        errorLine.style.display = "block";
        sendButton.disabled = false;
      }
    });

    this.shadow.appendChild(form);
  }

  private textField(labelText: string, part: string): {
    label: HTMLLabelElement;
    input: HTMLInputElement;
  } {
    const label = document.createElement("label");
    label.className = "label-text";
    const span = document.createElement("span");
    span.textContent = labelText;
    const input = document.createElement("input");
    input.setAttribute("part", `input ${part}`);
    label.appendChild(span);
    label.appendChild(input);
    return { label, input };
  }

  private successNote(): HTMLElement {
    const div = document.createElement("div");
    div.className = "success";
    const name = this.config?.displayName ?? "them";
    div.textContent = `Message sent to ${name}! It lands in their inbox as a plain, short email.`;
    return div;
  }
}

if (!customElements.get("shortmail-widget")) {
  customElements.define("shortmail-widget", ShortmailWidget);
}

/** Programmatic API: ShortmailWidget.mount(el, { vanity: "demo" }). */
const globalApi = window as unknown as {
  ShortmailWidget?: { mount: (el: HTMLElement, cfg: { vanity: string }) => void };
};
globalApi.ShortmailWidget = {
  mount: (el: HTMLElement, cfg: { vanity: string }) => {
    const widget = document.createElement("shortmail-widget");
    widget.setAttribute("vanity", cfg.vanity);
    upgradeProperty(widget, "vanity");
    el.appendChild(widget);
    return widget;
  },
};

export {};
