export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number,
    public details?: Record<string, unknown>,
    public retryable = false
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", details?: Record<string, unknown>) {
    super("NOT_FOUND", message, 404, details);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("VALIDATION_ERROR", message, 400, details);
  }
}

export class StageGuardError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("STAGE_GUARD_FAILED", message, 409, details);
  }
}

export class InvalidTransitionError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("INVALID_TRANSITION", message, 409, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("FORBIDDEN", message, 403, details);
  }
}

export class OverrideRequiredError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("OVERRIDE_REQUIRED", message, 400, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("CONFLICT", message, 409, details);
  }
}
