import 'dotenv/config';
import express, { type Request, Response, NextFunction } from 'express';
import { gzipSync } from 'node:zlib';
import { registerRoutes } from './routes';
import { setupVite, serveStatic, log } from './vite';
import cronService from './services/cron-service';

const MIN_HTML_COMPRESSION_SIZE = 1024; // avoid compressing tiny payloads

const venseraAuthUser = process.env.VENSERA_BASIC_AUTH_USER?.trim();
const venseraAuthPassword = process.env.VENSERA_BASIC_AUTH_PASSWORD;

function venseraAuthChallenge(res: Response) {
  res.setHeader('WWW-Authenticate', 'Basic realm="Restricted"');
  res.status(401).end('Authentication required');
}

function requireVenseraBasicAuth(req: Request, res: Response, next: NextFunction) {
  if (!venseraAuthUser || !venseraAuthPassword) {
    return next();
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Basic ')) {
    venseraAuthChallenge(res);
    return;
  }

  const base64Credentials = header.slice('Basic '.length);
  let decoded = '';

  try {
    decoded = Buffer.from(base64Credentials, 'base64').toString('utf-8');
  } catch (_error) {
    venseraAuthChallenge(res);
    return;
  }

  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex === -1) {
    venseraAuthChallenge(res);
    return;
  }

  const username = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);

  if (username === venseraAuthUser && password === venseraAuthPassword) {
    next();
    return;
  }

  venseraAuthChallenge(res);
}

const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use('/vensera', requireVenseraBasicAuth);

app.use((req, res, next) => {
  if (req.method === 'HEAD') {
    return next();
  }

  const acceptEncoding = req.headers['accept-encoding'];
  const acceptsGzip = Array.isArray(acceptEncoding)
    ? acceptEncoding.some((value) => value.toLowerCase().includes('gzip'))
    : typeof acceptEncoding === 'string'
      ? acceptEncoding.toLowerCase().includes('gzip')
      : false;

  if (!acceptsGzip) {
    return next();
  }

  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);

  let buffering = true;
  const chunks: Buffer[] = [];

  function appendVaryHeader() {
    const varyHeader = res.getHeader('Vary');
    if (!varyHeader) {
      res.setHeader('Vary', 'Accept-Encoding');
    } else if (typeof varyHeader === 'string' && !varyHeader.includes('Accept-Encoding')) {
      res.setHeader('Vary', `${varyHeader}, Accept-Encoding`);
    } else if (Array.isArray(varyHeader) && !varyHeader.includes('Accept-Encoding')) {
      res.setHeader('Vary', [...varyHeader, 'Accept-Encoding']);
    }
  }

  function restoreAndFlush(bufferToWrite?: Buffer) {
    buffering = false;
    res.write = originalWrite as typeof res.write;
    res.end = originalEnd as typeof res.end;

    if (bufferToWrite && bufferToWrite.length > 0) {
      originalWrite(bufferToWrite);
    } else if (chunks.length > 0) {
      for (const chunk of chunks) {
        originalWrite(chunk);
      }
    }
    chunks.length = 0;
  }

  res.write = function overrideWrite(chunk: any, encoding?: any, callback?: any) {
    if (!buffering) {
      return originalWrite(chunk, encoding, callback);
    }

    const contentType = res.getHeader('Content-Type');
    if (contentType && !String(contentType).toLowerCase().startsWith('text/html')) {
      restoreAndFlush();
      return originalWrite(chunk, encoding, callback);
    }

    const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);
    chunks.push(bufferChunk);
    if (typeof callback === 'function') {
      callback();
    }
    return true;
  } as typeof res.write;

  res.end = function overrideEnd(chunk?: any, encoding?: any, callback?: any) {
    if (chunk) {
      res.write(chunk, encoding);
    }

    const contentType = res.getHeader('Content-Type');
    const isHtml = contentType ? String(contentType).toLowerCase().startsWith('text/html') : false;

    if (!buffering || !isHtml) {
      restoreAndFlush();
      const endArgs: any[] = [];
      if (typeof callback === 'function') {
        endArgs.push(callback);
      } else if (typeof encoding === 'function') {
        endArgs.push(encoding);
      }
      return originalEnd(...endArgs);
    }

    const buffer = Buffer.concat(chunks);
    if (buffer.length < MIN_HTML_COMPRESSION_SIZE) {
      restoreAndFlush(buffer);
      const endArgs: any[] = [];
      if (typeof callback === 'function') {
        endArgs.push(callback);
      } else if (typeof encoding === 'function') {
        endArgs.push(encoding);
      }
      return originalEnd(...endArgs);
    }

    try {
      const compressed = gzipSync(buffer);
      appendVaryHeader();

      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Content-Length', compressed.length.toString());

      restoreAndFlush(compressed);
      const endArgs: any[] = [];
      if (typeof callback === 'function') {
        endArgs.push(callback);
      } else if (typeof encoding === 'function') {
        endArgs.push(encoding);
      }
      return originalEnd(...endArgs);
    } catch (error) {
      restoreAndFlush(buffer);
      const endArgs: any[] = [];
      if (typeof callback === 'function') {
        endArgs.push(callback);
      } else if (typeof encoding === 'function') {
        endArgs.push(encoding);
      }
      return originalEnd(...endArgs);
    }
  } as typeof res.end;

  res.on('finish', () => {
    buffering = false;
    res.write = originalWrite as typeof res.write;
    res.end = originalEnd as typeof res.end;
    chunks.length = 0;
  });

  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on('finish', () => {
    const duration = Date.now() - start;
    if (path.startsWith('/api')) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + '…';
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get('env') === 'development') {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 4001 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '4001', 10);
  server.listen(
    {
      port,
      host: '0.0.0.0',
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);

      // Start the cron job service
      log('Starting cron job service...');
      cronService.start();
      log('✅ Integrated cron job service started successfully');
      log(`📊 Cron status: ${JSON.stringify(cronService.getStatus())}`);
    },
  );

  // Graceful shutdown
  process.on('SIGTERM', () => {
    log('SIGTERM received, shutting down gracefully');

    // Stop cron service first
    log('Stopping cron service...');
    cronService.stop();
    log('✅ Cron service stopped');

    server.close(() => {
      log('✅ Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    log('SIGINT received, shutting down gracefully');

    // Stop cron service first
    log('Stopping cron service...');
    cronService.stop();
    log('✅ Cron service stopped');

    server.close(() => {
      log('✅ Server closed');
      process.exit(0);
    });
  });
})();
