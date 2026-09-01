//--------------------------------------
//  CONVERT TIME HH:MM to Decimalhour.
//--------------------------------------

export function hhmmToDecimal(input: string): number | undefined {
  const match = input.trim().match(/^(\d+):([0-5]\d)$/);
  if (!match) return undefined;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  return hours + minutes / 60;
}

export function decimalToHHMM(decimal?: number): string {
  if (decimal === undefined) return "";

  const hours = Math.floor(decimal);
  const minutes = Math.round((decimal - hours) * 60);

  return `${hours}:${minutes.toString().padStart(2, "0")}`;
}
