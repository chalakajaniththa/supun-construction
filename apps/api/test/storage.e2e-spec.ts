import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { StorageService } from '../src/common/storage/storage.service.js';
import { type TestContext, createTestApp } from './helpers.js';

describe('StorageService (SeaweedFS S3)', () => {
  let ctx: TestContext;
  let storage: StorageService;
  const keys: string[] = [];

  beforeAll(async () => {
    ctx = await createTestApp();
    storage = ctx.app.get(StorageService);
  });

  afterAll(async () => {
    for (const key of keys) await storage.deleteObject(key).catch(() => undefined);
    await ctx.app.close();
  });

  it('created the bucket on start (ensureBucket is idempotent)', async () => {
    await storage.ensureBucket();
    await expect(storage.ping()).resolves.toBeUndefined();
  });

  it('uploads a buffer, reads it back, heads it and deletes it', async () => {
    const key = `tmp/e2e-${randomUUID()}/hello.txt`;
    keys.push(key);
    const content = Buffer.from('ආයුබෝවන් — hello from the e2e test', 'utf8');
    await storage.putObject({ key, body: content, contentType: 'text/plain; charset=utf-8' });

    const info = await storage.headObject(key);
    expect(info?.size).toBe(content.length);
    expect(info?.contentType).toContain('text/plain');

    const { stream, info: getInfo } = await storage.getObjectStream(key);
    expect(getInfo.size).toBe(content.length);
    expect((await buffer(stream)).equals(content)).toBe(true);

    await storage.deleteObject(key);
    expect(await storage.headObject(key)).toBeNull();
  });

  it('uploads a stream with a known length', async () => {
    const key = `tmp/e2e-${randomUUID()}/data.bin`;
    keys.push(key);
    const data = Buffer.alloc(256 * 1024, 7);
    await storage.putObject({
      key,
      body: Readable.from([data.subarray(0, 100_000), data.subarray(100_000)]),
      contentLength: data.length,
      contentType: 'application/octet-stream',
      metadata: { sha256: 'test' },
    });
    const info = await storage.headObject(key);
    expect(info?.size).toBe(data.length);
    expect(info?.metadata?.sha256).toBe('test');
  });

  it('headObject returns null for a missing key', async () => {
    expect(await storage.headObject(`tmp/missing-${randomUUID()}`)).toBeNull();
  });
});
