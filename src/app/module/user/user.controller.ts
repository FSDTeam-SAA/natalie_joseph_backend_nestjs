import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { fileUpload } from 'src/app/helper/fileUploder';
import pick from 'src/app/helper/pick';
import { AuthGuard } from 'src/app/middlewares/auth.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserService } from './user.service';

@ApiTags('user')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @ApiOperation({
    summary: 'create user',
  })
  @HttpCode(HttpStatus.CREATED)
  async createUser(@Body() createUserDto: CreateUserDto) {
    const result = await this.userService.createUser(createUserDto);

    return {
      message: 'create user successfully',
      data: result,
    };
  }

  @Get()
  @ApiOperation({
    summary: 'get all user',
  })
  @ApiQuery({
    name: 'searchTerm',
    type: String,
    required: false,
    description: 'search term',
  })
  @ApiQuery({
    name: 'role',
    type: String,
    required: false,
    description: 'role',
  })
  @ApiQuery({
    name: 'email',
    type: String,
    required: false,
    description: 'email',
  })
  @ApiQuery({
    name: 'name',
    type: String,
    required: false,
    description: 'name',
  })
  @ApiQuery({
    name: 'page',
    type: Number,
    required: false,
    description: 'page number',
  })
  @ApiQuery({
    name: 'limit',
    type: Number,
    required: false,
    description: 'limit number',
  })
  @ApiQuery({
    name: 'sortBy',
    type: String,
    required: false,
    description: 'sort by',
  })
  @ApiQuery({
    name: 'sortOrder',
    type: String,
    required: false,
    description: 'sort order',
  })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin'))
  @HttpCode(HttpStatus.OK)
  async getAllUser(@Req() req: Request) {
    const filters = pick(req.query, ['searchTerm', 'role', 'email', 'name']);
    const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
    const result = await this.userService.getAllUser(filters, options);

    return {
      message: 'get all user successfully',
      meta: result.meta,
      data: result.data,
    };
  }

  @Get('my-profile')
  @ApiOperation({
    summary: 'get my profile',
  })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('user'))
  @HttpCode(HttpStatus.OK)
  async myProfile(@Req() req: Request) {
    const id = req.user!.id;
    const result = await this.userService.myProfile(id);

    return {
      message: 'get my profile successfully',
      data: result,
    };
  }

  @Put('my-profile')
  @ApiOperation({
    summary: 'update my profile',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateUserDto })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('user'))
  @UseInterceptors(FileInterceptor('profileImage', fileUpload.uploadConfig))
  @HttpCode(HttpStatus.OK)
  async UpdateMyProfile(
    @Req() req: Request,
    @Body() updateUserDto: UpdateUserDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const id = req.user!.id;
    const result = await this.userService.UpdateMyProfile(
      id,
      updateUserDto,
      file,
    );

    return {
      message: 'update my profile successfully',
      data: result,
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'get user by id',
  })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin'))
  @HttpCode(HttpStatus.OK)
  async getUserById(@Param('id') id: string) {
    const result = await this.userService.getUserById(id);

    return {
      message: 'get user by id successfully',
      data: result,
    };
  }

  @Put(':id')
  @ApiOperation({
    summary: 'update user',
  })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin'))
  @UseInterceptors(FileInterceptor('profileImage', fileUpload.uploadConfig))
  @HttpCode(HttpStatus.OK)
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const result = await this.userService.updateUser(id, updateUserDto, file);

    return {
      message: 'update user successfully',
      data: result,
    };
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'delete user',
  })
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard('admin'))
  @HttpCode(HttpStatus.OK)
  async deleteUser(@Param('id') id: string) {
    const result = await this.userService.deleteUser(id);

    return {
      message: 'delete user successfully',
      data: result,
    };
  }
}
