export type CoreType = 'BUKKIT' | 'SPIGOT' | 'PAPER' | 'PURPUR' | 'BUNGEECORD' | 'VELOCITY';

export type ProjectStatus = 'DRAFT' | 'MODIFIED' | 'COMPILING' | 'COMPILED' | 'FAILED';

export type CompileStatus = 'PENDING' | 'COMPILING' | 'SUCCESS' | 'FAILED';

export interface PluginProject {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  mcVersion: string;
  coreType: CoreType;
  javaVersion: string;
  packageName: string;
  status: ProjectStatus;
  currentVersion: number;
  isPublished: boolean;
  downloadCount: number;
  favoriteCount: number;
  starCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PluginVersion {
  id: string;
  pluginId: string;
  version: number;
  filesManifest: Record<string, string>;
  compileStatus: CompileStatus;
  compileLog: string | null;
  createdAt: string;
}
