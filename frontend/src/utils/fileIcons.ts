import {
  FileCode,
  FileJson,
  FileText,
  FileType,
  FileImage,
  Folder,
  FolderOpen,
  File,
  FileSpreadsheet,
  FileTerminal,
  FileArchive,
  FileMusic,
  FileVideo,
  Settings,
  Database,
  GitBranch,
  type LucideIcon,
} from 'lucide-react'

const iconMap: Record<string, LucideIcon> = {
  ts: FileCode,
  tsx: FileCode,
  js: FileCode,
  jsx: FileCode,
  py: FileTerminal,
  java: FileCode,
  go: FileTerminal,
  rs: FileCode,
  cpp: FileCode,
  c: FileCode,
  h: FileCode,
  hpp: FileCode,
  json: FileJson,
  yaml: FileText,
  yml: FileText,
  toml: FileText,
  xml: FileText,
  html: FileType,
  css: FileType,
  scss: FileType,
  less: FileType,
  md: FileText,
  txt: FileText,
  log: FileText,
  sql: Database,
  db: Database,
  sqlite: Database,
  sh: FileTerminal,
  bash: FileTerminal,
  zsh: FileTerminal,
  ps1: FileTerminal,
  bat: FileTerminal,
  cmd: FileTerminal,
  csv: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  xls: FileSpreadsheet,
  png: FileImage,
  jpg: FileImage,
  jpeg: FileImage,
  gif: FileImage,
  svg: FileImage,
  webp: FileImage,
  ico: FileImage,
  zip: FileArchive,
  tar: FileArchive,
  gz: FileArchive,
  rar: FileArchive,
  '7z': FileArchive,
  mp3: FileMusic,
  wav: FileMusic,
  ogg: FileMusic,
  mp4: FileVideo,
  avi: FileVideo,
  mkv: FileVideo,
  mov: FileVideo,
  env: Settings,
  gitignore: GitBranch,
  dockerfile: FileTerminal,
}

export function getFileIcon(name: string, isDirectory: boolean, isExpanded?: boolean): LucideIcon {
  if (isDirectory) {
    return isExpanded ? FolderOpen : Folder
  }

  const ext = name.split('.').pop()?.toLowerCase() || ''
  const lowerName = name.toLowerCase()

  if (lowerName === 'dockerfile' || lowerName.startsWith('dockerfile.')) {
    return FileTerminal
  }
  if (lowerName === '.env' || lowerName.startsWith('.env.')) {
    return Settings
  }
  if (lowerName === '.gitignore') {
    return GitBranch
  }

  return iconMap[ext] || File
}

export function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || ''
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    java: 'java',
    go: 'go',
    rs: 'rust',
    cpp: 'cpp',
    c: 'c',
    h: 'c',
    hpp: 'cpp',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    html: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    md: 'markdown',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
    ps1: 'powershell',
    dockerfile: 'dockerfile',
  }
  return langMap[ext] || 'plaintext'
}
