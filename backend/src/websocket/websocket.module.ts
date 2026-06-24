import { Global, Module } from '@nestjs/common';
import { ProgressGateway } from './progress.gateway';
import { NotificationGateway } from '../modules/notification/notification.gateway';

@Global()
@Module({
  providers: [ProgressGateway, NotificationGateway],
  exports: [ProgressGateway, NotificationGateway],
})
export class WebSocketModule {}
