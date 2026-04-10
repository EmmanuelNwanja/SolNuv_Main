#!/usr/bin/env node

const frontend = process.env.FRONTEND_BASE_URL || 'https://solnuv.com';
const backend = process.env.BACKEND_BASE_URL || 'https://api.solnuv.com/api';

const checks = [
  {
    name: 'Frontend home HTML',
    url: `${frontend}/`,
    expectHeader: 'cache-control',
    expectIncludes: ['max-age=0', 'must-revalidate'],
  },
  {
    name: 'Frontend SW script',
    url: `${frontend}/sw.js`,
    expectHeader: 'cache-control',
    expectIncludes: ['no-store'],
  },
  {
    name: 'Frontend static chunk path',
    url: `${frontend}/_next/static/chunks/main.js`,
    expectHeader: 'cache-control',
    expectIncludes: ['immutable'],
    allowStatus: [404],
  },
  {
    name: 'Backend health',
    url: `${backend}/health`,
    expectHeader: 'cache-control',
    expectIncludes: ['no-store'],
  },
  {
    name: 'Backend SEO public',
    url: `${backend}/public/seo`,
    expectHeader: 'cache-control',
    expectIncludes: ['s-maxage=300'],
  },
  {
    name: 'Backend FAQ public',
    url: `${backend}/faq`,
    expectHeader: 'cache-control',
    expectIncludes: ['s-maxage=300'],
  },
  {
    name: 'Backend blog list',
    url: `${backend}/blog/posts`,
    expectHeader: 'cache-control',
    expectIncludes: ['s-maxage=60'],
  },
  {
    name: 'Backend payment plans',
    url: `${backend}/payments/plans`,
    expectHeader: 'cache-control',
    expectIncludes: ['s-maxage=60'],
  },
  {
    name: 'Backend leaderboard',
    url: `${backend}/dashboard/leaderboard`,
    expectHeader: 'cache-control',
    expectIncludes: ['s-maxage=60'],
  },
];

async function checkEndpoint(check) {
  const allowStatus = check.allowStatus || [];
  const response = await fetch(check.url, {
    method: 'GET',
    headers: {
      Accept: 'application/json, text/html;q=0.9,*/*;q=0.8',
    },
  });

  const statusAllowed = response.ok || allowStatus.includes(response.status);
  const headerValue = (response.headers.get(check.expectHeader) || '').toLowerCase();
  const includesAll = check.expectIncludes.every((v) => headerValue.includes(v.toLowerCase()));

  if (!statusAllowed) {
    throw new Error(`${check.name}: status ${response.status} failed for ${check.url}`);
  }

  if (!includesAll) {
    throw new Error(
      `${check.name}: header ${check.expectHeader} missing expected tokens ${check.expectIncludes.join(', ')}. Actual: ${headerValue || '(empty)'}`
    );
  }

  return {
    name: check.name,
    status: response.status,
    cacheControl: response.headers.get('cache-control') || '(none)',
  };
}

async function run() {
  console.log(`Running header smoke checks against:\n- FRONTEND_BASE_URL=${frontend}\n- BACKEND_BASE_URL=${backend}`);

  const failures = [];
  for (const check of checks) {
    try {
      const result = await checkEndpoint(check);
      console.log(`PASS ${result.name} | status=${result.status} | cache-control=${result.cacheControl}`);
    } catch (error) {
      failures.push(error.message);
      console.error(`FAIL ${error.message}`);
    }
  }

  if (failures.length > 0) {
    console.error(`\nHeader smoke check failed with ${failures.length} issue(s).`);
    process.exit(1);
  }

  console.log('\nHeader smoke check passed.');
}

run().catch((error) => {
  console.error('Smoke check crashed:', error.message);
  process.exit(1);
});
