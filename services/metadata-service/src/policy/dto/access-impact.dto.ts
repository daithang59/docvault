import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Classification } from '../../documents/dto/create-document.dto';

export class AccessImpactDto {
  @IsEnum(Classification, {
    message: `classification must be one of: ${Object.values(Classification).join(', ')}`,
  })
  @ApiProperty({ enum: Classification })
  classification!: string;
}
