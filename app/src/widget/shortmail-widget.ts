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
import { getFormSheet } from "./formSkin";
import {
  VERIFY_COPY,
  createProof,
  describeSendStep,
  loadProof,
  openSenderStore,
  saveProof,
  type ProofRecord,
} from "./senderSession";
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
    --sm-accent: #111111;
    --sm-accent-text: #ffffff;
    --sm-bg: #ffffff;
    --sm-surface: #ffffff;
    --sm-text: #111111;
    --sm-muted: #737373;
    --sm-border: #d4d4d4;
    --sm-radius: 0px;
    --sm-font: Arial, Helvetica, sans-serif;

    all: initial;
    display: block;
    font-family: var(--sm-font);
    color: var(--sm-text);
  }
  :host([hidden]) { display: none; }
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

function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
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
  private verifyPoll = 0;

  static get observedAttributes(): string[] {
    return ["vanity"];
  }

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: "open" });
    const verifySheet = new CSSStyleSheet();
    verifySheet.replaceSync(`
      .sm-text-button {
        align-self: flex-start;
        margin: 0;
        padding: 0;
        border: 0;
        background: none;
        color: var(--sm-text, #171717);
        font: inherit;
        font-size: 0.875rem;
        font-weight: 500;
        text-decoration: underline;
        text-underline-offset: 0.15em;
        cursor: pointer;
      }
      .sm-text-button:focus-visible {
        outline: 2px solid var(--sm-accent, #171717);
        outline-offset: 2px;
      }
    `);
    this.shadow.adoptedStyleSheets = [getFormSheet(), verifySheet];
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
    window.clearInterval(this.verifyPoll);
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
        faq.className = "sm-hint";
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
    if (isError) note.className = "sm-error";
    this.shadow.appendChild(note);
  }

  private renderForm(): void {
    if (!this.config) return;
    const cfg = this.config;
    this.shadow.innerHTML = "";

    const form = document.createElement("form");
    form.setAttribute("part", "form");
    form.className = "sm-form";

    const heading = document.createElement("h3");
    heading.className = "sm-heading";
    heading.setAttribute("part", "heading");
    heading.setAttribute("part", "heading");
    heading.textContent = `Send a shortmail to ${cfg.displayName}`;
    form.appendChild(heading);

    for (const faq of cfg.faqs) {
      const p = document.createElement("p");
      p.className = "sm-faq";
      p.setAttribute("part", "faq");
      p.textContent = faq.question;
      form.appendChild(p);
    }

    const nameField = this.textField("Your name", "name");
    const emailField = this.textField("Your email", "email");
    emailField.input.type = "email";
    emailField.input.required = true;
    nameField.input.required = true;
    const nameEmailRow = document.createElement("div");
    nameEmailRow.className = "sm-grid-2";
    nameEmailRow.appendChild(nameField.label);
    nameEmailRow.appendChild(emailField.label);
    form.appendChild(nameEmailRow);

    const replyLabel = document.createElement("label");
    replyLabel.className = "sm-label-text";
    replyLabel.textContent = "Do you need a reply?";
    const row = document.createElement("div");
    row.className = "sm-radio-row";
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
      l.className = "sm-radio-label";
    l.appendChild(radio);
      l.append(text);
      row.appendChild(l);
    }
    replyLabel.appendChild(row);
    form.appendChild(replyLabel);

    const subjectLabel = document.createElement("label");
    subjectLabel.className = "sm-label-text";
    subjectLabel.textContent = "Subject";
    const select = document.createElement("select");
    select.className = "sm-input";
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
    customInput.className = "sm-input";
    customInput.placeholder = "Your own subject";
    customWrap.appendChild(customInput);
    select.addEventListener("change", () => {
      customWrap.style.display = select.value === "OTHER" ? "block" : "none";
    });
    subjectLabel.appendChild(customWrap);
    form.appendChild(subjectLabel);

    const messageLabel = document.createElement("label");
    messageLabel.className = "sm-label-text";
    messageLabel.textContent = "Message";
    const message = document.createElement("textarea");
    message.className = "sm-textarea";
    message.setAttribute("part", "input");
    message.required = true;
    message.maxLength = MAX_MESSAGE_LENGTH + 1;
    const counter = document.createElement("div");
    counter.className = "sm-counter";
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
    honeypot.className = "sm-honeypot";
    form.appendChild(honeypot);

    const verifyStatus = document.createElement("p");
    verifyStatus.className = "sm-hint";
    const codeBlock = document.createElement("label");
    codeBlock.className = "sm-label";
    codeBlock.style.display = "none";
    const codeLabel = document.createElement("span");
    codeLabel.className = "sm-label-text";
    codeLabel.textContent = "Confirmation code";
    const codeInput = document.createElement("input");
    codeInput.className = "sm-input";
    codeInput.autocomplete = "one-time-code";
    codeInput.placeholder = "Paste the code from your email";
    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.className = "sm-text-button";
    confirmButton.textContent = "Confirm email";
    confirmButton.style.marginTop = "0.5rem";
    codeBlock.append(codeLabel, codeInput, confirmButton);
    const codeButton = document.createElement("button");
    codeButton.type = "button";
    codeButton.className = "sm-text-button";
    codeButton.textContent = "Email me a confirmation code";
    form.appendChild(verifyStatus);
    form.appendChild(codeBlock);
    form.appendChild(codeButton);

    const errorLine = document.createElement("p");
    errorLine.className = "sm-error";
    errorLine.style.display = "none";
    form.appendChild(errorLine);

    const sendButton = document.createElement("button");
    sendButton.type = "submit";
    sendButton.className = "sm-button";
    sendButton.setAttribute("part", "button");
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

    const storage = openSenderStore(safeLocalStorage());
    if (!storage.persistent) {
      verifyStatus.textContent = VERIFY_COPY.storage;
    }
    const showStatus = (text: string): void => {
      verifyStatus.textContent = text;
    };

    const refreshReady = (): void => {
      const step = describeSendStep({
        email: emailField.input.value,
        code: "",
        stored: loadProof(storage.store),
        now: Date.now(),
      });
      const ready = step.kind === "send";
      if (ready) {
        codeBlock.style.display = "none";
        codeButton.style.display = "none";
        showStatus(VERIFY_COPY.ready);
      } else {
        codeButton.style.display = "block";
      }
    };
    emailField.input.addEventListener("input", refreshReady);
    refreshReady();

    const startVerification = async (): Promise<void> => {
      const created = await createProof(emailField.input.value);
      saveProof(storage.store, created.record);
      codeBlock.style.display = "block";
      codeButton.style.display = "block";
      codeButton.textContent = "Send another code";
      showStatus(VERIFY_COPY.check);
      try {
        await fetch(`${convexSiteUrl()}/api/verify/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: created.record.email,
            challengeId: created.record.challengeId,
            challengeSecretHash: created.challengeSecretHash,
            sessionSecretHash: created.sessionSecretHash,
          }),
        });
      } catch {
        showStatus("Network error — please try again.");
        return;
      }
      window.clearInterval(this.verifyPoll);
      this.verifyPoll = window.setInterval(() => {
        void pollOnce(created.record);
      }, 5000);
    };

    const pollOnce = async (record: ProofRecord): Promise<void> => {
      const res = await fetch(`${convexSiteUrl()}/api/verify/poll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: record.challengeId,
          challengeSecret: record.challengeSecret,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { status?: string };
      if (data.status === "expired") {
        window.clearInterval(this.verifyPoll);
        showStatus(VERIFY_COPY.expired);
      }
    };

    codeButton.addEventListener("click", () => {
      void startVerification();
    });
    confirmButton.addEventListener("click", () => {
      void confirmCode();
    });

    const confirmCode = async (): Promise<void> => {
      const stored = loadProof(storage.store);
      const step = describeSendStep({
        email: emailField.input.value,
        code: codeInput.value,
        stored,
        now: Date.now(),
      });
      if (step.kind !== "confirm") {
        showStatus(step.kind === "blocked" ? step.message : VERIFY_COPY.unconfirmed);
        return;
      }
      const res = await fetch(`${convexSiteUrl()}/api/verify/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: step.token,
          challengeId: step.challengeId,
          challengeSecret: step.challengeSecret,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        status?: string;
        sessionExpiresAt?: number | null;
      };
      if (data.status === "confirmed" && stored) {
        window.clearInterval(this.verifyPoll);
        saveProof(storage.store, {
          ...stored,
          status: "confirmed",
          sessionExpiresAt: data.sessionExpiresAt ?? null,
        });
        codeInput.value = "";
        refreshReady();
        return;
      }
      showStatus(
        data.status === "expired"
          ? VERIFY_COPY.expired
          : data.status === "mismatch"
            ? VERIFY_COPY.mismatch
            : VERIFY_COPY.invalid,
      );
    };

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (sendButton.disabled) return;
      if (honeypot.value !== "") return;
      errorLine.style.display = "none";
      const step = describeSendStep({
        email: emailField.input.value,
        code: codeInput.value,
        stored: loadProof(storage.store),
        now: Date.now(),
      });
      if (step.kind !== "send") {
        if (step.kind === "start") await startVerification();
        else showStatus(step.kind === "blocked" ? step.message : VERIFY_COPY.check);
        return;
      }

      const body = new URLSearchParams({
        sender_name: nameField.input.value,
        sender_email: emailField.input.value,
        reply_needed: replyNeededValue,
        subject: select.value,
        custom_subject: customInput.value,
        message: message.value,
        website: honeypot.value,
        session_secret: step.sessionSecret,
      });

      sendButton.disabled = true;
      try {
        const res = await fetch(`${convexSiteUrl()}/api/send/${encodeURIComponent(cfg.vanityName)}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
        });
        if (res.ok) {
          window.clearInterval(this.verifyPoll);
          form.replaceWith(this.successNote());
          return;
        }
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        errorLine.textContent =
          data.error === "daily_cap_exceeded"
            ? "This person is receiving too many messages today — please try again tomorrow."
            : data.error === "disposable_email"
              ? "Please use a non-disposable email address."
              : data.error === "email_unverified"
                ? VERIFY_COPY.unconfirmed
                : data.error === "sender_rate_limited"
                  ? "You have sent several letters from this address today. Try again tomorrow."
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
    label.className = "sm-label-text";
    const span = document.createElement("span");
    span.textContent = labelText;
    const input = document.createElement("input");
    input.className = "sm-input";
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
