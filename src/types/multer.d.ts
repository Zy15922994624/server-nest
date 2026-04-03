declare module 'multer' {
  import type { Request } from 'express';

  export interface MulterFile {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    destination: string;
    filename: string;
    path: string;
    buffer: Buffer;
  }

  export type FileDestinationCallback = (
    error: Error | null,
    destination: string,
  ) => void;

  export type FileNameCallback = (
    error: Error | null,
    filename: string,
  ) => void;

  export interface DiskStorageOptions {
    destination?:
      | string
      | ((
          req: Request,
          file: MulterFile,
          callback: FileDestinationCallback,
        ) => void);
    filename?: (
      req: Request,
      file: MulterFile,
      callback: FileNameCallback,
    ) => void;
  }

  export type StorageEngine = object;

  export function diskStorage(options: DiskStorageOptions): StorageEngine;
}
