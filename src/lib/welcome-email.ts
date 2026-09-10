export const WELCOME_EMAIL_MAX_LENGTH = 10_000;

export function composeWelcomeEmailText(draft: string, appUrl: string): string {
  return `${draft.trim()}\n\nOpen VicGym: ${appUrl}`;
}
