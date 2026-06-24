import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs/promises';
import { PrismaService } from '../../common/prisma/prisma.service';

interface FilesManifest {
  files: Record<string, string>;
}

@Injectable()
export class PluginVersionService {
  private readonly dataDir = path.join(process.cwd(), '..', 'data', 'plugins');

  constructor(private prisma: PrismaService) {}

  private getPluginDir(userId: string, pluginId: string) {
    return path.join(this.dataDir, userId, pluginId);
  }

  getSrcDir(userId: string, pluginId: string) {
    return path.join(this.getPluginDir(userId, pluginId), 'src');
  }

  private getVersionsDir(userId: string, pluginId: string) {
    return path.join(this.getPluginDir(userId, pluginId), 'versions');
  }

  async scanDirectory(dirPath: string, basePath = ''): Promise<FilesManifest> {
    const files: Record<string, string> = {};

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relPath = basePath ? `${basePath}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          const subFiles = await this.scanDirectory(fullPath, relPath);
          Object.assign(files, subFiles.files);
        } else {
          const content = await fs.readFile(fullPath, 'utf-8');
          files[relPath] = content;
        }
      }
    } catch {
      // Directory doesn't exist yet
    }

    return { files };
  }

  async writeManifestToDisk(dirPath: string, files: Record<string, string>) {
    for (let [filePath, content] of Object.entries(files)) {
      // Strip leading src/ prefix if present (AI generator stores files with src/ prefix)
      if (filePath.startsWith('src/') || filePath.startsWith('src\\')) {
        filePath = filePath.slice(4);
      }
      const fullPath = path.join(dirPath, filePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');
    }
  }

  async createSnapshot(pluginId: string, userId: string) {
    const plugin = await this.prisma.pluginProject.findUnique({
      where: { id: pluginId },
    });
    if (!plugin) throw new NotFoundException('Plugin not found');
    if (plugin.userId !== userId) throw new ForbiddenException('Not your plugin');

    const newVersion = plugin.currentVersion + 1;
    const srcDir = this.getSrcDir(userId, pluginId);

    const filesManifest = await this.scanDirectory(srcDir);

    const version = await this.prisma.pluginVersion.create({
      data: {
        pluginId,
        version: newVersion,
        filesManifest: filesManifest as any,
      },
    });

    await fs.mkdir(this.getVersionsDir(userId, pluginId), { recursive: true });

    await this.prisma.pluginProject.update({
      where: { id: pluginId },
      data: { currentVersion: newVersion, status: 'MODIFIED' },
    });

    return version;
  }

  async getVersions(pluginId: string, userId: string) {
    const plugin = await this.prisma.pluginProject.findUnique({
      where: { id: pluginId },
    });
    if (!plugin) throw new NotFoundException('Plugin not found');
    if (plugin.userId !== userId) throw new ForbiddenException('Not your plugin');

    return this.prisma.pluginVersion.findMany({
      where: { pluginId },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        compileStatus: true,
        createdAt: true,
      },
    });
  }

  async getVersion(pluginId: string, vid: number, userId: string) {
    const plugin = await this.prisma.pluginProject.findUnique({
      where: { id: pluginId },
    });
    if (!plugin) throw new NotFoundException('Plugin not found');
    if (plugin.userId !== userId) throw new ForbiddenException('Not your plugin');

    const version = await this.prisma.pluginVersion.findUnique({
      where: { pluginId_version: { pluginId, version: vid } },
    });
    if (!version) throw new NotFoundException('Version not found');

    return version;
  }

  async diffVersions(pluginId: string, vid: number, userId: string) {
    const plugin = await this.prisma.pluginProject.findUnique({
      where: { id: pluginId },
    });
    if (!plugin) throw new NotFoundException('Plugin not found');
    if (plugin.userId !== userId) throw new ForbiddenException('Not your plugin');

    if (vid < 2) throw new NotFoundException('No previous version to compare');

    const oldVersion = await this.prisma.pluginVersion.findUnique({
      where: { pluginId_version: { pluginId, version: vid - 1 } },
    });
    const newVersion = await this.prisma.pluginVersion.findUnique({
      where: { pluginId_version: { pluginId, version: vid } },
    });

    if (!oldVersion || !newVersion) throw new NotFoundException('Version not found');

    const oldFiles = (oldVersion.filesManifest as unknown as FilesManifest).files || {};
    const newFiles = (newVersion.filesManifest as unknown as FilesManifest).files || {};

    const allPaths = new Set([...Object.keys(oldFiles), ...Object.keys(newFiles)]);
    const changedFiles: Array<{
      path: string;
      oldContent: string;
      newContent: string;
    }> = [];

    for (const filePath of allPaths) {
      const oldContent = oldFiles[filePath] || '';
      const newContent = newFiles[filePath] || '';
      if (oldContent !== newContent) {
        changedFiles.push({ path: filePath, oldContent, newContent });
      }
    }

    return {
      oldVersion: vid - 1,
      newVersion: vid,
      files: changedFiles,
    };
  }

  async restoreVersion(pluginId: string, vid: number, userId: string) {
    const plugin = await this.prisma.pluginProject.findUnique({
      where: { id: pluginId },
    });
    if (!plugin) throw new NotFoundException('Plugin not found');
    if (plugin.userId !== userId) throw new ForbiddenException('Not your plugin');

    const targetVersion = await this.prisma.pluginVersion.findUnique({
      where: { pluginId_version: { pluginId, version: vid } },
    });
    if (!targetVersion) throw new NotFoundException('Version not found');

    const srcDir = this.getSrcDir(userId, pluginId);
    const files = (targetVersion.filesManifest as unknown as FilesManifest).files || {};
    await this.writeManifestToDisk(srcDir, files);

    const newVersion = await this.createSnapshot(pluginId, userId);

    return {
      version: newVersion.version,
      message: `Restored to version ${vid}`,
    };
  }
}
