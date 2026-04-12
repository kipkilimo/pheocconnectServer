export default function generateAccessKey(): string {
  // Generate a random 5-digit number
  const firstFiveDigits = Math.floor(Math.random() * 90000) + 10000;

  // Generate a random last digit that is even or 5
  const lastDigit = Math.floor(Math.random() * 5) * 2; // 0, 2, 4, 6, or 8

  // Combine the digits
  const key = String(firstFiveDigits * 10 + lastDigit);

  return key;
}
