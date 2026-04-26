import { redisClient, connectRedis } from "../utils/redis";

type OTPPayload = {
  code: string;
  userId?: string;
  purpose?: string;
  createdAt: string;
  expiresAt?: string;
  attempts: number;
};

class OTPService {
  /* ============================================
   UTIL
  ============================================ */

  private buildKey(
    app: string,
    domain: string,
    email: string,
    purpose: string = "login",
  ) {
    return `otp:${app}:${domain}:${purpose}:${email}`;
  }

  generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /* ============================================
   STORE OTP
  ============================================ */

  async storeOTP(
    app: string,
    domain: string,
    email: string,
    code: string,
    purpose: string = "login",
  ): Promise<void> {
    await connectRedis();

    const key = this.buildKey(app, domain, email, purpose);
    const ttl = 600; // 10 minutes

    const payload: OTPPayload = {
      code,
      purpose,
      createdAt: new Date().toISOString(),
      attempts: 0,
    };

    await redisClient.setEx(key, ttl, JSON.stringify(payload));

    console.log("[DEBUG] OTP stored:", { key, email, ttl });
  }

  async storeOTPWithDetails(params: {
    app: string;
    domain: string;
    email: string;
    code: string;
    expiresAt: Date;
    purpose: string;
    userId: string;
  }): Promise<void> {
    await connectRedis();

    const key = this.buildKey(
      params.app,
      params.domain,
      params.email,
      params.purpose,
    );

    const ttl = Math.floor((params.expiresAt.getTime() - Date.now()) / 1000);

    const payload: OTPPayload = {
      code: params.code,
      userId: params.userId,
      purpose: params.purpose,
      expiresAt: params.expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
      attempts: 0,
    };

    await redisClient.setEx(key, ttl, JSON.stringify(payload));

    console.log("[DEBUG] OTP stored (detailed):", {
      key,
      email: params.email,
      ttl,
    });
  }

  /* ============================================
   VERIFY OTP (FULL RESPONSE)
  ============================================ */

  async verifyOTP(
    app: string,
    domain: string,
    email: string,
    code: string,
    purpose: string = "login",
  ): Promise<{ valid: boolean; userId?: string; message?: string }> {
    await connectRedis();

    const key = this.buildKey(app, domain, email, purpose);
    const data = await redisClient.get(key);

    if (!data) {
      return { valid: false, message: "OTP expired or not found" };
    }

    const otpData: OTPPayload = JSON.parse(data);

    // Max attempts
    if (otpData.attempts >= 5) {
      await redisClient.del(key);
      return { valid: false, message: "Maximum attempts exceeded" };
    }

    // Wrong code
    if (otpData.code !== code) {
      otpData.attempts += 1;

      const ttl = await redisClient.ttl(key);
      await redisClient.setEx(key, ttl > 0 ? ttl : 60, JSON.stringify(otpData));

      return {
        valid: false,
        message: `Invalid OTP. ${5 - otpData.attempts} attempts remaining`,
      };
    }

    // Expiry check
    if (otpData.expiresAt && new Date(otpData.expiresAt) < new Date()) {
      await redisClient.del(key);
      return { valid: false, message: "OTP expired" };
    }

    await redisClient.del(key);

    return {
      valid: true,
      userId: otpData.userId,
    };
  }

  /* ============================================
   SIMPLE VERIFY (BOOLEAN)
  ============================================ */

  async verifySimpleOTP(
    app: string,
    domain: string,
    email: string,
    code: string,
    purpose: string = "login",
  ): Promise<boolean> {
    await connectRedis();

    const key = this.buildKey(app, domain, email, purpose);
    const data = await redisClient.get(key);

    if (!data) return false;

    const otpData: OTPPayload = JSON.parse(data);

    if (otpData.attempts >= 5) {
      await redisClient.del(key);
      return false;
    }

    if (otpData.code !== code) {
      otpData.attempts += 1;

      const ttl = await redisClient.ttl(key);
      await redisClient.setEx(key, ttl > 0 ? ttl : 60, JSON.stringify(otpData));

      return false;
    }

    await redisClient.del(key);
    return true;
  }

  /* ============================================
   DELETE
  ============================================ */

  async deleteOTP(
    app: string,
    domain: string,
    email: string,
    purpose: string = "login",
  ): Promise<void> {
    await connectRedis();
    const key = this.buildKey(app, domain, email, purpose);
    await redisClient.del(key);
  }

  /* ============================================
   RATE LIMIT
  ============================================ */

  async checkOTPRateLimit(
    app: string,
    domain: string,
    email: string,
    purpose: string,
    limitSeconds: number = 60,
  ): Promise<{ allowed: boolean; remainingSeconds?: number }> {
    await connectRedis();

    const key = `otp:ratelimit:${app}:${domain}:${purpose}:${email}`;
    const last = await redisClient.get(key);

    if (last) {
      const elapsed = Date.now() - parseInt(last);
      if (elapsed < limitSeconds * 1000) {
        return {
          allowed: false,
          remainingSeconds: Math.ceil((limitSeconds * 1000 - elapsed) / 1000),
        };
      }
    }

    await redisClient.setEx(key, limitSeconds, Date.now().toString());
    return { allowed: true };
  }

  /* ============================================
   RESEND OTP
  ============================================ */

  async resendOTP(
    app: string,
    domain: string,
    email: string,
    purpose: string,
    userId: string,
  ): Promise<{ code: string; expiresAt: Date } | null> {
    const rate = await this.checkOTPRateLimit(app, domain, email, purpose);

    if (!rate.allowed) return null;

    const code = this.generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.storeOTPWithDetails({
      app,
      domain,
      email,
      code,
      expiresAt,
      purpose,
      userId,
    });

    return { code, expiresAt };
  }

  /* ============================================
   DEBUG
  ============================================ */

  async getOTPInfo(
    app: string,
    domain: string,
    email: string,
    purpose: string = "login",
  ): Promise<any | null> {
    await connectRedis();
    const key = this.buildKey(app, domain, email, purpose);

    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  }
}

export const otpService = new OTPService();
