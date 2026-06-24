import { Controller, Get, Patch, Body, Param } from '@nestjs/common';
import { UserService } from './user.service';
import { UserProfileService } from './user-profile.service';
import { UserLevelService } from './user-level.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

class SetPinnedDto {
  pluginIds!: string[];
}

@Controller('user')
export class UserController {
  constructor(
    private userService: UserService,
    private userProfileService: UserProfileService,
    private userLevelService: UserLevelService,
  ) {}

  @Get('profile')
  async getProfile(@CurrentUser('id') userId: string) {
    return this.userService.getProfile(userId);
  }

  @Public()
  @Get('profile/:id')
  async getPublicProfile(
    @Param('id') id: string,
    @CurrentUser('id') userId?: string,
  ) {
    return this.userProfileService.getProfile(id, userId);
  }

  @Patch('profile')
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(userId, dto);
  }

  @Patch('pinned-plugins')
  async setPinnedPlugins(
    @CurrentUser('id') userId: string,
    @Body() dto: SetPinnedDto,
  ) {
    return this.userProfileService.setPinnedPlugins(userId, dto.pluginIds);
  }

  @Get('level')
  async getLevelInfo(@CurrentUser('id') userId: string) {
    return this.userLevelService.getLevelInfo(userId);
  }
}
