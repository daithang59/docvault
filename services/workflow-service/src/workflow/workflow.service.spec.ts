import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MetadataClient } from '../metadata/metadata.client';
import { NotificationClient } from '../notification/notification.client';
import { WorkflowService } from './workflow.service';

const mockDoc = (overrides?: Partial<{ id: string; ownerId: string; status: string }>) => ({
  id: 'doc-1',
  ownerId: 'alice',
  status: 'DRAFT',
  title: 'Test Doc',
  ...overrides,
});

const mockUser = (overrides?: Partial<{ sub: string; roles: string[] }>) => ({
  sub: 'alice',
  roles: [] as string[],
  ...overrides,
});

const mockContext = {
  traceId: 'trace-1',
  actorId: 'alice',
  roles: [],
  authorization: 'Bearer test',
};

describe('WorkflowService', () => {
  let workflowService: WorkflowService;
  let metadataClient: jest.Mocked<MetadataClient>;
  let notificationClient: jest.Mocked<NotificationClient>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowService,
        {
          provide: MetadataClient,
          useValue: {
            getDocument: jest.fn(),
            updateStatus: jest.fn(),
            getApprovers: jest.fn().mockResolvedValue({ userIds: ['approver1'] }),
          },
        },
        {
          provide: NotificationClient,
          useValue: {
            notify: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    workflowService = module.get<WorkflowService>(WorkflowService);
    metadataClient = module.get(MetadataClient);
    notificationClient = module.get(NotificationClient);
  });

  // ─── submit ─────────────────────────────────────────────────────────────────

  describe('submit', () => {
    it('should transition DRAFT → PENDING when called by owner editor', async () => {
      const doc = mockDoc({ ownerId: 'alice' });
      metadataClient.getDocument.mockResolvedValue(doc);
      metadataClient.updateStatus.mockResolvedValue({ ...doc, status: 'PENDING' });

      const result = await workflowService.submit(
        'doc-1',
        mockUser({ sub: 'alice', roles: ['editor'] }),
        mockContext,
      );

      expect(result.status).toBe('PENDING');
      expect(metadataClient.updateStatus).toHaveBeenCalledWith(
        'doc-1',
        'PENDING',
        'SUBMIT',
        mockContext,
      );
      expect(notificationClient.notify).toHaveBeenCalledWith(mockContext, {
        type: 'SUBMITTED',
        docId: 'doc-1',
        docTitle: 'Test Doc',
        recipientIds: ['approver1'],
      });
    });

    it('should throw ConflictException when document is not DRAFT', async () => {
      metadataClient.getDocument.mockResolvedValue(
        mockDoc({ status: 'PUBLISHED' }),
      );

      await expect(
        workflowService.submit(
          'doc-1',
          mockUser({ roles: ['editor'] }),
          mockContext,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ForbiddenException when non-owner non-admin editor submits', async () => {
      metadataClient.getDocument.mockResolvedValue(
        mockDoc({ ownerId: 'bob' }),
      );

      await expect(
        workflowService.submit(
          'doc-1',
          mockUser({ sub: 'alice', roles: ['editor'] }),
          mockContext,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to submit any DRAFT document', async () => {
      metadataClient.getDocument.mockResolvedValue(mockDoc({ ownerId: 'bob' }));
      metadataClient.updateStatus.mockResolvedValue({
        ...mockDoc({ ownerId: 'bob' }),
        status: 'PENDING',
      });

      const result = await workflowService.submit(
        'doc-1',
        mockUser({ sub: 'alice', roles: ['admin'] }),
        mockContext,
      );

      expect(result.status).toBe('PENDING');
    });

    it('should throw ForbiddenException when viewer submits', async () => {
      await expect(
        workflowService.submit(
          'doc-1',
          mockUser({ roles: ['viewer'] }),
          mockContext,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── approve ────────────────────────────────────────────────────────────────

  describe('approve', () => {
    it('should transition PENDING → PUBLISHED when called by approver', async () => {
      metadataClient.getDocument.mockResolvedValue(
        mockDoc({ status: 'PENDING' }),
      );
      metadataClient.updateStatus.mockResolvedValue({
        ...mockDoc({ status: 'PENDING' }),
        status: 'PUBLISHED',
      });

      const result = await workflowService.approve(
        'doc-1',
        mockUser({ roles: ['approver'] }),
        { ...mockContext, actorId: 'approver1', roles: ['approver'] },
      );

      expect(result.status).toBe('PUBLISHED');
      expect(notificationClient.notify).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ type: 'APPROVED' }),
      );
    });

    it('should throw ConflictException when document is not PENDING', async () => {
      metadataClient.getDocument.mockResolvedValue(mockDoc({ status: 'DRAFT' }));

      await expect(
        workflowService.approve(
          'doc-1',
          mockUser({ roles: ['approver'] }),
          mockContext,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ForbiddenException when editor tries to approve', async () => {
      await expect(
        workflowService.approve(
          'doc-1',
          mockUser({ roles: ['editor'] }),
          mockContext,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── reject ─────────────────────────────────────────────────────────────────

  describe('reject', () => {
    it('should transition PENDING → DRAFT when called by approver with reason', async () => {
      metadataClient.getDocument.mockResolvedValue(
        mockDoc({ status: 'PENDING' }),
      );
      metadataClient.updateStatus.mockResolvedValue({
        ...mockDoc({ status: 'PENDING' }),
        status: 'DRAFT',
      });

      const result = await workflowService.reject(
        'doc-1',
        'Insufficient coverage',
        mockUser({ roles: ['approver'] }),
        { ...mockContext, actorId: 'approver1', roles: ['approver'] },
      );

      expect(result.status).toBe('DRAFT');
      expect(metadataClient.updateStatus).toHaveBeenCalledWith(
        'doc-1',
        'DRAFT',
        'REJECT',
        expect.objectContaining({}),
        'Insufficient coverage',
      );
      expect(notificationClient.notify).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ type: 'REJECTED', reason: 'Insufficient coverage' }),
      );
    });

    it('should throw ConflictException when document is not PENDING', async () => {
      metadataClient.getDocument.mockResolvedValue(mockDoc({ status: 'PUBLISHED' }));

      await expect(
        workflowService.reject(
          'doc-1',
          undefined,
          mockUser({ roles: ['approver'] }),
          mockContext,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── archive ────────────────────────────────────────────────────────────────

  describe('archive', () => {
    it('should transition PUBLISHED → ARCHIVED when called by owner editor', async () => {
      metadataClient.getDocument.mockResolvedValue(
        mockDoc({ ownerId: 'alice', status: 'PUBLISHED' }),
      );
      metadataClient.updateStatus.mockResolvedValue({
        ...mockDoc({ ownerId: 'alice', status: 'PUBLISHED' }),
        status: 'ARCHIVED',
      });

      const result = await workflowService.archive(
        'doc-1',
        mockUser({ sub: 'alice', roles: ['editor'] }),
        { ...mockContext, actorId: 'alice', roles: ['editor'] },
      );

      expect(result.status).toBe('ARCHIVED');
      expect(notificationClient.notify).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ type: 'ARCHIVED' }),
      );
    });

    it('should throw ConflictException when document is not PUBLISHED', async () => {
      metadataClient.getDocument.mockResolvedValue(mockDoc({ status: 'DRAFT' }));

      await expect(
        workflowService.archive(
          'doc-1',
          mockUser({ roles: ['editor'] }),
          mockContext,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ForbiddenException when non-owner non-admin editor archives', async () => {
      metadataClient.getDocument.mockResolvedValue(
        mockDoc({ ownerId: 'bob', status: 'PUBLISHED' }),
      );

      await expect(
        workflowService.archive(
          'doc-1',
          mockUser({ sub: 'alice', roles: ['editor'] }),
          mockContext,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to archive any PUBLISHED document', async () => {
      metadataClient.getDocument.mockResolvedValue(
        mockDoc({ ownerId: 'bob', status: 'PUBLISHED' }),
      );
      metadataClient.updateStatus.mockResolvedValue({
        ...mockDoc({ ownerId: 'bob', status: 'PUBLISHED' }),
        status: 'ARCHIVED',
      });

      const result = await workflowService.archive(
        'doc-1',
        mockUser({ sub: 'alice', roles: ['admin'] }),
        mockContext,
      );

      expect(result.status).toBe('ARCHIVED');
    });
  });
});
