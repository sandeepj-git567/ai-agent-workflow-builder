import { describe, it, expect } from 'vitest';
import { SSRFGuard } from '../src/lib/tools/ssrfGuard';
import { ToolRegistry } from '../src/lib/tools/registry';

describe('Tool Registry & SSRF Security Guard', () => {
  const orgAId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  it('blocks private IPv4 targets (127.0.0.1, 10.0.0.1, 192.168.1.1, 169.254.169.254)', () => {
    expect(() => SSRFGuard.validateUrl('http://127.0.0.1/admin')).toThrow(/SSRF Guard/);
    expect(() => SSRFGuard.validateUrl('http://10.0.0.5/api')).toThrow(/SSRF Guard/);
    expect(() => SSRFGuard.validateUrl('http://192.168.1.100/status')).toThrow(/SSRF Guard/);
    expect(() => SSRFGuard.validateUrl('http://169.254.169.254/latest/meta-data/')).toThrow(/SSRF Guard/);
  });

  it('blocks internal hostnames (localhost, *.local, *.internal)', () => {
    expect(() => SSRFGuard.validateUrl('http://localhost:3000')).toThrow(/SSRF Guard/);
    expect(() => SSRFGuard.validateUrl('http://metadata.google.internal')).toThrow(/SSRF Guard/);
    expect(() => SSRFGuard.validateUrl('http://app.local')).toThrow(/SSRF Guard/);
  });

  it('blocks unsafe non-HTTP protocols (file://, ftp://, gopher://)', () => {
    expect(() => SSRFGuard.validateUrl('file:///etc/passwd')).toThrow(/Protocol/);
    expect(() => SSRFGuard.validateUrl('gopher://127.0.0.1:70')).toThrow(/Protocol/);
  });

  it('allows safe public HTTP/HTTPS URLs', () => {
    const validUrl = SSRFGuard.validateUrl('https://httpbin.org/json');
    expect(validUrl.toString()).toBe('https://httpbin.org/json');
  });

  it('executes HTTP tool safely and blocks SSRF attacks via executeTool', async () => {
    const ssrfResult = await ToolRegistry.executeTool(
      'http_request',
      { url: 'http://169.254.169.254/latest/meta-data/' },
      { orgId: orgAId, userRole: 'owner' }
    );

    expect(ssrfResult.success).toBe(false);
    expect(ssrfResult.error).toContain('SSRF Guard');
  });
});
