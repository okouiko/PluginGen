import Editor from '@monaco-editor/react';

interface EditorPanelProps {
  value: string;
  language?: string;
  path?: string;
}

function getLanguageFromPath(filePath?: string): string {
  if (!filePath) return 'plaintext';
  if (filePath.endsWith('.java')) return 'java';
  if (filePath.endsWith('.yml') || filePath.endsWith('.yaml')) return 'yaml';
  if (filePath.endsWith('.xml')) return 'xml';
  if (filePath.endsWith('.json')) return 'json';
  if (filePath.endsWith('.properties')) return 'properties';
  return 'plaintext';
}

export function EditorPanel({ value, language, path }: EditorPanelProps) {
  const lang = language || getLanguageFromPath(path);

  return (
    <div className="h-full w-full">
      <Editor
        height="100%"
        language={lang}
        value={value || ''}
        theme="vs"
        options={{
          readOnly: true,
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'ui-monospace', monospace",
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          wordWrap: 'off',
          tabSize: 2,
        }}
      />
    </div>
  );
}
