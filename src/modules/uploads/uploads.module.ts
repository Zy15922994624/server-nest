import { Module } from '@nestjs/common';
import { UploadStorageService } from './upload-storage.service';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  controllers: [UploadsController],
  providers: [UploadsService, UploadStorageService],
  exports: [UploadsService, UploadStorageService],
})
export class UploadsModule {}
