import { aiFeedArticles, aiFeedSources, pushSubscriptions, type AiFeedArticle } from '@shared/schema.js';
import { and, desc, eq } from 'drizzle-orm';
import { createSign } from 'node:crypto';
import { db } from '../db';

function base64UrlEncode(buffer: Buffer): string {
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

function toPemPrivateKey(privateKey: string, publicKey: string): string {
  const privateKeyBuffer = decodeBase64Url(privateKey);
  const publicKeyBuffer = decodeBase64Url(publicKey);

  const asn1Prefix = Buffer.from('30740201010420', 'hex');
  const oidSecp256r1 = Buffer.from('a00706052b8104000a', 'hex');
  const publicKeyHeader = Buffer.from('a144034200', 'hex');
  const der = Buffer.concat([asn1Prefix, privateKeyBuffer, oidSecp256r1, publicKeyHeader, publicKeyBuffer]);
  const base64Der = der.toString('base64');
  const wrapped = base64Der.match(/.{1,64}/g)?.join('\n') ?? base64Der;
  return `-----BEGIN EC PRIVATE KEY-----\n${wrapped}\n-----END EC PRIVATE KEY-----`;
}

export type PushNotificationPayload = {
  title: string;
  body: string;
  url: string;
};

class PushNotificationService {
  private readonly vapidPublicKey: string;
  private readonly vapidPrivateKey: string;
  private readonly vapidPrivateKeyPem: string | null;
  private readonly contact: string;

  constructor() {
    const publicKey = process.env.WEB_PUSH_PUBLIC_KEY?.trim();
    const privateKey = process.env.WEB_PUSH_PRIVATE_KEY?.trim();
    this.contact = process.env.WEB_PUSH_CONTACT_EMAIL?.trim() || 'mailto:nt.apple.it@gmail.com';

    this.vapidPublicKey = publicKey || '';
    this.vapidPrivateKey = privateKey || '';
    this.vapidPrivateKeyPem = publicKey && privateKey ? toPemPrivateKey(privateKey, publicKey) : null;
  }

  get isConfigured(): boolean {
    return Boolean(this.vapidPrivateKeyPem && this.vapidPublicKey);
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

  private createVapidJwt(endpoint: string): string {
    if (!this.vapidPrivateKeyPem || !this.vapidPublicKey) {
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
    const signer = createSign('SHA256');
    signer.update(unsignedToken);
    signer.end();
    const signature = signer.sign({ key: this.vapidPrivateKeyPem, dsaEncoding: 'ieee-p1363' });
    const signatureB64 = base64UrlEncode(signature);
    return `${unsignedToken}.${signatureB64}`;
  }

  private async postPush(endpoint: string): Promise<Response> {
    const jwt = this.createVapidJwt(endpoint);
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
