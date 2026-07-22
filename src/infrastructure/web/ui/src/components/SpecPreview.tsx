import { useState } from "react";

interface SpecPreviewProps {
  requirements?: object;
  design?: object;
  tasks?: object;
}

type TabId = "requirements" | "design" | "tasks";

/**
 * SpecPreview — Tabbed Markdown preview for generated spec documents.
 */
export function SpecPreview({ requirements, design, tasks }: SpecPreviewProps) {
  const [activeTab, setActiveTab] = useState<TabId>("requirements");

  const tabs: { id: TabId; label: string; content: object | undefined }[] = [
    { id: "requirements", label: "Requirements", content: requirements },
    { id: "design", label: "Design", content: design },
    { id: "tasks", label: "Tasks", content: tasks },
  ];

  return (
    <div className="spec-preview" aria-label="Generated specification preview">
      <div className="tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            className={`tab ${activeTab === tab.id ? "tab-active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.content && <span className="tab-badge" aria-hidden="true" />}
          </button>
        ))}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={tab.id}
          hidden={activeTab !== tab.id}
          className="tab-panel"
        >
          {tab.content ? (
            <pre className="spec-content">
              <code>{JSON.stringify(tab.content, null, 2)}</code>
            </pre>
          ) : (
            <p className="empty-state">No {tab.label.toLowerCase()} generated yet.</p>
          )}
        </div>
      ))}
    </div>
  );
}
