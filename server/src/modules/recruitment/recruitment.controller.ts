import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  ApplicationsService, InterviewsService, JobsService, OffersService,
} from './recruitment.service';
import {
  AcceptOfferDto, ApplicationQueryDto, CreateApplicationDto, CreateInterviewDto, CreateJobDto,
  CreateOfferDto, DeclineOfferDto, InterviewFeedbackDto, InterviewQueryDto, JobQueryDto,
  MoveStageDto, OfferQueryDto, UpdateApplicationDto, UpdateInterviewDto, UpdateJobDto,
} from './dto/recruitment.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Jobs')
@ApiBearerAuth()
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get() @RequirePermissions('jobs:read')
  findAll(@Query() query: JobQueryDto) { return this.jobs.findAll(query); }

  @Get('funnel')
  @RequirePermissions('jobs:read')
  @ApiOperation({ summary: 'Application counts per pipeline stage' })
  funnel(@Query('jobId') jobId?: string) { return this.jobs.funnel(jobId); }

  @Get(':id') @RequirePermissions('jobs:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.jobs.findOne(id); }

  @Post() @RequirePermissions('jobs:create')
  create(@Body() dto: CreateJobDto) { return this.jobs.createJob(dto); }

  @Patch(':id') @RequirePermissions('jobs:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateJobDto) {
    return this.jobs.updateJob(id, dto);
  }

  @Delete(':id') @RequirePermissions('jobs:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.jobs.remove(id); }
}

@ApiTags('Applications')
@ApiBearerAuth()
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Get() @RequirePermissions('applications:read')
  findAll(@Query() query: ApplicationQueryDto) { return this.applications.findAll(query); }

  @Get(':id') @RequirePermissions('applications:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.applications.findOne(id); }

  @Post() @RequirePermissions('applications:create')
  @ApiOperation({ summary: 'Apply; refused for a closed role or a duplicate candidate' })
  create(@Body() dto: CreateApplicationDto) { return this.applications.createApplication(dto); }

  @Patch(':id') @RequirePermissions('applications:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateApplicationDto) {
    return this.applications.updateApplication(id, dto);
  }

  @Patch(':id/stage')
  @RequirePermissions('applications:update')
  @ApiOperation({ summary: 'Move along the pipeline; illegal transitions are refused' })
  move(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MoveStageDto) {
    return this.applications.moveStage(id, dto);
  }

  @Delete(':id') @RequirePermissions('applications:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.applications.remove(id); }
}

@ApiTags('Interviews')
@ApiBearerAuth()
@Controller('interviews')
export class InterviewsController {
  constructor(private readonly interviews: InterviewsService) {}

  @Get() @RequirePermissions('interviews:read')
  findAll(@Query() query: InterviewQueryDto) { return this.interviews.findAll(query); }

  @Post() @RequirePermissions('interviews:create')
  schedule(@Body() dto: CreateInterviewDto) { return this.interviews.schedule(dto); }

  @Patch(':id') @RequirePermissions('interviews:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateInterviewDto) {
    return this.interviews.updateInterview(id, dto);
  }

  @Post(':id/feedback')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('interviews:update')
  @ApiOperation({ summary: 'Record the outcome and a 1–5 rating' })
  feedback(@Param('id', ParseUUIDPipe) id: string, @Body() dto: InterviewFeedbackDto) {
    return this.interviews.recordFeedback(id, dto);
  }

  @Delete(':id') @RequirePermissions('interviews:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.interviews.remove(id); }
}

@ApiTags('Offers')
@ApiBearerAuth()
@Controller('offers')
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  @Get() @RequirePermissions('offers:read')
  findAll(@Query() query: OfferQueryDto) { return this.offers.findAll(query); }

  @Get(':id') @RequirePermissions('offers:read')
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.offers.findOne(id); }

  @Post() @RequirePermissions('offers:create')
  create(@Body() dto: CreateOfferDto) { return this.offers.createOffer(dto); }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('offers:accept')
  @ApiOperation({
    summary: 'Accept an offer',
    description:
      'One transaction: marks the offer accepted, moves the application to HIRED, creates the ' +
      'Employee and its opening salary record, and decrements the job’s openings — closing the ' +
      'job at zero.',
  })
  accept(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AcceptOfferDto) {
    return this.offers.accept(id, dto);
  }

  @Post(':id/decline')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('offers:update')
  decline(@Param('id', ParseUUIDPipe) id: string, @Body() dto: DeclineOfferDto) {
    return this.offers.decline(id, dto.reason);
  }
}
