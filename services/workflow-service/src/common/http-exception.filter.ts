import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const errorPayload = isHttpException
      ? exception.getResponse()
      : { message: 'Internal server error' };

    response.status(status).json({
      statusCode: status,
      error: HttpStatus[status],
      message: Array.isArray((errorPayload as any)?.message)
        ? (errorPayload as any).message
        : [(errorPayload as any)?.message ?? 'Internal server error'],
      traceId: request.traceId,
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
    });
  }
}
