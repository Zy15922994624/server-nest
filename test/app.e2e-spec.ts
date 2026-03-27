import { INestApplication, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { getConnectionToken } from '@nestjs/mongoose';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

@Module({
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: getConnectionToken(),
      useValue: {
        readyState: 1,
      },
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
})
class TestAppModule {}

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/ (GET)', async () => {
    const httpServer = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(httpServer).get('/api');
    const body = response.body as {
      code: number;
      message: string;
      data: { status: string };
    };

    expect(response.status).toBe(200);
    expect(body.code).toBe(0);
    expect(body.message).toBe('ok');
    expect(body.data.status).toBe('ok');
  });
});
