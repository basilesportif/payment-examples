
const mkSig = (data) => {
  // sort fields in data by key, alphabetically
  const sorted = Object.keys(data).sort().reduce((acc, key) => {
    acc[key] = data[key];
    return acc;
  }, {});
  return sorted;
};

console.log(mkSig({b: 2, a: 9, c: 3}));
