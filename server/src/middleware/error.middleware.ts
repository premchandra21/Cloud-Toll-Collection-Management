import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../shared/errors/AppError.js";

function errorBody(code: string, message: string, requestId: string, details?: unknown) {
  return {
    success: false,
    error: { code, message, ...(details !== undefined ? { details } : {}), requestId },
  };
}

export const notFound: RequestHandler = (req, res) => {
  res
    .status(404)
    .json(
      errorBody("RESOURCE_NOT_FOUND", `Route not found: ${req.method} ${req.originalUrl}`, req.requestId),
    );
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json(errorBody(err.code, err.message, req.requestId, err.details));
    return;
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
    res.status(400).json(errorBody("VALIDATION_ERROR", "Invalid request data", req.requestId, details));
    return;
  }

  // express.json() could not parse the body
  if (err && typeof err === "object" && err.type === "entity.parse.failed") {
    res.status(400).json(errorBody("VALIDATION_ERROR", "Malformed JSON body", req.requestId));
    return;
  }

  console.error(`[${req.requestId}] Unhandled error:`, err);
  res.status(500).json(errorBody("INTERNAL_ERROR", "Something went wrong", req.requestId));
};