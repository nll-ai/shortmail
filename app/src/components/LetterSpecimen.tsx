/**
 * Static fictional letter for the marketing homepage.
 *
 * The card is not a form. It does not fetch an owner and it does not send.
 */

export const LETTER_BODY =
  "Dr. Adeyemi, I assigned your 2023 heat-mortality paper in my methods seminar. Two students want the ward-level counts behind Figure 3. Can you share them, or tell me who can, before Friday?";

const HEADINGS: readonly { label: string; selected: boolean }[] = [
  { label: "Question about a paper", selected: false },
  { label: "Prospective student", selected: false },
  { label: "Data request", selected: true },
  { label: "Speaking invitation", selected: false },
];

/**
 * Render the approved Adeyemi / Ruiz example.
 *
 * :returns: A figure with no controls and no network calls.
 */
export function LetterSpecimen() {
  return (
    <figure className="mt-14">
      <figcaption className="mb-3 text-[15px] leading-snug text-[#525252]">
        Example
      </figcaption>
      <div className="border border-[#d4d4d4] p-6 max-sm:p-[1.15rem]">
        <p className="text-lg font-semibold tracking-tight">
          Dr. Nkechi Adeyemi
        </p>
        <p className="mb-4 text-sm text-[#525252]">
          Professor of environmental health
        </p>
        <dl>
          <div className="mb-4">
            <dt className="text-[13px] font-medium text-[#525252]">Subject</dt>
            <dd className="mt-1 flex flex-col gap-1.5">
              {HEADINGS.map((heading) => (
                <span
                  key={heading.label}
                  data-selected={heading.selected ? "true" : undefined}
                  className={
                    heading.selected
                      ? "-ml-0.5 border-l-2 border-[#171717] pl-[0.7rem] font-medium text-[#171717]"
                      : "pl-[0.7rem] text-[#525252]"
                  }
                >
                  {heading.label}
                </span>
              ))}
            </dd>
          </div>
          <div>
            <dt className="text-[13px] font-medium text-[#525252]">From</dt>
            <dd>Elena Ruiz, elena.ruiz@example.com</dd>
          </div>
        </dl>
        <div className="mt-4 border-t border-[#e5e5e5] pt-4">
          <p className="text-[17px] leading-relaxed">{LETTER_BODY}</p>
          <div className="mt-5 flex items-baseline justify-between gap-4 text-[13px] text-[#525252]">
            <span>
              {LETTER_BODY.length}/500
            </span>
            <span>Reply requested: Yes</span>
          </div>
        </div>
      </div>
    </figure>
  );
}
