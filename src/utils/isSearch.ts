export const isSearch = (search?: string) => ({
  isValid: !!search,
  isNumber: !!search ? /^[0-9]+$/.test(search) : false, // why to minimlize 0 being reat as a falsy condition
  text: !!search ? search?.trim() : "",
  number: search ? parseInt(search) : 0,
});
