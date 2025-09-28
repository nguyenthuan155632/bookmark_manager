import { aiFeedArticles, aiFeedSources, pushSubscriptions, type AiFeedArticle } from '@shared/schema.js';
import { and, desc, eq } from 'drizzle-orm';
import { webcrypto } from 'node:crypto';
import { db } from '../db';

function base64UrlEncode(data: Buffer | Uint8Array): string {
  const buffer = data instanceof Buffer ? data : Buffer.from(data);
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function decodeBase64Url(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(normalized + padding, 'base64');
}

function derToJose(derSignature: Buffer): Buffer {
  if (derSignature.length === 64 && derSignature[0] !== 0x30) {
    // Already raw (r||s)
    return Buffer.from(derSignature);
  }

  if (derSignature[0] !== 0x30) {
    throw new Error('Invalid DER signature');
  }

  let offset = 2;
  let length = derSignature[1];
  if (length & 0x80) {
    const byteLength = length & 0x7f;
    length = 0;
    for (let i = 0; i < byteLength; i += 1) {
      length = (length << 8) | derSignature[offset + i];
    }
    offset += 1 + byteLength;
  }

  const readInteger = (buffer: Buffer, start: number): { value: Buffer; next: number } => {
    if (buffer[start] !== 0x02) {
      throw new Error('Invalid DER integer');
    }

    let len = buffer[start + 1];
    let intStart = start + 2;

    if (len & 0x80) {
      const byteLen = len & 0x7f;
      len = 0;
      for (let i = 0; i < byteLen; i += 1) {
        len = (len << 8) | buffer[intStart + i];
      }
      intStart += byteLen;
    }

    const value = buffer.slice(intStart, intStart + len);
    return { value, next: intStart + len };
  };

  const { value: r, next: afterR } = readInteger(derSignature, offset);
  const { value: s } = readInteger(derSignature, afterR);

  const rPadded = Buffer.alloc(32);
  const sPadded = Buffer.alloc(32);

  r.slice(-32).copy(rPadded, 32 - Math.min(32, r.length));
  s.slice(-32).copy(sPadded, 32 - Math.min(32, s.length));

  return Buffer.concat([rPadded, sPadded]);
}

export type PushNotificationPayload = {
  title: string;
  body: string;
  url: string;
};

class PushNotificationService {
  private readonly vapidPublicKey: string;
  private readonly vapidPrivateKey: string;
  private readonly contact: string;
  private signingKeyPromise: Promise<CryptoKey> | null = null;

  constructor() {
    this.vapidPublicKey = process.env.WEB_PUSH_PUBLIC_KEY?.trim() || '';
    this.vapidPrivateKey = process.env.WEB_PUSH_PRIVATE_KEY?.trim() || '';
    this.contact = process.env.WEB_PUSH_CONTACT_EMAIL?.trim() || 'mailto:nt.apple.it@gmail.com';
  }

  get isConfigured(): boolean {
    return Boolean(this.vapidPublicKey && this.vapidPrivateKey);
  }

  async registerSubscription(
    userId: string,
    subscription: { endpoint: string; keys?: { auth: string; p256dh: string } },
  ): Promise<void> {
    if (!subscription.endpoint || !subscription.keys?.auth || !subscription.keys?.p256dh) {
      throw new Error('Invalid push subscription payload');
    }

    await db
      .insert(pushSubscriptions)
      .values({
        userId,
        endpoint: subscription.endpoint,
        authKey: subscription.keys.auth,
        p256dhKey: subscription.keys.p256dh,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          userId,
          authKey: subscription.keys.auth,
          p256dhKey: subscription.keys.p256dh,
        },
      });
  }

  async unregisterSubscription(userId: string, endpoint: string): Promise<void> {
    await db
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
  }

  async getSubscriptionStatus(userId: string): Promise<boolean> {
    const existing = await db
      .select({ id: pushSubscriptions.id })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId))
      .limit(1);

    return existing.length > 0;
  }

  private async getSigningKey(): Promise<CryptoKey> {
    if (!this.isConfigured) {
      throw new Error('WEB_PUSH_PUBLIC_KEY and WEB_PUSH_PRIVATE_KEY must be configured');
    }

    if (!this.signingKeyPromise) {
      const privateKeyBytes = decodeBase64Url(this.vapidPrivateKey);
      const publicKeyBytes = decodeBase64Url(this.vapidPublicKey);

      if (publicKeyBytes.length !== 65 || publicKeyBytes[0] !== 0x04) {
        throw new Error('Invalid VAPID public key format');
      }

      const x = base64UrlEncode(publicKeyBytes.subarray(1, 33));
      const y = base64UrlEncode(publicKeyBytes.subarray(33));
      const d = base64UrlEncode(privateKeyBytes);

      const jwk: JsonWebKey = {
        kty: 'EC',
        crv: 'P-256',
        x,
        y,
        d,
        ext: false,
        key_ops: ['sign'],
      };

      this.signingKeyPromise = webcrypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign'],
      );
    }

    return this.signingKeyPromise;
  }

  private async createVapidJwt(endpoint: string): Promise<string> {
    if (!this.isConfigured) {
      throw new Error('WEB_PUSH_PUBLIC_KEY and WEB_PUSH_PRIVATE_KEY must be configured');
    }

    const audience = (() => {
      const url = new URL(endpoint);
      return `${url.protocol}//${url.host}`;
    })();

    const header = base64UrlEncode(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
    const expiration = Math.floor(Date.now() / 1000) + 12 * 60 * 60; // 12 hours
    const payload = base64UrlEncode(
      Buffer.from(
        JSON.stringify({
          aud: audience,
          exp: expiration,
          sub: this.contact,
        }),
      ),
    );

    const unsignedToken = `${header}.${payload}`;
    const signingKey = await this.getSigningKey();
    const signatureBuffer = await webcrypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      signingKey,
      Buffer.from(unsignedToken),
    );
    const signature = derToJose(Buffer.from(signatureBuffer));
    const signatureB64 = base64UrlEncode(signature);
    return `${unsignedToken}.${signatureB64}`;
  }

  private async postPush(endpoint: string): Promise<Response> {
    const jwt = await this.createVapidJwt(endpoint);
    return fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `WebPush ${jwt}`,
        TTL: '2419200', // 4 weeks
        'Content-Length': '0',
        'Crypto-Key': `p256ecdsa=${this.vapidPublicKey}`,
      },
    });
  }

  private async sendToSubscription(endpoint: string): Promise<boolean> {
    if (!this.isConfigured) {
      return false;
    }

    try {
      const response = await this.postPush(endpoint);
      if (response.status === 404 || response.status === 410) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
        return false;
      }
      if (!response.ok) {
        console.warn(`⚠️ Push service responded with ${response.status} for ${endpoint}`);
        return false;
      }
      return true;
    } catch (error) {
      console.error('❌ Failed to send push notification:', error);
      return false;
    }
  }

  private buildNotificationContent(article: AiFeedArticle): PushNotificationPayload {
    const body =
      article.notificationContent ||
      article.summary?.slice(0, 180) ||
      'A new AI processed article is ready for you.';

    return {
      title: article.title,
      body,
      url: article.url,
    };
  }

  async sendArticleNotification(
    userId: string,
    article: AiFeedArticle,
  ): Promise<{ sent: boolean; payload: PushNotificationPayload } | null> {
    if (!this.isConfigured) {
      return null;
    }

    const payload = this.buildNotificationContent(article);

    const subscriptions = await db
      .select({ endpoint: pushSubscriptions.endpoint })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));

    if (subscriptions.length === 0) {
      return null;
    }

    let delivered = false;
    for (const sub of subscriptions) {
      const success = await this.sendToSubscription(sub.endpoint);
      delivered = delivered || success;
    }

    return delivered ? { sent: true, payload } : null;
  }

  async getLatestNotificationForEndpoint(userId: string): Promise<PushNotificationPayload | null> {
    const article = await db
      .select({
        title: aiFeedArticles.title,
        body: aiFeedArticles.notificationContent,
        url: aiFeedArticles.url,
        summary: aiFeedArticles.summary,
      })
      .from(aiFeedArticles)
      .innerJoin(aiFeedSources, eq(aiFeedArticles.sourceId, aiFeedSources.id))
      .where(eq(aiFeedSources.userId, userId))
      .orderBy(desc(aiFeedArticles.createdAt))
      .limit(1);

    if (!article.length) {
      return null;
    }

    return {
      title: article[0].title,
      body:
        article[0].body ||
        article[0].summary?.slice(0, 180) ||
        'A new AI processed article is ready for you.',
      url: article[0].url,
    };
  }
}

export const pushNotificationService = new PushNotificationService();
