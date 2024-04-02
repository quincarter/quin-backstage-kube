// File: packages/backend/src/plugins/auth.ts
import { createRouter, providers } from '@backstage/plugin-auth-backend';
import {
  stringifyEntityRef,
  DEFAULT_NAMESPACE,
} from '@backstage/catalog-model';
import { Router } from 'express';
import { PluginEnvironment } from '../types';

export default async function createPlugin(
  env: PluginEnvironment,
): Promise<Router> {
  return await createRouter({
    ...env,
    providerFactories: {
      github: providers.github.create({
        signIn: {
          resolver: async ({ profile }, ctx) => {
            if (!profile.email) {
              throw new Error(
                'Login failed, user profile does not contain an email',
              );
            }
            const [localPart] = profile.email.split('@');

            const userEntityRef = stringifyEntityRef({
              kind: 'User',
              name: localPart,
              namespace: DEFAULT_NAMESPACE,
            });
            return ctx.issueToken({
              claims: {
                sub: userEntityRef,
                ent: [userEntityRef],
              },
            });
          },
        },
      }),
    },
  });
}
