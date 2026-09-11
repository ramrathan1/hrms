import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, Res,
  UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';

import { FilesService, type UploadedFile as UploadedFileShape } from './files.service';
import { FileQueryDto, UploadFileDto } from './dto/file.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Files')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Get()
  @RequirePermissions('projects:read')
  @ApiOperation({ summary: 'List attachments, optionally for one owning record' })
  findAll(@Query() query: FileQueryDto) {
    return this.files.findAll(query);
  }

  @Get('usage')
  @RequirePermissions('settings:read')
  @ApiOperation({ summary: 'Storage totals, by type' })
  usage() {
    return this.files.usage();
  }

  @Get(':id')
  @RequirePermissions('projects:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.files.findOne(id);
  }

  @Post()
  @RequirePermissions('projects:update')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload a file',
    description:
      'Max 25 MB. The stored name is a UUID, never the uploaded one. Executable ' +
      'extensions are refused, and the declared Content-Type is overridden when the ' +
      'leading bytes say otherwise.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'ownerType'],
      properties: {
        file: { type: 'string', format: 'binary' },
        ownerType: { type: 'string', example: 'project' },
        ownerId: { type: 'string', format: 'uuid' },
      },
    },
  })
  // Memory storage: files are small, and the buffer is needed for signature
  // sniffing before anything reaches disk.
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  upload(@UploadedFile() file: UploadedFileShape, @Body() dto: UploadFileDto) {
    return this.files.upload(file, dto);
  }

  @Get(':id/download')
  @RequirePermissions('projects:read')
  @ApiOperation({
    summary: 'Download a file',
    description:
      'Anything that could execute in a browser (SVG, HTML, XML) is served as an ' +
      'attachment with a sandboxing CSP, so an uploaded file cannot run as script ' +
      'on the API origin.',
  })
  async download(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response): Promise<void> {
    const { record, stream, forceDownload } = await this.files.prepareDownload(id);

    // Belt and braces against an uploaded file executing on our origin:
    // never sniff, never frame, and force the download for active types.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Type', forceDownload ? 'application/octet-stream' : record.mimeType);
    res.setHeader('Content-Length', String(record.sizeBytes));
    res.setHeader(
      'Content-Disposition',
      `${forceDownload ? 'attachment' : 'inline'}; filename="${sanitizeFilename(record.fileName)}"`,
    );

    stream.on('error', () => {
      if (!res.headersSent) res.status(500).end();
      else res.end();
    });
    stream.pipe(res);
  }

  @Delete(':id')
  @RequirePermissions('projects:update')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.files.remove(id);
  }
}

/** Strip anything that would break out of the quoted header value. */
const sanitizeFilename = (name: string) =>
  name.replace(/[^\w.\- ]+/g, '_').slice(0, 200) || 'download';
