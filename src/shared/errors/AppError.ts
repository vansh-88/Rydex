export interface AppErrorOptions {
  // Underlying failure this AppError wraps. Never sent to the client — it
  // exists so a provider/driver error reaches the logs instead of being
  // discarded by a bare `catch {}` (claude.md §61).
  cause?: unknown;
}

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string, options?: AppErrorOptions) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
