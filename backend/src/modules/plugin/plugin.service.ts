import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs/promises';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreatePluginDto } from './dto/create-plugin.dto';
import { UpdatePluginDto } from './dto/update-plugin.dto';
import { PluginVersionService } from './plugin-version.service';

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
}

@Injectable()
export class PluginService {
  private readonly dataDir = path.join(process.cwd(), '..', 'data', 'plugins');

  constructor(
    private prisma: PrismaService,
    private pluginVersionService: PluginVersionService,
  ) {}

  private getPluginDir(userId: string, pluginId: string) {
    return path.join(this.dataDir, userId, pluginId);
  }

  private getSrcDir(userId: string, pluginId: string) {
    return path.join(this.getPluginDir(userId, pluginId), 'src');
  }

  buildFileTree(filesManifest: Record<string, string>): FileTreeNode[] {
    const root: FileTreeNode[] = [];
    const files = Object.keys(filesManifest || {});

    for (const filePath of files) {
      const parts = filePath.split('/');
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const isLast = i === parts.length - 1;
        const name = parts[i];
        const nodePath = parts.slice(0, i + 1).join('/');

        if (isLast) {
          current.push({ name, path: nodePath, type: 'file' });
        } else {
          let existing = current.find(
            (n) => n.name === name && n.type === 'directory',
          );
          if (!existing) {
            existing = {
              name,
              path: nodePath,
              type: 'directory',
              children: [],
            };
            current.push(existing);
          }
          current = existing.children!;
        }
      }
    }

    return root;
  }

  async create(dto: CreatePluginDto, userId: string) {
    const plugin = await this.prisma.pluginProject.create({
      data: {
        userId,
        name: dto.name,
        mcVersion: dto.mcVersion,
        coreType: dto.coreType,
        javaVersion: dto.javaVersion,
        packageName: dto.packageName,
      },
    });

    await fs.mkdir(this.getSrcDir(userId, plugin.id), { recursive: true });
    await fs.mkdir(path.join(this.getPluginDir(userId, plugin.id), 'versions'), {
      recursive: true,
    });

    return plugin;
  }

  async findAll(userId: string, page = 1, limit = 20) {
    const where = { userId };

    const [items, total] = await Promise.all([
      this.prisma.pluginProject.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.pluginProject.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, userId: string) {
    const plugin = await this.prisma.pluginProject.findUnique({
      where: { id },
    });
    if (!plugin) throw new NotFoundException('Plugin not found');
    if (plugin.userId !== userId) throw new ForbiddenException('Not your plugin');

    const versions = await this.prisma.pluginVersion.findMany({
      where: { pluginId: id },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        compileStatus: true,
        createdAt: true,
      },
    });

    const latestVersion = await this.prisma.pluginVersion.findFirst({
      where: { pluginId: id },
      orderBy: { version: 'desc' },
    });

    let fileTree: FileTreeNode[] = [];
    if (latestVersion) {
      const manifest = latestVersion.filesManifest as unknown as {
        files: Record<string, string>;
      };
      fileTree = this.buildFileTree(manifest.files || {});
    }

    return { plugin, fileTree, versions };
  }

  async update(id: string, dto: UpdatePluginDto, userId: string) {
    const plugin = await this.prisma.pluginProject.findUnique({
      where: { id },
    });
    if (!plugin) throw new NotFoundException('Plugin not found');
    if (plugin.userId !== userId) throw new ForbiddenException('Not your plugin');

    return this.prisma.pluginProject.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
    });
  }

  async remove(id: string, userId: string) {
    const plugin = await this.prisma.pluginProject.findUnique({
      where: { id },
    });
    if (!plugin) throw new NotFoundException('Plugin not found');
    if (plugin.userId !== userId) throw new ForbiddenException('Not your plugin');

    await this.prisma.pluginProject.delete({ where: { id } });

    try {
      await fs.rm(this.getPluginDir(userId, id), { recursive: true, force: true });
    } catch {
      // File system cleanup is best-effort
    }
  }

  async getFileContent(id: string, filePath: string, userId: string) {
    const plugin = await this.prisma.pluginProject.findUnique({
      where: { id },
    });
    if (!plugin) throw new NotFoundException('Plugin not found');
    if (plugin.userId !== userId) throw new ForbiddenException('Not your plugin');

    const fullPath = path.join(this.getSrcDir(userId, id), filePath);

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      return { path: filePath, content };
    } catch {
      throw new NotFoundException('File not found');
    }
  }
}
