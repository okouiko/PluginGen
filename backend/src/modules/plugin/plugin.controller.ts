import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { PluginService } from './plugin.service';
import { PluginVersionService } from './plugin-version.service';
import { CreatePluginDto } from './dto/create-plugin.dto';
import { UpdatePluginDto } from './dto/update-plugin.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CommunityService } from '../community/community.service';
import { PublishPluginDto } from '../community/dto/publish-plugin.dto';

@Controller('plugins')
export class PluginController {
  constructor(
    private pluginService: PluginService,
    private pluginVersionService: PluginVersionService,
    private communityService: CommunityService,
  ) {}

  @Post()
  create(@Body() dto: CreatePluginDto, @CurrentUser('id') userId: string) {
    return this.pluginService.create(dto, userId);
  }

  @Get()
  findAll(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.pluginService.findAll(userId, Number(page) || 1, Number(limit) || 20);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.pluginService.findOne(id, userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePluginDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.pluginService.update(id, dto, userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.pluginService.remove(id, userId);
  }

  @Post(':id/versions')
  createVersion(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.pluginVersionService.createSnapshot(id, userId);
  }

  @Get(':id/versions')
  getVersions(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.pluginVersionService.getVersions(id, userId);
  }

  @Get(':id/versions/:vid')
  getVersion(
    @Param('id') id: string,
    @Param('vid') vid: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.pluginVersionService.getVersion(id, Number(vid), userId);
  }

  @Get(':id/versions/:vid/diff')
  diffVersions(
    @Param('id') id: string,
    @Param('vid') vid: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.pluginVersionService.diffVersions(id, Number(vid), userId);
  }

  @Post(':id/versions/:vid/restore')
  restoreVersion(
    @Param('id') id: string,
    @Param('vid') vid: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.pluginVersionService.restoreVersion(id, Number(vid), userId);
  }

  @Get(':id/files')
  getFile(
    @Param('id') id: string,
    @Query('path') filePath: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.pluginService.getFileContent(id, filePath, userId);
  }

  @Post(':id/publish')
  publish(
    @Param('id') id: string,
    @Body() dto: PublishPluginDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.communityService.publish(id, userId, dto);
  }

  @Post(':id/unpublish')
  unpublish(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.communityService.unpublish(id, userId);
  }
}
