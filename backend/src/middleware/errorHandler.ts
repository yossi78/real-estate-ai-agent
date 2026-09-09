export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string = "APP_ERROR",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, message, "NOT_FOUND");
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message, "VALIDATION_ERROR");
  }
}
