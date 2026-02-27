export interface Env {
  DB: D1Database;
  BOT_MANAGER: DurableObjectNamespace;
}

// Stub Durable Object — will be fleshed out in Phase 2
export class BotManager implements DurableObject {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/status') {
      return new Response(
        JSON.stringify({
          status: 'idle',
          message: 'BotManager DO is running. Streams not connected yet (Phase 2).',
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response('Not found', { status: 404 });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/bot/status') {
      const id = env.BOT_MANAGER.idFromName('singleton');
      const stub = env.BOT_MANAGER.get(id);
      return stub.fetch(new Request('https://bot/status'));
    }

    return new Response(
      JSON.stringify({ service: 'wordlescorer-worker', status: 'ok' }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  },
};
