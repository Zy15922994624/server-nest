import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import type { MulterFile } from 'multer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthUser } from '../../common/interfaces/auth-user.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateQuestionBankDto } from './dto/create-question-bank.dto';
import { ImportQuestionBankDto } from './dto/import-question-bank.dto';
import { QueryQuestionBankDto } from './dto/query-question-bank.dto';
import { UpdateQuestionBankDto } from './dto/update-question-bank.dto';
import { QuestionBankService } from './question-bank.service';

@ApiTags('question-bank')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('teacher', 'admin')
@Controller('question-bank')
export class QuestionBankController {
  constructor(private readonly questionBankService: QuestionBankService) {}

  @Get()
  @ApiOperation({ summary: '获取题库列表' })
  getQuestionBank(
    @Query() query: QueryQuestionBankDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.questionBankService.getQuestionBank(
      query,
      user.userId,
      user.role,
    );
  }

  @Get('template/download')
  @ApiOperation({ summary: '下载题库 Excel 导入模板' })
  downloadImportTemplate(@Res({ passthrough: true }) response: Response) {
    const template = this.questionBankService.getImportTemplate();

    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="question-bank-template.xlsx"; filename*=UTF-8''${encodeURIComponent(
        template.fileName,
      )}`,
    );

    return template.buffer;
  }

  @Get(':questionId')
  @ApiOperation({ summary: '获取题库题目详情' })
  getQuestionById(
    @Param('questionId') questionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.questionBankService.getQuestionById(
      questionId,
      user.userId,
      user.role,
    );
  }

  @Post()
  @ApiOperation({ summary: '创建题库题目' })
  createQuestion(
    @Body() payload: CreateQuestionBankDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.questionBankService.createQuestion(
      payload,
      user.userId,
      user.role,
    );
  }

  @Post('import')
  @ApiOperation({ summary: 'Excel 批量导入题库题目' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['courseId', 'file'],
      properties: {
        courseId: {
          type: 'string',
          description: '所属课程 ID',
        },
        file: {
          type: 'string',
          format: 'binary',
          description: 'Excel 文件，仅支持 .xlsx/.xls',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
  )
  importQuestions(
    @Body() payload: ImportQuestionBankDto,
    @UploadedFile() file: MulterFile | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) {
      throw new BadRequestException('请选择要导入的 Excel 文件');
    }

    return this.questionBankService.importQuestions(
      payload,
      file,
      user.userId,
      user.role,
    );
  }

  @Patch(':questionId')
  @ApiOperation({ summary: '更新题库题目' })
  updateQuestion(
    @Param('questionId') questionId: string,
    @Body() payload: UpdateQuestionBankDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.questionBankService.updateQuestion(
      questionId,
      payload,
      user.userId,
      user.role,
    );
  }

  @Delete(':questionId')
  @ApiOperation({ summary: '删除题库题目' })
  async deleteQuestion(
    @Param('questionId') questionId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.questionBankService.deleteQuestion(
      questionId,
      user.userId,
      user.role,
    );
    return null;
  }
}
