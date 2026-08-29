export const anonymousWeddingTransferKey = "quickrsvp-anonymous-wedding-transfer";
export const anonymousWeddingTransferResultKey = "quickrsvp-anonymous-wedding-result";
export const anonymousWeddingTransferredEvent = "quickrsvp:wedding-transferred";

export function requestAnonymousWeddingTransfer(): void {
  sessionStorage.setItem(anonymousWeddingTransferKey, "1");
  sessionStorage.removeItem(anonymousWeddingTransferResultKey);
}
