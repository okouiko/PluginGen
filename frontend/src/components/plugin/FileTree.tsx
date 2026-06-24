import { useState } from 'react';

interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
}

interface FileTreeProps {
  files: FileTreeNode[];
  selectedPath?: string;
  onSelect: (path: string) => void;
}

function getFileIcon(name: string): string {
  if (name.endsWith('.java')) return '☕';
  if (name.endsWith('.yml') || name.endsWith('.yaml')) return '⚙';
  if (name.endsWith('.xml')) return '📄';
  if (name.endsWith('.properties')) return '⚙';
  if (name.endsWith('.json')) return '{ }';
  return '📄';
}

function TreeNode({
  node,
  depth,
  selectedPath,
  onSelect,
}: {
  node: FileTreeNode;
  depth: number;
  selectedPath?: string;
  onSelect: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isSelected = node.path === selectedPath;

  if (node.type === 'directory') {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={`flex w-full items-center gap-1 rounded-sm px-xxs py-xxs text-left font-sans text-body-sm text-muted transition-colors hover:bg-surface-soft ${
            depth === 0 ? 'font-medium text-ink' : ''
          }`}
          style={{ paddingLeft: `${depth * 16 + 4}px` }}
        >
          <span className="w-4 text-center">{expanded ? '▼' : '▶'}</span>
          <span>📁</span>
          <span>{node.name}</span>
        </button>
        {expanded &&
          node.children?.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
      </div>
    );
  }

  return (
    <button
      onClick={() => onSelect(node.path)}
      className={`flex w-full items-center gap-1 rounded-sm px-xxs py-xxs text-left font-sans text-body-sm transition-colors ${
        isSelected
          ? 'bg-primary/10 text-primary'
          : 'text-muted hover:bg-surface-soft'
      }`}
      style={{ paddingLeft: `${depth * 16 + 20}px` }}
    >
      <span>{getFileIcon(node.name)}</span>
      <span>{node.name}</span>
    </button>
  );
}

export function FileTree({ files, selectedPath, onSelect }: FileTreeProps) {
  if (!files || files.length === 0) {
    return (
      <div className="p-md font-sans text-body-sm text-muted">
        暂无文件
      </div>
    );
  }

  return (
    <div className="overflow-y-auto">
      {files.map((node) => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
