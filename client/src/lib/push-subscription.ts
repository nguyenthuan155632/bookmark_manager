const VAPID_PUBLIC_KEY = import.meta.env.VITE_PUBLIC_WEB_PUSH_KEY?.trim();

export type PushSubscriptionPayload = {
  endpoint: string;
  keys?: {
    auth?: string;
    p256dh?: string;
  };
};

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeUserToPush(): Promise<PushSubscriptionPayload> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push notifications are not supported in this browser');
  }

  if (!VAPID_PUBLIC_KEY) {
    throw new Error('Push notifications are not configured');
  }

  const registration = await navigator.serviceWorker.ready;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission denied');
  }

  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    const json = existing.toJSON();
    if (!json.endpoint) {
      throw new Error('Push manager returned an invalid subscription');
    }
    return json as PushSubscriptionPayload;
  }

  const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });

  const json = subscription.toJSON();
  if (!json.endpoint) {
    throw new Error('Push manager returned an invalid subscription');
  }

  return json as PushSubscriptionPayload;
}

export async function unsubscribeUserFromPush(): Promise<string | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null;
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    return null;
  }

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  return endpoint;
}

export async function getCurrentSubscriptionEndpoint(): Promise<string | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null;
  }
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return subscription?.endpoint ?? null;
}
