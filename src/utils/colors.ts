/**
 * Genera un color aleatorio en formato hexadecimal
 * @returns Un string con el color en formato hexadecimal (#RRGGBB)
 */
export const generateRandomColor = (): string => {
  return `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
}; 