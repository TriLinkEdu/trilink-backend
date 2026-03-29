import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

function weakEtag(data: unknown): string {
  const s = typeof data === 'string' ? data : JSON.stringify(data);
  const h = createHash('sha256').update(s).digest('hex').slice(0, 32);
  return `W/"${h}"`;
}

@Injectable()
export class EtagInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const inm = req.headers['if-none-match'];
    return next.handle().pipe(
      map((data) => {
        const etag = weakEtag(data);
        if (inm && inm === etag) {
          throw new HttpException('', HttpStatus.NOT_MODIFIED);
        }
        const res = context.switchToHttp().getResponse<{ setHeader: (k: string, v: string) => void }>();
        res.setHeader('ETag', etag);
        return data;
      }),
    );
  }
}
