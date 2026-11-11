import { dispatchWidgetChange } from "../src/widget/liveUpdates";

const ANSWER =
  "Yes, please use Calendly: https://calendly.com/ericmjl/45-minute-meeting.";

const previous = document.querySelector<HTMLInputElement>("#previous");
const question = document.querySelector<HTMLInputElement>("#question");
const answer = document.querySelector<HTMLTextAreaElement>("#answer");

document.querySelector("#add-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  dispatchWidgetChange({
    kind: "faq-added",
    question: question?.value ?? "",
    answer: answer?.value ?? "",
  });
});

document.querySelector("#save-edit")?.addEventListener("click", () => {
  dispatchWidgetChange({
    kind: "faq-edited",
    previousQuestion: previous?.value ?? "",
    question: question?.value ?? "",
    answer: answer?.value ?? "",
  });
});

document.querySelector("#remove-faq")?.addEventListener("click", () => {
  dispatchWidgetChange({
    kind: "faq-removed",
    question: previous?.value ?? "",
  });
});

const EXTERNAL_FAQS = [
  { question: "Can I find time with you to chat?", answer: ANSWER },
  {
    question: "Can my employer sponsor the Learn Anything retreat?",
    answer: "Yes. Send me a shortmail and I will send a program overview.",
  },
  {
    question: "How much does the Learn Anything retreat cost?",
    answer: "The inaugural retreat is $4,997 all-in.",
  },
  {
    question: "When and where is the Learn Anything retreat?",
    answer: "San Diego, February 15–19, 2027.",
  },
  {
    question: "Can I split the retreat payment?",
    answer: "Yes. We can split it across two invoices.",
  },
  {
    question: "How do I talk with you about the retreat?",
    answer: "Book a 45-minute call: https://calendly.com/ericmjl/45-minute-meeting.",
  },
];

/**
 * Stand-in for a Convex update that did not come from this page's buttons:
 * MCP, another tab, or another device. It replaces the preview's page
 * instead of appending one local FAQ.
 */
document.querySelector("#external-change")?.addEventListener("click", () => {
  const list = document.querySelector("#faq-list");
  if (list) {
    list.replaceChildren();
    for (const faq of EXTERNAL_FAQS) {
      const item = document.createElement("li");
      item.className = "font-medium";
      item.textContent = faq.question;
      list.appendChild(item);
    }
  }
  const status = document.querySelector("#external-status");
  if (status) {
    status.textContent =
      "External change applied — fixture only. Not a saved account. No email.";
  }
  dispatchWidgetChange({
    kind: "snapshot",
    displayName: "Eric Ma",
    headings: ["Data request", "Learn Anything retreat"],
    faqs: EXTERNAL_FAQS,
    theme: { preset: "midnight", customCss: "button { letter-spacing: 0.2em; }" },
  });
});
