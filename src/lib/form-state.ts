/** Shared shape for every useActionState form in the app. */
export type FormState = { error?: string; success?: string } | undefined;

export const ok = (success: string): FormState => ({ success });
export const fail = (error: string): FormState => ({ error });
