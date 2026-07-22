import { useState, useCallback } from "react";
import { InputForm } from "./components/InputForm.js";
import { SpecPreview } from "./components/SpecPreview.js";
import { ErrorAlert } from "./components/ErrorAlert.js";

interface PipelineStageError {
  stage: string;
  code: string;
  message: string;
}

interface GenerateResult {
  success: boolean;
  requirements?: object;
  design?: object;
  tasks?: object;
  errors?: PipelineStageError[];
  totalDurationMs?: number;
}

/**
 * App — Root component for KiroSpec Builder Web UI.
 */
export function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [errors, setErrors] = useState<PipelineStageError[]>([]);
  const [lastInput, setLastInput] = useState<{ content: string; format: string } | null>(null);

  const handleSubmit = useCallback(async (content: string, format: string) => {
    setIsLoading(true);
    setErrors([]);
    setResult(null);
    setLastInput({ content, format });

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, format }),
      });

      const data: GenerateResult = await response.json();

      if (data.success) {
        setResult(data);
      } else {
        setResult(data);
        setErrors(data.errors ?? []);
      }
    } catch (error) {
      setErrors([
        {
          stage: "network",
          code: "NETWORK_ERROR",
          message:
            error instanceof Error
              ? `Connection failed: ${error.message}`
              : "Unable to reach the server. Check your connection.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRetry = useCallback(() => {
    if (lastInput) {
      handleSubmit(lastInput.content, lastInput.format);
    }
  }, [lastInput, handleSubmit]);

  const handleDismissErrors = useCallback(() => {
    setErrors([]);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>KiroSpec Builder</h1>
        <p className="subtitle">AI-powered specification generation</p>
      </header>

      <main className="app-main">
        <InputForm onSubmit={handleSubmit} isLoading={isLoading} />

        {errors.length > 0 && (
          <ErrorAlert
            errors={errors}
            onDismiss={handleDismissErrors}
            onRetry={handleRetry}
          />
        )}

        {result && (
          <SpecPreview
            requirements={result.requirements}
            design={result.design}
            tasks={result.tasks}
          />
        )}

        {result?.success && result.totalDurationMs && (
          <p className="completion-info">
            Generated in {result.totalDurationMs}ms
          </p>
        )}
      </main>
    </div>
  );
}
