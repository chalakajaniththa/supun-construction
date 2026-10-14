import { createHash, randomBytes } from 'node:crypto';
import type { Response } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { StorageService } from '../src/common/storage/storage.service.js';
import { type TestContext, createTestApp, loginCookie, resetDb } from './helpers.js';

let ctx: TestContext;
let cookie: string;
let assetId: string;

const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const pdf = (text: string) =>
  Buffer.from(
    `%PDF-1.4\n% ${text}\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n`,
  );

/** supertest parser that collects a binary response body into a Buffer. */
const binary = (res: Response, cb: (err: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  const stream = res as unknown as NodeJS.ReadableStream;
  stream.on('data', (c: Buffer) => chunks.push(c));
  stream.on('end', () => cb(null, Buffer.concat(chunks)));
};

function upload(
  path: string,
  fields: Record<string, string>,
  file?: { name: string; data: Buffer },
) {
  const req = ctx.http().post(path).set('Cookie', cookie);
  for (const [k, v] of Object.entries(fields)) req.field(k, v);
  if (file) req.attach('file', file.data, file.name);
  return req;
}

beforeAll(async () => {
  ctx = await createTestApp();
  await resetDb(ctx.prisma);
  cookie = await loginCookie(ctx);
  const asset = await ctx
    .http()
    .post('/assets')
    .set('Cookie', cookie)
    .send({ name: 'Tipper', category: 'TIPPER', registrationNo: 'LK-1234', isVehicle: true })
    .expect(201);
  assetId = asset.body.id;
});

afterAll(async () => {
  await ctx.app.close();
});

describe('documents', () => {
  const v1 = pdf('insurance 2025');
  const v2 = randomBytes(300_000); // a PNG-named binary, bigger than one chunk
  let docId: string;
  let versionIds: string[] = [];

  it('uploads a document → version 1 is current', async () => {
    const res = await upload(
      '/documents',
      {
        ownerType: 'ASSET',
        ownerId: assetId,
        category: 'INSURANCE',
        title: 'Vehicle insurance',
        issueDate: '2025-10-01',
        expiryDate: '2026-09-30',
        note: 'First policy',
      },
      { name: 'insurance 2025.pdf', data: v1 },
    ).expect(201);
    docId = res.body.id;
    expect(res.body).toMatchObject({
      ownerType: 'ASSET',
      ownerId: assetId,
      ownerName: 'Tipper',
      ownerCode: 'AST-001',
      category: 'INSURANCE',
      versionCount: 1,
      currentVersion: {
        versionNo: 1,
        fileName: 'insurance 2025.pdf',
        mimeType: 'application/pdf',
        sizeBytes: v1.length,
        sha256: sha(v1),
        expiryDate: '2026-09-30T00:00:00.000Z',
        note: 'First policy',
      },
    });
    expect(res.body.currentVersion.storageKey).toBeUndefined();
    const row = await ctx.prisma.documentVersion.findFirstOrThrow({ where: { documentId: docId } });
    expect(row.storageKey).toMatch(
      new RegExp(`^documents/${docId}/v1-[0-9a-f-]{36}-insurance-2025\\.pdf$`),
    );
  });

  it('a new version becomes current; history is newest first', async () => {
    const res = await upload(
      `/documents/${docId}/versions`,
      { issueDate: '2026-10-01', expiryDate: '2027-09-30', note: 'Renewed' },
      { name: 'policy.png', data: v2 },
    ).expect(201);
    expect(res.body.currentVersion).toMatchObject({
      versionNo: 2,
      mimeType: 'image/png',
      sha256: sha(v2),
    });
    expect(res.body.versions.map((v: { versionNo: number }) => v.versionNo)).toEqual([2, 1]);
    versionIds = res.body.versions.map((v: { id: string }) => v.id);
    expect(res.body.currentVersionId).toBe(versionIds[0]);
  });

  it('downloads the exact bytes (sha256) with safe headers', async () => {
    const r1 = await ctx
      .http()
      .get(`/documents/${docId}/versions/${versionIds[1]}/download`)
      .set('Cookie', cookie)
      .buffer(true)
      .parse(binary)
      .expect(200);
    expect(sha(r1.body as Buffer)).toBe(sha(v1));
    expect(r1.headers['content-type']).toBe('application/pdf');
    expect(r1.headers['content-disposition']).toBe(
      `attachment; filename="insurance 2025.pdf"; filename*=UTF-8''insurance%202025.pdf`,
    );
    expect(r1.headers['x-content-type-options']).toBe('nosniff');

    const r2 = await ctx
      .http()
      .get(`/documents/${docId}/versions/${versionIds[0]}/download?inline=1`)
      .set('Cookie', cookie)
      .buffer(true)
      .parse(binary)
      .expect(200);
    expect(sha(r2.body as Buffer)).toBe(sha(v2));
    expect(r2.headers['content-disposition']).toMatch(/^inline; filename="policy.png"/);
    expect(Number(r2.headers['content-length'])).toBe(v2.length);

    const current = await ctx
      .http()
      .get(`/documents/${docId}/download`)
      .set('Cookie', cookie)
      .buffer(true)
      .parse(binary)
      .expect(200);
    expect(sha(current.body as Buffer)).toBe(sha(v2));

    await ctx.http().get(`/documents/${docId}/versions/${versionIds[0]}/download`).expect(401);
    await ctx
      .http()
      .get(`/documents/${docId}/versions/6f1c4a52-4a2a-4c43-9d55-4b0d2b8f2d10/download`)
      .set('Cookie', cookie)
      .expect(404);
  });

  it('restore copies an old version forward as version N+1', async () => {
    const res = await ctx
      .http()
      .post(`/documents/${docId}/versions/${versionIds[1]}/restore`)
      .set('Cookie', cookie)
      .expect(201);
    expect(res.body.versions.map((v: { versionNo: number }) => v.versionNo)).toEqual([3, 2, 1]);
    expect(res.body.currentVersion).toMatchObject({
      versionNo: 3,
      restoredFromVersionNo: 1,
      sha256: sha(v1),
      fileName: 'insurance 2025.pdf',
      expiryDate: '2026-09-30T00:00:00.000Z',
    });
    const rows = await ctx.prisma.documentVersion.findMany({
      where: { documentId: docId },
      orderBy: { versionNo: 'asc' },
    });
    expect(new Set(rows.map((r) => r.storageKey)).size).toBe(3);
    const storage = ctx.app.get(StorageService);
    expect((await storage.headObject(rows[2]!.storageKey))?.size).toBe(v1.length);
    const dl = await ctx
      .http()
      .get(`/documents/${docId}/download`)
      .set('Cookie', cookie)
      .buffer(true)
      .parse(binary)
      .expect(200);
    expect(sha(dl.body as Buffer)).toBe(sha(v1));
  });

  it('lists with owner, category, search and expiring filters', async () => {
    await upload(
      '/documents',
      {
        ownerType: 'COMPANY',
        category: 'CIDA_REGISTRATION',
        title: 'CIDA registration C5',
        expiryDate: '2099-12-31',
      },
      { name: 'cida.pdf', data: pdf('cida') },
    ).expect(201);

    const forAsset = await ctx
      .http()
      .get(`/documents?ownerType=ASSET&ownerId=${assetId}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(forAsset.body.total).toBe(1);
    expect(forAsset.body.items[0]).toMatchObject({
      versionCount: 3,
      currentVersion: { versionNo: 3 },
    });

    const company = await ctx
      .http()
      .get('/documents?ownerType=COMPANY')
      .set('Cookie', cookie)
      .expect(200);
    expect(company.body.items.map((d: { title: string }) => d.title)).toEqual([
      'CIDA registration C5',
    ]);

    // current version (v3) expired on 2026-09-30 → shows up in "expiring within 30 days"
    const expiring = await ctx
      .http()
      .get('/documents?expiring=30')
      .set('Cookie', cookie)
      .expect(200);
    expect(expiring.body.items.map((d: { id: string }) => d.id)).toEqual([docId]);

    // search by owner registration number and by file name
    expect(
      (await ctx.http().get('/documents?search=LK-1234').set('Cookie', cookie)).body.total,
    ).toBe(1);
    expect(
      (await ctx.http().get('/documents?search=cida.pdf').set('Cookie', cookie)).body.total,
    ).toBe(1);
    expect(
      (await ctx.http().get('/documents?category=INSURANCE').set('Cookie', cookie)).body.total,
    ).toBe(1);
  });

  it('PATCH changes title / category only', async () => {
    const res = await ctx
      .http()
      .patch(`/documents/${docId}`)
      .set('Cookie', cookie)
      .send({ title: 'Insurance (Ceylinco)', description: 'Comprehensive' })
      .expect(200);
    expect(res.body).toMatchObject({
      title: 'Insurance (Ceylinco)',
      category: 'INSURANCE',
      versionCount: 3,
    });
  });

  it('rejects unsupported types, missing files, bad metadata and unknown owners', async () => {
    const exe = await upload(
      '/documents',
      { ownerType: 'COMPANY', category: 'OTHER', title: 'x' },
      { name: 'setup.exe', data: Buffer.from('MZ') },
    ).expect(400);
    expect(exe.body.code).toBe('UNSUPPORTED_FILE_TYPE');

    const none = await upload('/documents', {
      ownerType: 'COMPANY',
      category: 'OTHER',
      title: 'x',
    }).expect(400);
    expect(none.body.code).toBe('FILE_REQUIRED');

    const json = await ctx
      .http()
      .post('/documents')
      .set('Cookie', cookie)
      .send({ title: 'x' })
      .expect(400);
    expect(json.body.code).toBe('FILE_REQUIRED');

    const meta = await upload(
      '/documents',
      { ownerType: 'ASSET', category: 'INSURANCE', title: '', expiryDate: '2026-02-30' },
      { name: 'a.pdf', data: pdf('a') },
    ).expect(400);
    expect(meta.body.code).toBe('VALIDATION_FAILED');
    expect(meta.body.details.map((d: { path: string }) => d.path)).toEqual(
      expect.arrayContaining(['title', 'expiryDate', 'ownerId']),
    );

    const owner = await upload(
      '/documents',
      {
        ownerType: 'WORKER',
        ownerId: '6f1c4a52-4a2a-4c43-9d55-4b0d2b8f2d10',
        category: 'NIC_COPY',
        title: 'NIC',
      },
      { name: 'nic.jpg', data: Buffer.from([0xff, 0xd8, 0xff]) },
    ).expect(400);
    expect(owner.body.code).toBe('OWNER_NOT_FOUND');

    // nothing half-created
    expect(await ctx.prisma.document.count()).toBe(2);
  });

  it('rejects files over MAX_UPLOAD_MB (50 MB) with 413 and stores nothing', async () => {
    const before = await ctx.prisma.documentVersion.count();
    const big = Buffer.alloc(50 * 1024 * 1024 + 1, 1);
    const res = await upload(
      `/documents/${docId}/versions`,
      { note: 'too big' },
      { name: 'big.pdf', data: big },
    ).expect(413);
    expect(res.body).toMatchObject({ code: 'FILE_TOO_LARGE', details: { maxMb: 50 } });
    expect(await ctx.prisma.documentVersion.count()).toBe(before);
  });

  it('soft delete hides the document but keeps its files', async () => {
    const keys = (await ctx.prisma.documentVersion.findMany({ where: { documentId: docId } })).map(
      (v) => v.storageKey,
    );
    await ctx.http().delete(`/documents/${docId}`).set('Cookie', cookie).expect(200);
    await ctx.http().get(`/documents/${docId}`).set('Cookie', cookie).expect(404);
    await ctx.http().get(`/documents/${docId}/download`).set('Cookie', cookie).expect(404);
    const list = await ctx.http().get('/documents').set('Cookie', cookie).expect(200);
    expect(list.body.items.map((d: { id: string }) => d.id)).not.toContain(docId);
    const storage = ctx.app.get(StorageService);
    for (const key of keys) expect(await storage.headObject(key)).not.toBeNull();
    // the asset's expiry badge ignores deleted documents
    const asset = await ctx.http().get(`/assets/${assetId}`).set('Cookie', cookie).expect(200);
    expect(asset.body.nextExpiry).toBeNull();
  });

  it('writes audit rows for uploads', async () => {
    const audit = await ctx.http().get('/audit?entity=Document').set('Cookie', cookie).expect(200);
    expect(audit.body.total).toBeGreaterThanOrEqual(5);
  });
});
