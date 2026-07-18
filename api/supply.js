// api/supply.js
// Supply endpoint for Jupiter Verified (and other listings).
// Reads the LIVE on-chain supply of $290LBS via getTokenSupply — the
// authoritative source, reduced automatically by every real burn.
//
//   /api/supply              -> {"circulatingSupply": 986539684.123}   (Jupiter format)
//   /api/supply?format=plain -> 986539684.123                          (plain number)

const MINT = 'AvzGHK4ZcfX7UbRz3b1vKFoZNTFo9dC1cXUEhByxpump'; // $290LBS

function endpoints() {
  const list = [];
  if (process.env.HELIUS_API_KEY) {
    list.push('https://mainnet.helius-rpc.com/?api-key=' + process.env.HELIUS_API_KEY);
  }
  list.push('https://solana-rpc.publicnode.com');
  list.push('https://api.mainnet-beta.solana.com');
  return list;
}

async function fetchSupply(url) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1,
      method: 'getTokenSupply',
      params: [MINT, { commitment: 'confirmed' }]
    })
  });
  if (!r.ok) throw new Error('http ' + r.status);
  const data = await r.json();
  const v = data && data.result && data.result.value;
  if (!v) throw new Error('no result');
  return parseFloat(v.uiAmountString || v.uiAmount);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  let supply = null;
  for (const url of endpoints()) {
    try { supply = await fetchSupply(url); break; } catch (e) { /* next */ }
  }
  if (supply === null) return res.status(503).json({ error: 'supply unavailable' });

  if (req.query && req.query.format === 'plain') {
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(String(supply));
  }
  return res.status(200).json({ circulatingSupply: supply });
};
