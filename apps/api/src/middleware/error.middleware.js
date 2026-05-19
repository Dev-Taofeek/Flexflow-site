import { env } from "../config/env.js";
import { errorResponse } from "../utils/api-response.js";
import { AppError } from "../utils/app-error.js";

export function notFoundHandler(req, res) {
    return res
        .status(404)
        .json(
            errorResponse(
                "ROUTE_NOT_FOUND",
                `Route ${req.method} ${req.originalUrl} was not found`,
            ),
        );
}

export function errorHandler(error, req, res, next) {
    const isTrustedError = error instanceof AppError;

    const statusCode = isTrustedError ? error.statusCode : 500;
    const code = isTrustedError ? error.code : "INTERNAL_SERVER_ERROR";

    const message =
        isTrustedError || env.NODE_ENV !== "production"
            ? error.message
            : "Something went wrong";

    req.log?.error(
        {
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack,
            },
            requestId: req.id,
            userId: req.user?.id,
        },
        "Request failed",
    );

    return res.status(statusCode).json(errorResponse(code, message));
}
