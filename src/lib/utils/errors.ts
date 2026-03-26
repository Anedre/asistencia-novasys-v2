import { NextResponse } from "next/server";

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Recurso no encontrado") {
    super(message, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "No autorizado") {
    super(message, 401, "UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Acceso denegado") {
    super(message, 403, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string = "Conflicto con el estado actual") {
    super(message, 409, "CONFLICT");
    this.name = "ConflictError";
  }
}

/** Standard error response for API routes */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      { ok: false, error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }

  // DynamoDB ConditionalCheckFailedException
  if (
    error instanceof Error &&
    error.name === "ConditionalCheckFailedException"
  ) {
    return NextResponse.json(
      { ok: false, error: "Operación no permitida en el estado actual", code: "CONDITION_FAILED" },
      { status: 409 }
    );
  }

  console.error("Unhandled error:", error);
  return NextResponse.json(
    { ok: false, error: "Error interno del servidor" },
    { status: 500 }
  );
}

/** Wrap an API route handler with error handling */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withErrorHandler<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T
): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (async (...args: any[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      return errorResponse(error);
    }
  }) as T;
}
