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

import { renderFaqAnswer } from "./faqAnswer";
import { renderSendSuccess } from "./sendSuccess";
import { ADAPTIVE, presetById, selectChevron } from "./presets";
import { WIDGET_CHANGE_EVENT, type WidgetChange } from "./liveUpdates";
import { getFormSheet } from "./formSkin";
import {
  VERIFY_COPY,
  adoptedSheets,
  commitStartAttempt,
  createProof,
  describeSendStep,
  loadProof,
  openSenderStore,
  saveProof,
  sendFieldGaps,
  verificationChrome,
  type ProofRecord,
  type StartResult,
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

/**
 * Shadow host. `all: initial` stops a host page's font from painting the
 * form, then the brand face is set again. `--font-geist-sans` is the face
 * the Next.js layout already loads; embeds that do not define it get
 * system-ui. Custom properties cross the shadow boundary, so an invalid
 * `var()` without a fallback would drop the whole font stack back to the
 * browser's serif default.
 *
 * Tailwind's border-box reset does not enter the shadow tree. Chrome then
 * sizes select and button as border-box and text fields as content-box, so
 * a width of 100% plus padding makes the text fields wider than the select.
 */
const HOST_CSS = `
  :host {
    all: initial;
    display: block;
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    color-scheme: light dark;
    background: var(--sm-bg, ${ADAPTIVE.bg});
    font-family: var(--sm-font, var(--font-geist-sans, system-ui, sans-serif));
    font-size: 16px;
    line-height: 1.5;
    color: var(--sm-text, ${ADAPTIVE.text});
    -webkit-font-smoothing: antialiased;
  }
  :host([hidden]) { display: none; }
  :host *, :host *::before, :host *::after { box-sizing: border-box; }
  button, input, select, textarea { font-family: inherit; letter-spacing: inherit; }
  h1, h2, h3, h4, p { margin: 0; font: inherit; }
`;

/** Type, controls, and field geometry for the hosted form and the embed. */
const POLISH_CSS = `
  .sm-form { width: 100%; min-width: 0; }
  .sm-heading {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    letter-spacing: -0.025em;
    line-height: 1.3;
    color: var(--sm-text, ${ADAPTIVE.text});
  }
  .sm-faqs { display: flex; flex-direction: column; gap: 0.75rem; min-width: 0; }
  .sm-faq { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }
  .sm-faq-question {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.5;
    color: var(--sm-text, ${ADAPTIVE.text});
    overflow-wrap: anywhere;
  }
  .sm-faq-answer {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.5;
    color: var(--sm-muted, ${ADAPTIVE.muted});
    overflow-wrap: anywhere;
  }
  .sm-faq-answer p { margin: 0; }
  .sm-faq-answer a {
    color: var(--sm-text, ${ADAPTIVE.text});
    text-decoration: underline;
    text-underline-offset: 0.15em;
  }
  .sm-grid-2, .sm-label, .sm-fieldset {
    width: 100%;
    max-width: 100%;
    min-width: 0;
  }
  .sm-grid-2 { display: flex; flex-direction: column; gap: 1rem; }
  legend.sm-label-text { padding: 0; }
  .sm-input, .sm-textarea, select.sm-input {
    display: block;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    margin: 0;
    line-height: 1.4;
  }
  input.sm-input, select.sm-input { min-height: 2.5rem; }
  .sm-textarea { min-height: 6.5rem; resize: none; }
  .sm-input::placeholder, .sm-textarea::placeholder {
    color: var(--sm-muted, ${ADAPTIVE.muted});
    opacity: 1;
  }
  select.sm-input {
    appearance: none;
    -webkit-appearance: none;
    padding-right: 2.25rem;
    cursor: pointer;
    background-image: var(--sm-select-icon, ${selectChevron("#525252")});
    background-repeat: no-repeat;
    background-position: right 0.75rem center;
    background-size: 0.9rem;
  }
  @media (prefers-color-scheme: dark) {
    select.sm-input {
      background-image: var(--sm-select-icon, ${selectChevron("#a3a3a3")});
    }
  }
  .sm-radio-label { font-weight: 400; cursor: pointer; }
  .sm-radio-label input {
    appearance: none;
    -webkit-appearance: none;
    width: 1rem;
    height: 1rem;
    margin: 0;
    border: 1px solid var(--sm-border, ${ADAPTIVE.border});
    border-radius: 50%;
    background: var(--sm-surface, ${ADAPTIVE.surface});
    display: grid;
    place-content: center;
    flex: none;
  }
  .sm-radio-label input:checked { border-color: var(--sm-text, ${ADAPTIVE.text}); }
  .sm-radio-label input:checked::before {
    content: "";
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: var(--sm-text, ${ADAPTIVE.text});
  }
  .sm-radio-label input:focus-visible {
    outline: 2px solid var(--sm-accent, ${ADAPTIVE.accent});
    outline-offset: 2px;
  }
  .sm-button {
    display: block;
    width: 100%;
    max-width: 100%;
    min-height: 2.75rem;
    margin: 0;
    line-height: 1.25;
    border-radius: var(--sm-radius, 0);
  }
  .sm-hint { margin: 0; line-height: 1.5; }
  .sm-counter { font-variant-numeric: tabular-nums; }
  .success {
    color: var(--sm-text, ${ADAPTIVE.text});
    font-size: 1rem;
    line-height: 1.5;
  }
  .sm-custom { margin-top: 0.5rem; }
`;

const VERIFY_CSS = `
  .sm-text-button {
    align-self: flex-start;
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    color: var(--sm-text, ${ADAPTIVE.text});
    font: inherit;
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: underline;
    text-underline-offset: 0.15em;
    cursor: pointer;
  }
  .sm-text-button:focus-visible {
    outline: 2px solid var(--sm-accent, ${ADAPTIVE.accent});
    outline-offset: 2px;
  }
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
  /** A reconnect must not fetch config again and wipe a letter in progress. */
  private booted = false;
  /** A late config response must not replace the form or the sent panel. */
  private loadToken = 0;
  private hostSheet = new CSSStyleSheet();
  private polishSheet = new CSSStyleSheet();
  private verifySheet = new CSSStyleSheet();

  static get observedAttributes(): string[] {
    return ["vanity"];
  }

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: "open" });
    this.hostSheet.replaceSync(HOST_CSS);
    this.polishSheet.replaceSync(POLISH_CSS);
    this.verifySheet.replaceSync(VERIFY_CSS);
    this.applySheets(null);
  }

  /** Keep host, form, polish, and verification sheets under any owner CSS. */
  private applySheets(owner: CSSStyleSheet | null): void {
    this.shadow.adoptedStyleSheets = adoptedSheets(
      [this.hostSheet, getFormSheet(), this.polishSheet, this.verifySheet],
      owner,
    );
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
    if (this.booted) return;
    this.booted = true;
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
        const heading = this.shadow.querySelector(".sm-heading");
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
        this.appendFaq(change.question, change.answer);
        break;
      }
      case "faq-edited": {
        const previous = change.previousQuestion ?? change.question;
        if (this.config) {
          const faq = this.config.faqs.find((f) => f.question === previous);
          if (faq) {
            faq.question = change.question;
            faq.answer = change.answer;
          }
        }
        const el = this.faqByQuestion(previous);
        if (el) {
          el.dataset.question = change.question;
          const question = el.querySelector(".sm-faq-question");
          if (question) question.textContent = change.question;
          const answer = el.querySelector(".sm-faq-answer");
          if (answer) answer.replaceChildren(renderFaqAnswer(change.answer));
        }
        break;
      }
      case "faq-removed": {
        if (this.config) {
          this.config.faqs = this.config.faqs.filter(
            (f) => f.question !== change.question,
          );
        }
        this.faqByQuestion(change.question)?.remove();
        const faqs = this.shadow.querySelector(".sm-faqs");
        if (faqs && faqs.childElementCount === 0) faqs.remove();
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
    if (!next || next === this.vanity) return;
    this.vanity = next;
    // The parser upgrade is already connected, so this runs before
    // connectedCallback. That path loads once. A later vanity change reloads.
    if (this.isConnected && this.booted) void this.load();
  }

  /** Programmatic mount API. */
  mount(container: HTMLElement, cfg: { vanity: string }): void {
    this.setAttribute("vanity", cfg.vanity);
    container.appendChild(this);
  }

  private async load(): Promise<void> {
    const token = ++this.loadToken;
    if (!this.vanity) {
      this.renderMessage("shortmail-widget: no vanity configured", true);
      return;
    }
    this.renderMessage("Loading…");
    try {
      const res = await fetch(`${convexSiteUrl()}/api/embed/${encodeURIComponent(this.vanity)}/config`);
      if (token !== this.loadToken) return;
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
      if (token !== this.loadToken) return;
      this.renderMessage("Could not load the form — network error.");
    }
  }

  private applyTheme(): void {
    if (!this.config) return;
    const preset = presetById(this.config.theme?.preset ?? null);
    for (let i = this.style.length - 1; i >= 0; i -= 1) {
      const prop = this.style.item(i);
      if (prop.startsWith("--sm-")) this.style.removeProperty(prop);
    }
    for (const [key, value] of Object.entries(preset.vars)) {
      this.style.setProperty(key, value);
    }
    this.style.setProperty("color-scheme", preset.colorScheme);
    const muted = preset.vars["--sm-muted"];
    if (muted?.startsWith("#")) {
      this.style.setProperty("--sm-select-icon", selectChevron(muted));
    } else {
      this.style.removeProperty("--sm-select-icon");
    }
    let owner: CSSStyleSheet | null = null;
    if (this.config.theme?.customCss) {
      // The stored CSS was sanitized at save time (convex/lib/cssSanitize);
      // it renders inside this shadow root only.
      try {
        owner = new CSSStyleSheet();
        owner.replaceSync(this.config.theme.customCss);
      } catch {
        owner = null;
      }
    }
    this.applySheets(owner);
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
    form.noValidate = true;
    form.setAttribute("part", "form");
    form.className = "sm-form";

    const heading = document.createElement("h3");
    heading.className = "sm-heading";
    heading.setAttribute("part", "heading");
    heading.textContent = `Send a shortmail to ${cfg.displayName}`;
    form.appendChild(heading);

    for (const faq of cfg.faqs) {
      this.appendFaq(faq.question, faq.answer, form);
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

    const replyField = document.createElement("fieldset");
    replyField.className = "sm-fieldset";
    const replyLegend = document.createElement("legend");
    replyLegend.className = "sm-label-text";
    replyLegend.textContent = "Do you need a reply?";
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
    replyField.append(replyLegend, row);
    form.appendChild(replyField);

    const subjectLabel = document.createElement("label");
    subjectLabel.className = "sm-label";
    const subjectCaption = document.createElement("span");
    subjectCaption.className = "sm-label-text";
    subjectCaption.textContent = "Subject";
    subjectLabel.appendChild(subjectCaption);
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
    customWrap.className = "sm-custom";
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
    messageLabel.className = "sm-label";
    const messageCaption = document.createElement("span");
    messageCaption.className = "sm-label-text";
    messageCaption.textContent = "Message";
    messageLabel.appendChild(messageCaption);
    const message = document.createElement("textarea");
    message.className = "sm-textarea";
    message.setAttribute("part", "input");
    message.required = true;
    message.maxLength = MAX_MESSAGE_LENGTH + 1;
    const counter = document.createElement("div");
    counter.className = "sm-counter";
    counter.textContent = `0/${MAX_MESSAGE_LENGTH}`;
    message.addEventListener("input", () => {
      const length = message.value.length;
      counter.textContent = `${length}/${MAX_MESSAGE_LENGTH}`;
      counter.classList.toggle("sm-counter-over", length > MAX_MESSAGE_LENGTH);
    });
    messageLabel.appendChild(message);
    messageLabel.appendChild(counter);
    form.appendChild(messageLabel);

    // Honeypot: invisible to humans, catnip for bots that set every value.
    // Chrome address autofill writes the visitor's email into an off-screen
    // input named "website" (autocomplete="off" does not stop it). Send then
    // returned before fetch, so a confirmed letter never left the browser.
    // A name Chrome does not classify, plus readonly, keeps that from happening.
    // Bots that assign `.value` still trip the field. Readonly does not block that.
    const honeypot = document.createElement("input");
    honeypot.type = "text";
    honeypot.name = "shortmail_leave_blank";
    honeypot.tabIndex = -1;
    honeypot.autocomplete = "off";
    honeypot.readOnly = true;
    honeypot.setAttribute("aria-hidden", "true");
    honeypot.className = "sm-honeypot";
    form.appendChild(honeypot);

    const verifyStatus = document.createElement("p");
    verifyStatus.className = "sm-hint";
    verifyStatus.style.display = "none";
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
    codeBlock.append(codeLabel, codeInput);
    const codeButton = document.createElement("button");
    codeButton.type = "button";
    codeButton.className = "sm-text-button";
    codeButton.textContent = "Email me a confirmation code";
    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.className = "sm-button";
    confirmButton.textContent = "Confirm email";
    confirmButton.style.display = "none";
    form.appendChild(verifyStatus);
    form.appendChild(codeBlock);
    form.appendChild(codeButton);
    form.appendChild(confirmButton);

    const errorLine = document.createElement("p");
    errorLine.className = "sm-error";
    errorLine.setAttribute("role", "alert");
    errorLine.style.display = "none";
    form.appendChild(errorLine);

    const sendButton = document.createElement("button");
    sendButton.type = "submit";
    sendButton.className = "sm-button";
    sendButton.setAttribute("part", "button");
    sendButton.textContent = "Send shortmail";
    form.appendChild(sendButton);

    const showError = (text: string): void => {
      errorLine.textContent = text;
      errorLine.style.display = "block";
    };

    const storage = openSenderStore(safeLocalStorage());
    if (!storage.persistent) {
      verifyStatus.textContent = VERIFY_COPY.storage;
    }
    const showStatus = (text: string): void => {
      verifyStatus.textContent = text;
      verifyStatus.style.display = text ? "block" : "none";
    };

    const refreshReady = (): void => {
      const step = describeSendStep({
        email: emailField.input.value,
        code: codeInput.value,
        stored: loadProof(storage.store),
        now: Date.now(),
      });
      const chrome = verificationChrome(step);
      codeBlock.style.display = chrome.showCode ? "block" : "none";
      confirmButton.style.display = chrome.showConfirm ? "block" : "none";
      sendButton.style.display = chrome.showSend ? "block" : "none";
      codeButton.style.display = chrome.showRequestCode ? "block" : "none";
      codeButton.textContent = chrome.showCode
        ? "Send another code"
        : "Email me a confirmation code";
      if (chrome.status) showStatus(chrome.status);
      else if (verifyStatus.textContent === VERIFY_COPY.ready) {
        showStatus(storage.persistent ? "" : VERIFY_COPY.storage);
      }
    };
    emailField.input.addEventListener("input", refreshReady);
    const storedAtOpen = loadProof(storage.store);
    if (storedAtOpen && emailField.input.value.trim() === "") {
      emailField.input.value = storedAtOpen.email;
    }
    refreshReady();

    let startInFlight: Promise<void> | null = null;
    const startVerification = (): Promise<void> => {
      if (startInFlight) return startInFlight;
      startInFlight = issueVerification().finally(() => {
        startInFlight = null;
      });
      return startInFlight;
    };
    const issueVerification = async (): Promise<void> => {
      const previous = loadProof(storage.store);
      const created = await createProof(emailField.input.value);
      let result: StartResult = null;
      try {
        const res = await fetch(`${convexSiteUrl()}/api/verify/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: created.record.email,
            challengeId: created.record.challengeId,
            challengeSecretHash: created.challengeSecretHash,
            sessionSecretHash: created.sessionSecretHash,
          }),
        });
        if (res.ok) result = (await res.json()) as StartResult;
      } catch {
        result = null;
      }
      const committed = commitStartAttempt(
        storage.store,
        previous,
        created.record,
        result,
      );
      if (!committed.committed || !committed.stored) {
        showStatus(result === null ? "Network error — please try again." : VERIFY_COPY.unavailable);
        refreshReady();
        return;
      }
      const kept = committed.stored;
      refreshReady();
      showStatus(VERIFY_COPY.check);
      window.clearInterval(this.verifyPoll);
      this.verifyPoll = window.setInterval(() => {
        void pollOnce(kept);
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

    codeInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      confirmButton.click();
    });
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
      const gap = sendFieldGaps({
        name: nameField.input.value,
        email: emailField.input.value,
        emailValid: emailField.input.validity.valid,
        subject: select.value,
        customSubject: customInput.value,
        message: message.value,
      });
      if (gap) {
        showError(gap);
        return;
      }
      if (honeypot.value !== "") {
        showError(
          "A hidden field was filled, so the letter was not sent. Reload the page and try again.",
        );
        return;
      }
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
          this.loadToken += 1;
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

  private faqNodes(): HTMLElement[] {
    return [...this.shadow.querySelectorAll(".sm-faq")] as HTMLElement[];
  }

  private faqByQuestion(question: string): HTMLElement | undefined {
    return this.faqNodes().find((node) => node.dataset.question === question);
  }

  private ensureFaqList(form?: Element | null): HTMLElement | null {
    const root = form ?? this.shadow.querySelector(".sm-form");
    if (!root) return null;
    const existing = root.querySelector(".sm-faqs");
    if (existing) return existing as HTMLElement;
    const faqs = document.createElement("div");
    faqs.className = "sm-faqs";
    const heading = root.querySelector(".sm-heading");
    if (heading?.nextSibling) root.insertBefore(faqs, heading.nextSibling);
    else root.appendChild(faqs);
    return faqs;
  }

  private appendFaq(question: string, answer: string, form?: Element | null): void {
    const faqs = this.ensureFaqList(form);
    if (!faqs) return;
    const item = document.createElement("div");
    item.className = "sm-faq";
    item.setAttribute("part", "faq");
    item.dataset.question = question;
    const questionEl = document.createElement("p");
    questionEl.className = "sm-faq-question";
    questionEl.textContent = question;
    const answerEl = document.createElement("div");
    answerEl.className = "sm-faq-answer";
    answerEl.append(renderFaqAnswer(answer));
    item.append(questionEl, answerEl);
    faqs.appendChild(item);
  }

  private textField(labelText: string, part: string): {
    label: HTMLLabelElement;
    input: HTMLInputElement;
  } {
    const label = document.createElement("label");
    label.className = "sm-label";
    const span = document.createElement("span");
    span.className = "sm-label-text";
    span.textContent = labelText;
    const input = document.createElement("input");
    input.className = "sm-input";
    input.setAttribute("part", `input ${part}`);
    label.appendChild(span);
    label.appendChild(input);
    return { label, input };
  }

  private successNote(): HTMLElement {
    return renderSendSuccess(this.config?.displayName);
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
