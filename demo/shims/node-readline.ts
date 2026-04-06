export const createInterface = () => ({
  question: () => {},
  close: () => {},
  [Symbol.asyncIterator]: async function* () {},
});
