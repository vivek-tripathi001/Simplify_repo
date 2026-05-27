// src/middleware/errorHandler.js
// NFR-U4: No raw error codes or stack traces exposed to end users

export function errorHandler(err, req, res, _next) {
  console.error('[ErrorHandler]', err.message, err.stack);

  // Map known error types to user-friendly messages
  const userMessages = {
    INVALID_URL:        'Invalid GitHub URL. Please provide a valid public repository URL.',
    PRIVATE_REPO:       'This repository is private or does not exist. Only public repositories are supported.',
    REPO_TOO_LARGE:     'Repository exceeds the 500 MB size limit. Please try a smaller repository.',
    CLONE_TIMEOUT:      'Repository cloning timed out. The repository may be too large or the server may be slow.',
    OPENAI_ERROR:       'AI processing failed. Please try again in a few moments.',
    SESSION_NOT_FOUND:  'Your session has expired. Please start a new analysis.',
    GITHUB_API_ERROR:   'Could not retrieve repository metadata from GitHub. Please check the URL and try again.',
  };

  const status = err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = userMessages[code] || 'An unexpected error occurred. Please try again.';

  res.status(status).json({ error: message, code });
}

export function createError(code, status = 500) {
  const err = new Error(code);
  err.code = code;
  err.status = status;
  return err;
}
