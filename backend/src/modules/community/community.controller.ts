import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { CommunityService } from './community.service';
import { FavoriteService } from './favorite.service';
import { LikeService } from './like.service';
import { CommentService } from './comment.service';
import { RatingService } from './rating.service';
import { FollowService } from './follow.service';
import { FavoriteDto } from './dto/favorite.dto';
import { CreateCommentDto } from './dto/comment.dto';
import { RatingDto } from './dto/rating.dto';
import { FollowDto } from './dto/follow.dto';
import { LikeDto } from './dto/like.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { CoreType } from '@prisma/client';

@Controller('community')
export class CommunityController {
  constructor(
    private communityService: CommunityService,
    private favoriteService: FavoriteService,
    private likeService: LikeService,
    private commentService: CommentService,
    private ratingService: RatingService,
    private followService: FollowService,
  ) {}

  @Public()
  @Get('plugins')
  async search(
    @Query('q') q?: string,
    @Query('coreType') coreType?: CoreType,
    @Query('mcVersion') mcVersion?: string,
    @Query('sort') sort?: 'latest' | 'popular',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.communityService.search({
      q,
      coreType,
      mcVersion,
      sort: sort || 'latest',
      page: Number(page) || 1,
      limit: Math.min(Number(limit) || 20, 50),
    });
  }

  @Public()
  @Get('plugins/:id')
  async getDetail(
    @Param('id') id: string,
    @CurrentUser('id') userId?: string,
  ) {
    return this.communityService.getDetail(id, userId);
  }

  @Public()
  @Get('plugins/:id/comments')
  async getComments(@Param('id') id: string) {
    return this.commentService.findByPlugin(id);
  }

  @Post('favorite')
  async toggleFavorite(
    @Body() dto: FavoriteDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.favoriteService.toggle(userId, dto.pluginId);
  }

  @Post('like')
  async toggleLike(
    @Body() dto: LikeDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.likeService.toggle(userId, dto.targetId, dto.targetType);
  }

  @Post('comment')
  async createComment(
    @Body() dto: CreateCommentDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.commentService.create(userId, dto);
  }

  @Post('rating')
  async upsertRating(
    @Body() dto: RatingDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.ratingService.upsert(userId, dto.pluginId, dto.score);
  }

  @Post('follow')
  async toggleFollow(
    @Body() dto: FollowDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.followService.toggle(userId, dto.followingId);
  }
}
