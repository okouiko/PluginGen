import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { MessageService } from './message.service';
import { SendMessageDto } from './dto/send-message.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('messages')
export class MessageController {
  constructor(private messageService: MessageService) {}

  @Post()
  async send(
    @Body() dto: SendMessageDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.messageService.send(userId, dto);
  }

  @Get('conversations')
  async getConversations(@CurrentUser('id') userId: string) {
    return this.messageService.getConversations(userId);
  }

  @Get(':userId')
  async getHistory(
    @Param('userId') otherUserId: string,
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.messageService.getHistory(
      userId,
      otherUserId,
      Number(page) || 1,
      Math.min(Number(limit) || 50, 100),
    );
  }

  @Patch('read/:userId')
  async markRead(
    @Param('userId') fromUserId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.messageService.markRead(userId, fromUserId);
  }
}
