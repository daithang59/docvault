import { Module } from '@nestjs/common';
import { DlpScannerService } from './dlp-scanner.service';
import { MalwareScannerService } from './malware-scanner.service';

@Module({
  providers: [DlpScannerService, MalwareScannerService],
  exports: [DlpScannerService, MalwareScannerService],
})
export class SecurityModule {}
