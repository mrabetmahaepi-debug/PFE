const http = require('http');

const req = http.request(
  {
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  },
  (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('Response:', data));
  }
);

req.on('error', e => console.error('Error:', e));
req.write(JSON.stringify({ email: 'test@test.com', password: '123' }));
req.end();
