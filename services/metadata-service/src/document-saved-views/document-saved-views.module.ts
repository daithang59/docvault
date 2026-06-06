import { Module } from '@nestjs/common';
import { DocumentSavedViewsController } from './document-saved-views.controller';
import { DocumentSavedViewsService } from './document-saved-views.service';

@Module({
  controllers: [DocumentSavedViewsController],
  providers: [DocumentSavedViewsService],
})
export class DocumentSavedViewsModule {}
