export class AppError extends Error {
    code;
    statusCode;
    details;
    retryable;
    constructor(code, message, statusCode, details, retryable = false) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        this.retryable = retryable;
        this.name = "AppError";
    }
}
export class NotFoundError extends AppError {
    constructor(message = "Resource not found", details) {
        super("NOT_FOUND", message, 404, details);
    }
}
export class ValidationError extends AppError {
    constructor(message, details) {
        super("VALIDATION_ERROR", message, 400, details);
    }
}
export class StageGuardError extends AppError {
    constructor(message, details) {
        super("STAGE_GUARD_FAILED", message, 409, details);
    }
}
export class InvalidTransitionError extends AppError {
    constructor(message, details) {
        super("INVALID_TRANSITION", message, 409, details);
    }
}
export class ForbiddenError extends AppError {
    constructor(message, details) {
        super("FORBIDDEN", message, 403, details);
    }
}
export class OverrideRequiredError extends AppError {
    constructor(message, details) {
        super("OVERRIDE_REQUIRED", message, 400, details);
    }
}
export class ConflictError extends AppError {
    constructor(message, details) {
        super("CONFLICT", message, 409, details);
    }
}
//# sourceMappingURL=errors.js.map