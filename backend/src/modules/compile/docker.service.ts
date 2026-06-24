import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs/promises';
import { spawn } from 'child_process';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProgressGateway } from '../../websocket/progress.gateway';

export interface CompileResult {
  success: boolean;
  log: string;
}

const JAVA_HOME_MAP: Record<string, string> = {
  '8': '/usr/lib/jvm/java-1.8.0-openjdk',
  '11': '/usr/lib/jvm/java-11-openjdk',
  '17': '/usr/lib/jvm/java-17-openjdk',
  '21': '/usr/lib/jvm/java-21-openjdk',
};

@Injectable()
export class DockerService {
  private readonly logger = new Logger(DockerService.name);
  private readonly dataDir = path.join(process.cwd(), '..', 'data', 'plugins');

  constructor(
    private prisma: PrismaService,
    private wsGateway: ProgressGateway,
  ) {}

  private getPluginDir(userId: string, pluginId: string) {
    return path.join(this.dataDir, userId, pluginId);
  }

  private getSrcDir(userId: string, pluginId: string) {
    return path.join(this.getPluginDir(userId, pluginId), 'src');
  }

  private getJarsDir(userId: string, pluginId: string) {
    return path.join(this.getPluginDir(userId, pluginId), 'jars');
  }

  private getJavaHome(javaVersion: string): string {
    return JAVA_HOME_MAP[javaVersion] || JAVA_HOME_MAP['17'];
  }

  private resolveJavaVersion(plugin: { javaVersion: string; mcVersion: string }): string {
    if (plugin.javaVersion && JAVA_HOME_MAP[plugin.javaVersion]) {
      return plugin.javaVersion;
    }
    // Auto-detect from MC version
    const mv = plugin.mcVersion;
    if (!mv) return '17';
    const major = parseInt(mv.split('.')[1] || '0', 10);
    if (major <= 12) return '8';
    if (major <= 16) return '11';
    if (major <= 20) {
      const parts = mv.split('.');
      const minor = parseInt(parts[2] || '0', 10);
      return minor >= 6 ? '21' : '17';
    }
    return '21';
  }

  async compile(pluginId: string, userId: string, onLog?: (text: string) => void): Promise<CompileResult> {
    const plugin = await this.prisma.pluginProject.findUnique({
      where: { id: pluginId },
    });
    if (!plugin) return { success: false, log: '插件不存在' };

    const srcDir = this.getSrcDir(userId, pluginId);
    const jarsDir = this.getJarsDir(userId, pluginId);
    const resolvedJava = this.resolveJavaVersion(plugin);
    const javaHome = this.getJavaHome(resolvedJava);

    await fs.mkdir(jarsDir, { recursive: true });

    this.wsGateway.pushProgress(userId, 'compile', 10, `MC ${plugin.mcVersion} → JDK ${resolvedJava}\n`);
    this.wsGateway.pushProgress(userId, 'compile', 10, `正在启动 Maven…\n`);

    return new Promise<CompileResult>((resolve) => {
      const child = spawn('mvn', ['clean', 'package', '-Duser.home=/root'], {
        cwd: srcDir,
        env: {
          ...process.env,
          JAVA_HOME: javaHome,
          MAVEN_OPTS: '-Xmx512m',
          PATH: `${javaHome}/bin:${process.env.PATH}`,
        },
        shell: true,
      });

      // Push immediate maven output
      this.wsGateway.pushProgress(userId, 'compile', 15, 'Maven 正在启动，首次编译可能需要下载依赖…\n');

      let fullLog = '';
      let hasOutput = false;

      const onData = (chunk: string) => {
        hasOutput = true;
        const text = chunk.replace(/\x1b\[[0-9;]*m/g, '');
        fullLog += text;
        this.wsGateway.pushProgress(userId, 'compile', this.parseProgress(text), text);
        onLog?.(text);
      };

      child.stdout?.on('data', (chunk: Buffer) => onData(chunk.toString('utf8')));
      child.stderr?.on('data', (chunk: Buffer) => onData(chunk.toString('utf8')));

      const timeout = setTimeout(() => {
        child.kill();
        resolve({ success: false, log: fullLog + '\n编译超时 (120s)' });
      }, 120000);

      child.on('close', async (code) => {
        clearTimeout(timeout);
        if (!hasOutput) {
          fullLog += 'Maven 未产生输出，请检查 src 目录是否存在 pom.xml\n';
        }
        if (code === 0) {
          try {
            const targetDir = path.join(srcDir, 'target');
            const files = await fs.readdir(targetDir);
            const jarFile = files.find(
              (f) => f.endsWith('.jar') && !f.endsWith('-shaded.jar') && !f.includes('original'),
            );
            if (jarFile) {
              const v = plugin.currentVersion;
              await fs.copyFile(path.join(targetDir, jarFile), path.join(jarsDir, `plugin-v${v}.jar`));
              fullLog += `\nJAR 已生成: plugin-v${v}.jar\n`;
            }
          } catch {
            fullLog += '\n未找到编译产物 JAR 文件\n';
          }
        }
        resolve({ success: code === 0, log: fullLog });
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        resolve({ success: false, log: fullLog + `\n启动 Maven 失败: ${err.message}` });
      });
    });
  }

  private parseProgress(logLine: string): number {
    if (logLine.includes('Downloading')) return 20;
    if (logLine.includes('Compiling') || logLine.includes('compile')) return 50;
    if (logLine.includes('Processing')) return 70;
    if (logLine.includes('jar') || logLine.includes('package') || logLine.includes('BUILD')) return 90;
    if (logLine.includes('BUILD SUCCESS') || logLine.includes('BUILD FAILURE')) return 100;
    return 0;
  }
}
