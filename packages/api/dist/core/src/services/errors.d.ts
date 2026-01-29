export declare class AppError extends Error {
    code: string;
    statusCode: number;
    details?: Record<string, unknown> | undefined;
    retryable: boolean;
    constructor(code: string, message: string, statusCode: number, details?: Record<string, unknown> | undefined, retryable?: boolean);
}
export declare class NotFoundError extends AppError {
    constructor(message?: string, details?: Record<string, unknown>);
}
export declare class ValidationError extends AppError {
    constructor(message: string, details?: Record<string, unknown>);
}
export declare class StageGuardError extends AppError {
    constructor(message: string, details?: Record<string, unknown>);
}
export declare class InvalidTransitionError extends AppError {
    constructor(message: string, details?: Record<string, unknown>);
}
export declare class ForbiddenError extends AppError {
    constructor(message: string, details?: Record<string, unknown>);
}
export declare class OverrideRequiredError extends AppError {
    constructor(message: string, details?: Record<string, unknown>);
}
export declare class ConflictError extends AppError {
    constructor(message: string, details?: Record<string, unknown>);
}
//# sourceMappingURL=errors.d.ts.map