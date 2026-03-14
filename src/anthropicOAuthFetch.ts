const originalFetch = window.fetch;

window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  if (url.includes('api.anthropic.com') && init?.headers) {
    const headers = new Headers(init.headers);
    const apiKey = headers.get('x-api-key');

    if (apiKey?.startsWith('sk-ant-oat')) {
      headers.delete('x-api-key');
      headers.set('authorization', `Bearer ${apiKey}`);
      headers.set('anthropic-beta', 'oauth-2025-04-20');
      init.headers = headers;
    }
  }

  return originalFetch.call(this, input, init);
};
