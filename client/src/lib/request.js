const RETRYABLE_STATUS_CODES = new Set([0, 408, 429]);

export const isRetryableStatus = (status) => {
  if (!Number.isFinite(status)) return true;
  return status >= 500 || RETRYABLE_STATUS_CODES.has(status);
};

export const createRequestError = (message, status) => {
  const error = new Error(message);
  error.status = Number.isFinite(status) ? status : 0;
  error.retryable = isRetryableStatus(error.status);
  return error;
};

export const normalizeRequestError = (error, fallbackMessage) => {
  if (error?.name === 'AbortError') {
    return error;
  }
  if (error && typeof error === 'object' && 'retryable' in error) {
    return error;
  }
  const message = error?.message || fallbackMessage || 'Request failed';
  return createRequestError(message, error?.status);
};
