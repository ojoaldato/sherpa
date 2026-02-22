const SERVICE = "com.sherpa.cli";

export async function setSecret(key: string, value: string): Promise<void> {
  // Delete existing entry first (security command errors if it already exists)
  await Bun.$`security delete-generic-password -s ${SERVICE} -a ${key} 2>/dev/null`.quiet().nothrow();
  await Bun.$`security add-generic-password -s ${SERVICE} -a ${key} -w ${value}`.quiet();
}

export async function getSecret(key: string): Promise<string | null> {
  const result = await Bun.$`security find-generic-password -s ${SERVICE} -a ${key} -w 2>/dev/null`.quiet().nothrow();

  if (result.exitCode !== 0) return null;
  return result.stdout.toString().trim();
}

export async function deleteSecret(key: string): Promise<void> {
  await Bun.$`security delete-generic-password -s ${SERVICE} -a ${key} 2>/dev/null`.quiet().nothrow();
}

export async function hasSecret(key: string): Promise<boolean> {
  const val = await getSecret(key);
  return val !== null && val.length > 0;
}
