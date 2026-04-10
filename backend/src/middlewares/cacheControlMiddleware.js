function setCacheControl(value) {
  return function cacheControl(req, res, next) {
    res.set('Cache-Control', value);
    next();
  };
}

const cachePolicies = {
  htmlFresh: setCacheControl('public, max-age=0, must-revalidate'),
  short: setCacheControl('public, s-maxage=60, stale-while-revalidate=120'),
  medium: setCacheControl('public, s-maxage=300, stale-while-revalidate=600'),
  noStore: setCacheControl('no-store'),
};

module.exports = {
  setCacheControl,
  cachePolicies,
};
