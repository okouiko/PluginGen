import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs/promises';
import { createReadStream } from 'fs';
import type { Response } from 'express';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class FileService {
  private readonly dataDir = path.join(process.cwd(), '..', 'data', 'plugins');

  constructor(private prisma: PrismaService) {}

  private getPluginDir(userId: string, pluginId: string) {
    return path.join(this.dataDir, userId, pluginId);
  }

  private getSrcDir(userId: string, pluginId: string) {
    return path.join(this.getPluginDir(userId, pluginId), 'src');
  }

  private getJarsDir(userId: string, pluginId: string) {
    return path.join(this.getPluginDir(userId, pluginId), 'jars');
  }

  private getDepsDir(userId: string, pluginId: string) {
    return path.join(this.getPluginDir(userId, pluginId), 'deps');
  }

  private async checkOwnership(pluginId: string, userId: string) {
    const plugin = await this.prisma.pluginProject.findUnique({
      where: { id: pluginId },
    });
    if (!plugin) throw new NotFoundException('Plugin not found');
    if (plugin.userId !== userId) throw new ForbiddenException('Not your plugin');
    return plugin;
  }

  async uploadDependency(
    pluginId: string,
    userId: string,
    file: Express.Multer.File,
  ) {
    await this.checkOwnership(pluginId, userId);
    const depsDir = this.getDepsDir(userId, pluginId);
    await fs.mkdir(depsDir, { recursive: true });
    await fs.writeFile(path.join(depsDir, file.originalname), file.buffer);
    return { filename: file.originalname, size: file.size };
  }

  async uploadSource(
    pluginId: string,
    userId: string,
    file: Express.Multer.File,
  ) {
    const plugin = await this.checkOwnership(pluginId, userId);

    const AdmZip = require('adm-zip');
    const zip = new AdmZip(file.buffer);
    const entries = zip.getEntries();

    const srcDir = this.getSrcDir(userId, pluginId);
    const files: Record<string, string> = {};

    for (const entry of entries) {
      if (!entry.isDirectory && !entry.entryName.startsWith('__MACOSX')) {
        const content = entry.getData().toString('utf-8');
        files[entry.entryName] = content;

        const fullPath = path.join(srcDir, entry.entryName);
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, content);
      }
    }

    const version = await this.prisma.pluginVersion.create({
      data: {
        pluginId,
        version: plugin.currentVersion + 1,
        filesManifest: { files } as any,
      },
    });

    await this.prisma.pluginProject.update({
      where: { id: pluginId },
      data: { currentVersion: plugin.currentVersion + 1 },
    });

    return { version: version.version, files: Object.keys(files) };
  }

  async downloadSourceZip(pluginId: string, res: Response) {
    const plugin = await this.prisma.pluginProject.findUnique({
      where: { id: pluginId },
    });
    if (!plugin) throw new NotFoundException('Plugin not found');
    const srcDir = this.getSrcDir(plugin.userId, pluginId);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${plugin.name}-source.zip"`,
    );

    const { ZipArchive } = require('archiver');
    const archive = new ZipArchive({ zlib: { level: 9 } });
    archive.pipe(res);
    archive.directory(srcDir, false);
    await archive.finalize();
  }

  async downloadJar(pluginId: string, res: Response) {
    const plugin = await this.prisma.pluginProject.findUnique({
      where: { id: pluginId },
    });
    if (!plugin) throw new NotFoundException('Plugin not found');
    const jarPath = path.join(
      this.getJarsDir(plugin.userId, pluginId),
      `plugin-v${plugin.currentVersion}.jar`,
    );

    try {
      await fs.access(jarPath);
    } catch {
      throw new NotFoundException('JAR file not found. Compile the plugin first.');
    }

    res.setHeader('Content-Type', 'application/java-archive');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${plugin.name}-v${plugin.currentVersion}.jar"`,
    );

    const stream = createReadStream(jarPath);
    stream.pipe(res);
  }
}
