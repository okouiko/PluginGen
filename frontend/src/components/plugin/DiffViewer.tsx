import { useState } from 'react';
import { DiffEditor } from '@monaco-editor/react';

interface DiffFile {
  path: string;
  oldContent: string;
  newContent: string;
}

interface DiffViewerProps {
  files: DiffFile[];
  oldVersion: number;
  newVersion: number;
  onClose: () => void;
}

export function DiffViewer({ files, oldVersion, newVersion, onClose }: DiffViewerProps) {
  const [selectedFile, setSelectedFile] = useState(files[0]?.path || '');

  const currentFile = files.find((f) => f.path === selectedFile) || files[0];

  if (!currentFile) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <p className="font-sans text-body-md text-muted">没有文件差异</p>
        <button
          onClick={onClose}
          className="mt-md rounded-md bg-primary px-5 py-3 font-sans text-button text-on-primary transition-colors hover:bg-primary-active"
        >
          关闭
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-hairline bg-canvas px-md py-sm">
        <div className="flex items-center gap-sm">
          <span className="font-sans text-body-sm text-ink">
            v{oldVersion} → v{newVersion}
          </span>
          <select
            value={selectedFile}
            onChange={(e) => setSelectedFile(e.target.value)}
            className="rounded-md border border-hairline bg-canvas px-sm py-xxs font-sans text-body-sm text-ink"
          >
            {files.map((f) => (
              <option key={f.path} value={f.path}>
                {f.path}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={onClose}
          className="font-sans text-body-sm text-muted hover:text-ink"
        >
          关闭
        </button>
      </div>
      <div className="flex-1">
        <DiffEditor
          height="100%"
          language={
            currentFile.path.endsWith('.java')
              ? 'java'
              : currentFile.path.endsWith('.yml') || currentFile.path.endsWith('.yaml')
                ? 'yaml'
                : 'plaintext'
          }
          original={currentFile.oldContent}
          modified={currentFile.newContent}
          theme="vs"
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'ui-monospace', monospace",
            wordWrap: 'off',
          }}
        />
      </div>
    </div>
  );
}
