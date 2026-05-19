import { errorResponse } from "./utils/api-response.js";

export function validate(schema) {
    return function validationMiddleware(req, res, next) {
        const result = schema.safeParse({
            body: req.body,
            params: req.params,
            query: req.query,
        });

        if (!result.success) {
            return res
                .status(422)
                .json(
                    errorResponse(
                        "VALIDATION_ERROR",
                        result.error.issues
                            .map((issue) => issue.message)
                            .join(", "),
                    ),
                );
        }

        req.validated = result.data;

        next();
    };
}
