import { Injectable } from '@nestjs/common';

@Injectable()
export class ParserService {
  parseResponse(markdown: string): Record<string, string> {
    const files: Record<string, string> = {};
    const fileBlockRegex = /```(?:\w+)?\s*\n\/\/\s*File:\s*(\S+)\s*\n([\s\S]*?)```/g;

    let match: RegExpExecArray | null;
    while ((match = fileBlockRegex.exec(markdown)) !== null) {
      const [, filePath, code] = match;
      files[filePath.trim()] = code.trim();
    }

    return files;
  }

  detectChanges(
    oldFiles: Record<string, string>,
    newFiles: Record<string, string>,
  ): string[] {
    const changes: string[] = [];
    const allPaths = new Set([...Object.keys(oldFiles), ...Object.keys(newFiles)]);

    for (const filePath of allPaths) {
      const oldContent = oldFiles[filePath];
      const newContent = newFiles[filePath];

      if (!oldContent && newContent) {
        changes.push(`Added: ${filePath}`);
      } else if (oldContent && !newContent) {
        changes.push(`Deleted: ${filePath}`);
      } else if (oldContent !== newContent) {
        changes.push(`Modified: ${filePath}`);
      }
    }

    return changes;
  }

  getFileExtension(filePath: string): string {
    if (filePath.endsWith('.java')) return 'java';
    if (filePath.endsWith('.yml') || filePath.endsWith('.yaml')) return 'yaml';
    if (filePath.endsWith('.xml')) return 'xml';
    if (filePath.endsWith('.json')) return 'json';
    if (filePath.endsWith('.properties')) return 'properties';
    return 'txt';
  }
}
