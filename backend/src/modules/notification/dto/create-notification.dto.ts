export class CreateNotificationDto {
  userId!: string;
  actorId!: string;
  actorNickname?: string;
  type!: string;
  pluginId?: string;
  pluginName?: string;
  commentContent?: string;
}
