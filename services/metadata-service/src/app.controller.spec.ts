import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = moduleRef.get<AppController>(AppController);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  describe('health', () => {
    it('should return health status', () => {
      expect(appController.health()).toEqual({
        status: 'ok',
        service: 'metadata-service',
      });
    });
  });
});
