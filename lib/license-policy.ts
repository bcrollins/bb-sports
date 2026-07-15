/**
 * Runtime dependency license allowlist for SBOM enforcement.
 * Unknown or disallowed licenses fail the policy check.
 */

export const ALLOWED_LICENSE_TOKENS = new Set([
  'MIT',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  '0BSD',
  'Apache-2.0',
  'BlueOak-1.0.0',
  'CC0-1.0',
  'CC-BY-4.0',
  'Unlicense',
  'Python-2.0',
  'MPL-2.0',
  // transitive sharp/tooling dual licenses seen in lockfile
  'LGPL-3.0-or-later',
]);

export type LicenseFinding = {
  name: string;
  version?: string;
  license: string;
  ok: boolean;
  reason?: string;
};

export function normalizeLicenseField(raw: unknown): string[] {
  if (raw == null) return [];
  if (typeof raw === 'string') {
    return raw
      .split(/\s+AND\s+|\s+OR\s+|\//i)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof raw === 'object' && raw && 'type' in (raw as object)) {
    return normalizeLicenseField((raw as { type?: string }).type);
  }
  return [];
}

export function licenseAllowed(licenseField: unknown): { ok: boolean; tokens: string[]; reason?: string } {
  const tokens = normalizeLicenseField(licenseField);
  if (tokens.length === 0) return { ok: false, tokens, reason: 'missing license' };
  for (const t of tokens) {
    if (!ALLOWED_LICENSE_TOKENS.has(t)) {
      return { ok: false, tokens, reason: `disallowed token: ${t}` };
    }
  }
  return { ok: true, tokens };
}

export function evaluatePackageLicenses(
  packages: Array<{ name: string; version?: string; license?: unknown }>,
): { ok: boolean; findings: LicenseFinding[] } {
  const findings: LicenseFinding[] = packages.map((pkg) => {
    const check = licenseAllowed(pkg.license);
    return {
      name: pkg.name,
      version: pkg.version,
      license: String(pkg.license ?? 'UNKNOWN'),
      ok: check.ok,
      reason: check.reason,
    };
  });
  return { ok: findings.every((f) => f.ok), findings };
}
