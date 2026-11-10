// Enable only behind a trusted reverse proxy, such as the App Service front end.
export function requestUrl(path, headers, trustProxy = false) {
  const forwarded = headers['x-forwarded-proto'];
  const protocol = trustProxy && typeof forwarded === 'string' && forwarded.split(',')[0].trim() === 'https' ? 'https' : 'http';
  return new URL(path, `${protocol}://${headers.host || '127.0.0.1'}`);
}
