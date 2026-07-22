import { useState, type FormEvent } from "react";

interface InputFormProps {
  onSubmit: (content: string, format: string) => void;
  isLoading: boolean;
}

/**
 * InputForm — Text area and submit button for raw feature input.
 */
export function InputForm({ onSubmit, isLoading }: InputFormProps) {
  const [content, setContent] = useState("");
  const [format, setFormat] = useState("text");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (content.trim() && !isLoading) {
      onSubmit(content.trim(), format);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="input-form" aria-label="Spec generation form">
      <div className="form-group">
        <label htmlFor="spec-input" className="form-label">
          Feature Description
        </label>
        <textarea
          id="spec-input"
          className="form-textarea"
          placeholder="Paste your feature idea, product requirement, or voice note transcription..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={12}
          disabled={isLoading}
          aria-describedby="input-hint"
        />
        <p id="input-hint" className="form-hint">
          Describe your feature in natural language. The AI will convert it into structured specs.
        </p>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="format-select" className="form-label">
            Input Format
          </label>
          <select
            id="format-select"
            className="form-select"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            disabled={isLoading}
          >
            <option value="text">Plain Text</option>
            <option value="markdown">Markdown</option>
            <option value="json">JSON</option>
            <option value="voice-transcription">Voice Transcription</option>
          </select>
        </div>

        <button
          type="submit"
          className="btn-primary"
          disabled={isLoading || !content.trim()}
          aria-busy={isLoading}
        >
          {isLoading ? (
            <span className="btn-loading">
              <span className="spinner" aria-hidden="true" />
              Generating...
            </span>
          ) : (
            "Generate Spec"
          )}
        </button>
      </div>
    </form>
  );
}
