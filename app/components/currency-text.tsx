import { currencyLabelParts } from "../lib/currency-label";

/** Isolate only monetary tokens; surrounding copy retains the page direction. */
export function CurrencyText({ text }: { text: string }) {
  return <>{currencyLabelParts(text).map((part, index) => part.amount !== undefined
    ? <bdi key={index} className="currency-amount" dir="ltr" style={{ direction: "ltr", unicodeBidi: "isolate", whiteSpace: "nowrap" }}><span data-currency-symbol="">₪</span>{"\u00a0"}<span data-currency-number="">{part.amount}</span></bdi>
    : part.text)}</>;
}
