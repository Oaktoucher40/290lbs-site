// api/devbal.js
// Vercel serverless function — reads the dev wallet's token balances from the
// Solana chain *server-side*, so the browser never deals with CORS or RPC keys.
// The page fetches '/api/devbal' (same origin) and gets back
//   { balance, pct, sigmaBalance }
//   - balance / pct : the dev wallet's $290LBS holdings (pct of total supply)
//   - sigmaBalance  : the dev wallet's $SIGMA holdings (the $SIGMA fund)
//
// Works with NO configuration (uses key-less public RPCs server-side, where CORS
// does not apply). Optionally set a Helius key as the env var HELIUS_API_KEY in
// Vercel for maximum reliability — it will be tried first and never touches the page.

const MINT = 'AvzGHK4ZcfX7UbRz3b1vKFoZNTFo9dC1cXUEhByxpump';       // $290LBS
const SIGMA_MINT = '5SVG3T9CNQsm2kEwzbRq6hASqh1oGfjqTtLXYUibpump'; // $SIGMA (the fund)
const DEV_WALLET = '3TMrxNKH5Eavc6599Z1DDG4FMqdby5wLVN8ULcWRJDo1';
const TOTAL_SUPPLY = 1000000000;

function endpoints() {
  const list = [];
  if (process.env.HELIUS_API_KEY) {
    list.push('https://mainnet.helius-rpc.com/?api-key=' + process.env.HELIUS_API_KEY);
  }
  // Key-less public endpoints. They block browsers via CORS, but from a server
  // there is no CORS, so these generally answer fine.
  list.push('https://solana-rpc.publicnode.com');
  list.push('https://api.mainnet-beta.solana.com');
  return list;
}

async function queryBalance(url, mint) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTokenAccountsByOwner',
      params: [
        DEV_WALLET,
        { mint: mint },
        { encoding: 'jsonParsed', commitment: 'confirmed' }
      ]
    })
  });
  if (!r.ok) throw new Error('http ' + r.status);
  const data = await r.json();
  const accounts = data && data.result && data.result.value;
  if (!accounts) throw new Error('no result');
  let total = 0;
  for (const a of accounts) {
    const amt = a.account.data.parsed.info.tokenAmount;
    total += parseFloat(amt.uiAmountString || amt.uiAmount || 0);
  }
  return total;
}

// Try each endpoint in turn for a given mint; return the balance or null.
async function balanceForMint(mint) {
  for (const url of endpoints()) {
    try {
      return await queryBalance(url, mint);
    } catch (e) {
      // try the next endpoint
    }
  }
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  // Cache at the edge for 30s so visitors share one value and we stay gentle on RPCs.
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  // Query both independently — a failure on one never breaks the other.
  const balance = await balanceForMint(MINT);
  const sigmaBalance = await balanceForMint(SIGMA_MINT);
  const pct = (typeof balance === 'number') ? (balance / TOTAL_SUPPLY) * 100 : null;

  return res.status(200).json({ balance: balance, pct: pct, sigmaBalance: sigmaBalance });
};
