export {}

declare global {
  interface Window {
    showDirectoryPicker(options?: {
      mode?: 'read' | 'readwrite'
    }): Promise<FileSystemDirectoryHandle>
  }

  interface FileSystemDirectoryHandle {
    kind: 'directory'
    name: string
    getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>
    getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>
    removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>
    values(): AsyncIterableIterator<FileSystemHandle>
    keys(): AsyncIterableIterator<string>
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>
    [Symbol.asyncIterator](): AsyncIterableIterator<[string, FileSystemHandle]>
  }

  interface FileSystemHandle {
    kind: 'file' | 'directory'
    name: string
    isSameEntry(other: FileSystemHandle): Promise<boolean>
    queryPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>
    requestPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>
  }

  interface FileSystemFileHandle {
    kind: 'file'
    name: string
    getFile(): Promise<File>
    createWritable(): Promise<FileSystemWritableFileStream>
    createWriter(options?: { keepExistingData?: boolean }): Promise<FileSystemWritableFileStream>
  }

  interface FileSystemWritableFileStream extends WritableStream {
    write(data: BufferSource | Blob | string | WriteParams): Promise<void>
    seek(position: number): Promise<void>
    truncate(size: number): Promise<void>
  }

  interface WriteParams {
    type: 'write' | 'seek' | 'truncate'
    data?: BufferSource | Blob | string
    position?: number
    size?: number
  }
}
