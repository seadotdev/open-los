/**
 * Base error class for social network errors
 */
export class SocialError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly retryable: boolean;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    details?: Record<string, unknown>,
    retryable = false
  ) {
    super(message);
    this.name = "SocialError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.retryable = retryable;
  }
}

export class NotFoundError extends SocialError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, "NOT_FOUND", 404, { resource, id });
  }
}

export class ValidationError extends SocialError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "VALIDATION_ERROR", 400, details);
  }
}

export class ConflictError extends SocialError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "CONFLICT", 409, details);
  }
}

export class ForbiddenError extends SocialError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "FORBIDDEN", 403, details);
  }
}
