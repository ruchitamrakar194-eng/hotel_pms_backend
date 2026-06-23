async function main() {
  const urls = [
    'https://hotelpmsbackend-production.up.railway.app/api/health',

  ];

  for (const url of urls) {
    try {
      console.log(`Pinging ${url}...`);
      const res = await fetch(url);
      console.log(`Status: ${res.status}`);
      const text = await res.text();
      console.log(`Response: ${text}\n`);
    } catch (err) {
      console.log(`Error pinging ${url}: ${err.message}\n`);
    }
  }
}

main();
