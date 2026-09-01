const RFC_STYLE_EMAIL_REGEX =
  /^(?=.{1,254}$)(?=.{1,64}@)(?!\.)(?!.*\.\.)([A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*)@([A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+)$/;

export function isValidEmail(value: string): boolean {
  const trimmed = value.trim();
  return RFC_STYLE_EMAIL_REGEX.test(trimmed);
}
