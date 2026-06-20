import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApprovalChainDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  @ApiProperty({
    type: [String],
    description:
      'Ordered list of approver user IDs. Each must approve in order.',
  })
  approvers!: string[];
}
