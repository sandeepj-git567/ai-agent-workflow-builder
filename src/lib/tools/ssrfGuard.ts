import { URL } from 'url';

export class SSRFGuard {
  private static PRIVATE_IP_PATTERNS = [
    /^127\./,                 // Loopback 127.0.0.0/8
    /^10\./,                  // Private 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Private 172.16.0.0/12
    /^192\.168\./,            // Private 192.168.0.0/16
    /^0\./,                   // Current network 0.0.0.0/8
    /^169\.254\./,            // Link-local / Cloud Metadata 169.254.0.0/16
    /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./, // Carrier NAT 100.64.0.0/10
  ];

  private static BLOCKED_HOSTNAMES = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    '[::1]',
    'metadata.google.internal',
    '169.254.169.254',
  ];

  /**
   * Validates target URL against SSRF protection policies.
   * Throws Error if URL targets a private IP, internal hostname, or non-HTTP protocol.
   */
  static validateUrl(targetUrl: string): URL {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      throw new Error(`400: Invalid URL format: ${targetUrl}`);
    }

    // Protocol check
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error(`403: Forbidden (SSRF Guard) — Protocol '${parsedUrl.protocol}' is prohibited. Only HTTP and HTTPS are allowed.`);
    }

    const hostname = parsedUrl.hostname.toLowerCase();

    // Hostname blocklist
    if (this.BLOCKED_HOSTNAMES.includes(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
      throw new Error(`403: Forbidden (SSRF Guard) — Access to internal/private hostname '${hostname}' is strictly blocked.`);
    }

    // Private IP check
    for (const pattern of this.PRIVATE_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        throw new Error(`403: Forbidden (SSRF Guard) — Access to private IP address '${hostname}' is strictly blocked.`);
      }
    }

    return parsedUrl;
  }
}
