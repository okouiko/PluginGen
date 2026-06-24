import { Module } from '@nestjs/common';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';
import { FavoriteService } from './favorite.service';
import { LikeService } from './like.service';
import { CommentService } from './comment.service';
import { RatingService } from './rating.service';
import { FollowService } from './follow.service';
import { NotificationService } from '../notification/notification.service';
import { UserLevelService } from '../user/user-level.service';
import { DailyTaskService } from '../daily/daily-task.service';

@Module({
  controllers: [CommunityController],
  providers: [
    CommunityService,
    FavoriteService,
    LikeService,
    CommentService,
    RatingService,
    FollowService,
    NotificationService,
    UserLevelService,
    DailyTaskService,
  ],
})
export class CommunityModule {}
