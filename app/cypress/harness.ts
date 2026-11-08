import { dispatchWidgetChange } from "../src/widget/liveUpdates";

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
