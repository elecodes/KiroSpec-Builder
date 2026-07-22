interface PipelineStageError {
  stage: string;
  code: string;
  message: string;
}

interface ErrorAlertProps {
  errors: PipelineStageError[];
  onDismiss: () => void;
  onRetry?: () => void;
}

/**
 * ErrorAlert — Dismissible alert component for pipeline errors.
 *
 * Displays error category, stage, message, and optional retry button.
 */
export function ErrorAlert({ errors, onDismiss, onRetry }: ErrorAlertProps) {
  if (errors.length === 0) return null;

  const getErrorCategory = (code: string): string => {
    if (code.startsWith("LLM_") || code === "EARS_PARSING_FAILED") return "LLM Error";
    if (code.startsWith("VALIDATION") || code === "MISSING_CONTENT") return "Validation Error";
    if (code.startsWith("EXPORT_") || code.startsWith("FILESYSTEM")) return "File System Error";
    return "Pipeline Error";
  };

  const isRetryable = errors.some(
    (e) => e.code.startsWith("LLM_") || e.code.includes("TIMEOUT"),
  );

  return (
    <div className="error-alert" role="alert" aria-live="assertive">
      <div className="error-header">
        <span className="error-icon" aria-hidden="true">!</span>
        <strong>
          {errors.length === 1
            ? "Spec generation encountered an error"
            : `Spec generation encountered ${errors.length} errors`}
        </strong>
        <button
          className="btn-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss error"
        >
          x
        </button>
      </div>

      <ul className="error-list">
        {errors.map((error, index) => (
          <li key={index} className="error-item">
            <span className="error-category">{getErrorCategory(error.code)}</span>
            <span className="error-stage">[{error.stage}]</span>
            <span className="error-message">{error.message}</span>
          </li>
        ))}
      </ul>

      {isRetryable && onRetry && (
        <button className="btn-retry" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
