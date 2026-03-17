import {
  AclEffect,
  AclSubjectType,
  DocumentPermission,
} from '../../../generated/prisma';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpsertAclDto {
  @IsEnum(AclSubjectType)
  subjectType!: AclSubjectType;

  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsEnum(DocumentPermission)
  permission!: DocumentPermission;

  @IsEnum(AclEffect)
  effect!: AclEffect;
}
