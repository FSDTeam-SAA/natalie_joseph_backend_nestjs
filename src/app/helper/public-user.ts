export function publicUser<T extends object>(user: T) {
  const result = { ...user } as Record<string, unknown>;
  for (const key of ['password', 'otp', 'otpExpiry', 'verifiedForgot'])
    delete result[key];
  return result;
}

export function redactCredentials(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactCredentials);
  if (
    !value ||
    typeof value !== 'object' ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key]) =>
          !['password', 'otp', 'otpExpiry', 'verifiedForgot'].includes(key),
      )
      .map(([key, item]) => [key, redactCredentials(item)]),
  );
}
