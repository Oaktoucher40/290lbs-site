// api/supply.js
// Public supply endpoint for listings/verification (Jupiter, CoinGecko, etc.).
// Reads the LIVE total supply of $290LBS straight from the Solana chain via
// getTokenSupply — the authoritative source, reduced by every real burn.
//
//   /api/supply              -> {"totalSupply": 986539684.123, "decimals": 6}
//   /api/supply?format=plain -> 986539684.123        (plain number, most
//                                listing forms ask for exactly this)

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
  return { totalSupply: parseFloat(v.uiAmountString || v.uiAmount), decimals: v.decimals };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  // cache 60s at the edge — plenty fresh for supply, gentle on RPCs
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  let out = null;
  for (const url of endpoints()) {
    try { out = await fetchSupply(url); break; } catch (e) { /* next */ }
  }
  if (!out) return res.status(503).json({ error: 'supply unavailable' });

  if (req.query && req.query.format === 'plain') {
    res.setHeader('Content-Type', 'text/plain');
    return res.status(200).send(String(out.totalSupply));
  }
  return res.status(200).json(out);
};
