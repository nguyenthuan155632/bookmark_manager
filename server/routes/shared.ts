import { z } from 'zod';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { storage } from '../storage';
import { comparePasswords } from '../auth';

// Bulk operation schemas
export const bulkDeleteSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'At least one bookmark ID is required'),
  passcodes: z.record(z.string(), z.string().min(4).max(64)).optional(),
});

export const bulkMoveSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'At least one bookmark ID is required'),
  categoryId: z.number().int().positive().nullable(),
  passcodes: z.record(z.string(), z.string().min(4).max(64)).optional(),
});

// Vensera user ID for temporary fallback access
export const VENSERA_USER_ID = 'c73053f2-ec15-438c-8af0-3bf8c7954454';

// Rate limiting for general link checking endpoints
export const linkCheckRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit each user to 50 requests per hour
  message: { message: 'Too many link check requests, try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  // Use user ID for authenticated requests, IP for others
  keyGenerator: (req: any) => {
    return req.isAuthenticated() ? req.user.id : ipKeyGenerator(req);
  },
});

// Helper function to get userId from request or fallback to vensera
export const getUserId = (req: any): string => {
  return req.isAuthenticated() ? req.user.id : VENSERA_USER_ID;
};

// Helper: consume one AI credit and return remaining; returns error if exhausted
export const tryConsumeAiUsage = async (
  userId: string,
): Promise<{ ok: true; remaining: number | null } | { ok: false; remaining: number | null }> => {
  try {
    const prefs = await storage.getUserPreferences(userId);
    // If unlimited (null) or missing record, allow without decrement
    if (!prefs || prefs.aiUsageLimit == null) {
      return { ok: true, remaining: null };
    }
    const current = prefs.aiUsageLimit;
    if (current <= 0) {
      return { ok: false, remaining: 0 };
    }
    await storage.updateUserPreferences(userId, { aiUsageLimit: current - 1 });
    return { ok: true, remaining: current - 1 };
  } catch {
    // If preferences table not ready or other error, don't block; treat as allowed without decrement
    return { ok: true, remaining: null };
  }
};

// Helper: determine if AI should be charged based on prefs and type
export const getAiChargeDecision = async (
  userId: string,
  type: 'tags' | 'desc',
): Promise<{ shouldCharge: boolean; remaining: number | null }> => {
  try {
    const prefs = await storage.getUserPreferences(userId);
    const hasKey = !!process.env.OPENROUTER_API_KEY?.trim();
    if (!hasKey) return { shouldCharge: false, remaining: prefs?.aiUsageLimit ?? null };
    if (type === 'tags') {
      const enabled = prefs?.aiTaggingEnabled === true;
      return { shouldCharge: enabled, remaining: prefs?.aiUsageLimit ?? null };
    } else {
      const enabled = prefs?.aiDescriptionEnabled === true;
      return { shouldCharge: enabled, remaining: prefs?.aiUsageLimit ?? null };
    }
  } catch {
    return { shouldCharge: false, remaining: null };
  }
};

// Helper function to verify passcode for protected bookmark operations
export const verifyProtectedBookmarkAccess = async (
  userId: string,
  bookmarkId: number,
  providedPasscode: string | undefined,
  req: any,
): Promise<{ success: boolean; error?: { status: number; message: string } }> => {
  // Get the bookmark to check if it's protected
  const bookmark = await storage.getBookmark(userId, bookmarkId);
  if (!bookmark) {
    return { success: false, error: { status: 404, message: 'Bookmark not found' } };
  }

  // If bookmark is not protected, allow access
  if (!bookmark.hasPasscode) {
    return { success: true };
  }

  // If bookmark is protected, require passcode or owner's account password
  if (!providedPasscode || typeof providedPasscode !== 'string') {
    return {
      success: false,
      error: {
        status: 401,
        message: 'Passcode required for protected bookmark',
      },
    };
  }

  // Validate passcode format
  if (providedPasscode.length < 4 || providedPasscode.length > 64) {
    return {
      success: false,
      error: {
        status: 400,
        message: 'Invalid passcode format',
      },
    };
  }

  // Verify the passcode (bookmark-specific)
  const isValidPasscode = await storage.verifyBookmarkPasscode(
    userId,
    bookmarkId,
    providedPasscode,
  );

  // If passcode did not match, allow owner's account password as an alternative
  let isValid = isValidPasscode;
  if (!isValidPasscode && req.isAuthenticated && req.isAuthenticated()) {
    try {
      // Only the owner reaches this code path since getBookmark used userId scoping
      const ok = await comparePasswords(providedPasscode, (req.user as any).password);
      if (ok) isValid = true;
    } catch {
      // ignore
    }
  }

  // Log failed attempts for monitoring
  if (!isValid) {
    console.warn(`Failed passcode attempt for protected bookmark ${bookmarkId} from IP ${req.ip}`);
    return {
      success: false,
      error: {
        status: 401,
        message: 'Invalid passcode',
      },
    };
  }

  return { success: true };
};

// Helper: parse Bearer token and resolve user (for extension APIs)
export const getUserFromBearer = async (req: any): Promise<Express.User | undefined> => {
  const auth = req.headers['authorization'];
  if (!auth || typeof auth !== 'string') return undefined;
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return undefined;
  const token = parts[1];
  if (!token) return undefined;
  const user = await storage.getUserByApiToken(token);
  if (user) await storage.touchApiToken(token);
  return user as any;
};
