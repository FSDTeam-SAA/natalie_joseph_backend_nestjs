import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Req,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import pick from 'src/app/helper/pick';

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
}
