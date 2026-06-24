import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { MessageController } from './message.controller';
import { NotificationService } from './notification.service';
import { MessageService } from './message.service';

@Module({
  controllers: [NotificationController, MessageController],
  providers: [NotificationService, MessageService],
  exports: [NotificationService, MessageService],
})
export class NotificationModule {}
