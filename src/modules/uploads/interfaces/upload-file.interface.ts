export interface UploadFileDto {
  key: string;
  url: string;
  originalName: string;
  size: number;
  mimeType: string;
}

export interface StoredUploadFile {
  originalname: string;
  mimetype: string;
  size: number;
  path: string;
}
