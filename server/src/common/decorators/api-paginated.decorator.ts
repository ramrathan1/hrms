import { applyDecorators, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

import { PageMeta } from '../dto/pagination.dto';

/** Documents the { data, meta } envelope every list endpoint returns. */
export const ApiPaginatedResponse = <T extends Type<unknown>>(model: T) =>
  applyDecorators(
    ApiExtraModels(model, PageMeta),
    ApiOkResponse({
      schema: {
        allOf: [
          {
            properties: {
              data: { type: 'array', items: { $ref: getSchemaPath(model) } },
              meta: { $ref: getSchemaPath(PageMeta) },
            },
          },
        ],
      },
    }),
  );
