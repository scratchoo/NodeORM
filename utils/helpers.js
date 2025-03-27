export function isInteger(value) {
  return typeof value === 'number' && Number.isInteger(value);
}

export function isStrictPlainObject(obj) {
  return obj !== null &&
         typeof obj === 'object' &&
         Object.getPrototypeOf(obj) === Object.prototype;
}

export function startsWithWord(word, str) {
  // Create a regular expression dynamically based on the provided word
  const regex = new RegExp(`^\\s*${word}`, 'i'); // ^ asserts position at the start of the string, \s* matches any whitespace, i makes it case-insensitive
  return regex.test(str);
}

export function isString(value){
  return (typeof value === 'string');
}
