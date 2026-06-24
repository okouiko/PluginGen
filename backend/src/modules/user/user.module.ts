import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserLevelService } from './user-level.service';
import { UserProfileService } from './user-profile.service';

@Module({
  controllers: [UserController],
  providers: [UserService, UserLevelService, UserProfileService],
  exports: [UserLevelService],
})
export class UserModule {}
