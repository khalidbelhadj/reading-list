import { UnauthorizedError } from "@/lib/auth";

export class ActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionError";
  }
}

export const safeAction = <Args extends unknown[], R>(
  fn: (...args: Args) => Promise<R>,
  errorMessage: string = "Something went wrong. Please try again.",
): ((...args: Args) => Promise<R>) => {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof ActionError || error instanceof UnauthorizedError) {
        throw error;
      }
      console.error("[action]", fn.name || "anonymous", error);
      throw new ActionError(errorMessage);
    }
  };
};
