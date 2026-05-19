export function successResponse(data, meta) {
  return {
    success: true,
    data,
    ...(meta ? { meta } : {}),
  };
}

export function errorResponse(code, message) {
  return {
    success: false,
    error: {
      code,
      message,
    },
  };
}
