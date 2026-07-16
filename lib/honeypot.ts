/**
 * A hidden form field real visitors never see or fill in — scripted
 * submitters that blindly fill every field trip it. Any non-empty value
 * means "reject this," but silently: the caller should still return a
 * normal-looking success response so bots can't distinguish rejection from
 * acceptance and iterate against the signal.
 */
export function isHoneypotFilled(value: unknown): boolean {
  return typeof value === "string" && value.length > 0;
}
