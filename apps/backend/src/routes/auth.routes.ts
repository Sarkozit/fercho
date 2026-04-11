import { FastifyInstance } from 'fastify';
import { AuthController } from '../controllers/auth.controller.js';
import { getGoogleAuthUrl, exchangeCodeForTokens } from '../services/gmail.service.js';

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/login', AuthController.login);
  
  fastify.get('/me', {
    onRequest: [fastify.authenticate]
  }, AuthController.me);

  /**
   * GET /api/auth/google
   * Redirects to Google OAuth consent screen for Gmail access.
   * Use this to start the OAuth flow.
   */
  fastify.get('/google', async (_request, reply) => {
    try {
      const url = getGoogleAuthUrl();
      return reply.redirect(url);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: error.message });
    }
  });

  /**
   * GET /api/auth/google/callback?code=xxx
   * Google OAuth2 callback. Exchanges the code for tokens and stores them.
   */
  fastify.get('/google/callback', async (request, reply) => {
    const { code } = request.query as { code?: string };
    if (!code) {
      return reply.code(400).send({ error: 'Missing code parameter' });
    }

    try {
      const tokens = await exchangeCodeForTokens(code);
      return reply.send({
        ok: true,
        message: 'Gmail OAuth2 tokens saved successfully. You can now set up Gmail Watch.',
        access_token_preview: tokens.access_token.substring(0, 20) + '...',
        has_refresh_token: !!tokens.refresh_token,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Failed to exchange code for tokens', detail: error.message });
    }
  });
}
