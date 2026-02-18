import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks must be defined inside the factory since vi.mock is hoisted
vi.mock('../../dist/db/sqlite.js', () => {
  const mockGet = vi.fn();
  const mockRun = vi.fn();
  const mockPrepare = vi.fn(() => ({ get: mockGet, run: mockRun }));
  return { default: { prepare: mockPrepare, __mockGet: mockGet, __mockRun: mockRun, __mockPrepare: mockPrepare } };
});

vi.mock('../../dist/BotController.js', () => {
  const mockPostOnly = vi.fn();
  return { default: { postOnly: mockPostOnly, __mockPostOnly: mockPostOnly } };
});

// Now import the modules to get references to the mocks
import db from '../../dist/db/sqlite.js';
import BotController from '../../dist/BotController.js';
import dailyPostRouter from '../../web/routes/daily-post.js';

const mockGet = (db as any).__mockGet;
const mockRun = (db as any).__mockRun;
const mockPrepare = (db as any).__mockPrepare;
const mockPostOnly = (BotController as any).__mockPostOnly;

// Helper: yesterday's date key in UTC (matches route logic)
function getYesterdayDateKey(): string {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return yesterday.toISOString().slice(0, 10);
}

// Helper: invoke the POST handler directly with fake req/res
function invokeHandler(headers: Record<string, string> = {}): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const req: any = {
      method: 'POST',
      headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])),
    };
    const resData: any = {};
    const res: any = {
      status(code: number) { resData.status = code; return res; },
      json(data: any) { resolve({ status: resData.status, body: data }); return res; },
    };
    const layer = (dailyPostRouter as any).stack.find((l: any) => l.route?.methods?.post);
    if (!layer) return reject(new Error('No POST route found'));
    const handler = layer.route.stack[0].handle;
    Promise.resolve(handler(req, res, () => {})).catch(reject);
  });
}

describe('POST /daily-post', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV, DAILY_POST_SECRET: 'test-secret' };
    mockGet.mockReturnValue(undefined);
    mockPostOnly.mockResolvedValue(undefined);
  });

  it('returns 500 when DAILY_POST_SECRET is not configured', async () => {
    delete process.env['DAILY_POST_SECRET'];
    const { status, body } = await invokeHandler();
    expect(status).toBe(500);
    expect(body.status).toBe('error');
    expect(body.message).toMatch(/not configured/);
  });

  it('returns 401 when no Authorization header', async () => {
    const { status, body } = await invokeHandler();
    expect(status).toBe(401);
    expect(body.status).toBe('error');
    expect(body.message).toBe('Unauthorized');
  });

  it('returns 401 when Authorization header has wrong secret', async () => {
    const { status, body } = await invokeHandler({ Authorization: 'Bearer wrong-secret' });
    expect(status).toBe(401);
    expect(body.status).toBe('error');
  });

  it('returns 409 when yesterday has already been posted', async () => {
    const yesterday = getYesterdayDateKey();
    mockGet.mockReturnValue({ value: yesterday });

    const { status, body } = await invokeHandler({ Authorization: 'Bearer test-secret' });
    expect(status).toBe(409);
    expect(body.status).toBe('skipped');
    expect(body.postedFor).toBe(yesterday);
  });

  it('allows posting when last post was for a different date', async () => {
    mockGet.mockReturnValue({ value: '2020-01-01' }); // old date

    const { status, body } = await invokeHandler({ Authorization: 'Bearer test-secret' });
    expect(status).toBe(200);
    expect(body.status).toBe('success');
    expect(mockPostOnly).toHaveBeenCalledOnce();
  });

  it('allows posting when no previous post exists', async () => {
    mockGet.mockReturnValue(undefined);

    const { status, body } = await invokeHandler({ Authorization: 'Bearer test-secret' });
    expect(status).toBe(200);
    expect(body.status).toBe('success');
    expect(mockPostOnly).toHaveBeenCalledOnce();
  });

  it('returns 200 with expected shape on success', async () => {
    const { status, body } = await invokeHandler({ Authorization: 'Bearer test-secret' });
    expect(status).toBe(200);
    expect(body.status).toBe('success');
    expect(body.message).toBe('Daily post completed');
    expect(body.lastPostedAt).toBeDefined();
    expect(body.postedFor).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.postedFor).toBe(getYesterdayDateKey());
    expect(mockPostOnly).toHaveBeenCalledOnce();
  });

  it('writes last_daily_post_date to bot_state after success', async () => {
    await invokeHandler({ Authorization: 'Bearer test-secret' });
    expect(mockPrepare).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO bot_state')
    );
    expect(mockRun).toHaveBeenCalledWith('last_daily_post_date', getYesterdayDateKey());
  });

  it('returns 500 when postOnly throws', async () => {
    mockPostOnly.mockRejectedValue(new Error('Bot auth failed'));

    const { status, body } = await invokeHandler({ Authorization: 'Bearer test-secret' });
    expect(status).toBe(500);
    expect(body.status).toBe('error');
    expect(body.message).toBe('Bot auth failed');
  });
});
