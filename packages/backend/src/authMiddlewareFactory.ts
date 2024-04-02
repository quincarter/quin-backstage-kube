import { HostDiscovery } from '@backstage/backend-app-api';
import { ServerTokenManager } from '@backstage/backend-common';
import {
  LoggerService,
  RootConfigService,
} from '@backstage/backend-plugin-api';
import {
  DefaultIdentityClient,
  getBearerTokenFromAuthorizationHeader,
} from '@backstage/plugin-auth-node';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import { decodeJwt } from 'jose';
import lzstring from 'lz-string';
import { URL } from 'url';

type AuthMiddlewareFactoryOptions = {
  config: RootConfigService;
  logger: LoggerService;
};

export const authMiddlewareFactory = ({
  config,
  logger,
}: AuthMiddlewareFactoryOptions): RequestHandler => {
  const baseUrl = config.getString('backend.baseUrl');
  const discovery = HostDiscovery.fromConfig(config);
  const identity = DefaultIdentityClient.create({ discovery });
  const tokenManager = ServerTokenManager.fromConfig(config, { logger });

  return async (req: Request, res: Response, next: NextFunction) => {
    const fullPath = `${req.baseUrl}${req.path}`;

    // Only apply auth to /api routes & skip auth for the following endpoints
    // Add any additional plugin routes you want to whitelist eg. events
    const nonAuthWhitelist = ['app', 'auth'];
    const nonAuthRegex = new RegExp(
      `^\/api\/(${nonAuthWhitelist.join('|')})(?=\/|$)\S*`,
    );
    if (!fullPath.startsWith('/api/') || nonAuthRegex.test(fullPath)) {
      next();
      return;
    }

    try {
      // Token cookies are compressed to reduce size
      const cookieToken = lzstring.decompressFromEncodedURIComponent(
        req.cookies.token,
      );
      const token =
        getBearerTokenFromAuthorizationHeader(req.headers.authorization) ??
        cookieToken;

      try {
        // Attempt to authenticate as a frontend request token
        await identity.authenticate(token);
      } catch (err) {
        // Attempt to authenticate as a backend request token
        await tokenManager.authenticate(token);
      }

      if (!req.headers.authorization) {
        // Authorization header may be forwarded by plugin requests
        req.headers.authorization = `Bearer ${token}`;
      }

      if (token !== cookieToken) {
        try {
          const payload = decodeJwt(token);
          res.cookie('token', token, {
            // Compress token to reduce cookie size
            encode: lzstring.compressToEncodedURIComponent,
            expires: new Date((payload?.exp ?? 0) * 1000),
            secure: baseUrl.startsWith('https://'),
            sameSite: 'lax',
            domain: new URL(baseUrl).hostname,
            path: '/',
            httpOnly: true,
          });
        } catch {
          // Ignore
        }
      }
      next();
    } catch {
      res.status(401).send(`Unauthorized`);
    }
  };
};