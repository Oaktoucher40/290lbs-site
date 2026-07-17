// api/devbal.js
// Vercel serverless function — reads wallet balances from the Solana chain
// *server-side*, so the browser never deals with CORS or RPC keys.
// The page fetches '/api/devbal' (same origin) and gets back:
//   { balance, pct, sigmaBalance, communityBalance }
//   - balance / pct      : dev wallet's $290LBS holdings (pct of total supply)
//   - sigmaBalance       : dev wallet's $SIGMA holdings (the $SIGMA fund)
//   - communityBalance   : community rewards wallet's $290LBS holdings
//
// Works with NO configuration (key-less public RPCs, server-side). Optionally set
// HELIUS_API_KEY as a Vercel env var for maximum reliability — tried first.

const MINT = 'AvzGHK4ZcfX7UbRz3b1vKFoZNTFo9dC1cXUEhByxpump';       // $290LBS
const SIGMA_MINT = '5SVG3T9CNQsm2kEwzbRq6hASqh1oGfjqTtLXYUibpump'; // $SIGMA (the fund)
const DEV_WALLET = '3TMrxNKH5Eavc6599Z1DDG4FMqdby5wLVN8ULcWRJDo1';
const COMMUNITY_WALLET = 'DqiYuXs63x6Wmy6c1ymGsc8hEXH8GrSyDxrtuXX2UG3t'; // community rewards
const TOTAL_SUPPLY = 1000000000;

function endpoints() {
  const list = [];
  if (process.env.HELIUS_API_KEY) {
    list.push('https://mainnet.helius-rpc.com/?api-key=' + process.env.HELIUS_API_KEY);
  }
  list.push('https://solana-rpc.publicnode.com');
  list.push('https://api.mainnet-beta.solana.com');
  return list;
}

async function queryBalance(url, mint, owner) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTokenAccountsByOwner',
      params: [
        owner,
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

async function balanceFor(mint, owner) {
  for (const url of endpoints()) {
    try {
      return await queryBalance(url, mint, owner);
    } catch (e) { /* try next endpoint */ }
  }
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  // Query all three independently — one failing never breaks the others.
  const balance = await balanceFor(MINT, DEV_WALLET);
  const sigmaBalance = await balanceFor(SIGMA_MINT, DEV_WALLET);
  const communityBalance = await balanceFor(MINT, COMMUNITY_WALLET);
  const pct = (typeof balance === 'number') ? (balance / TOTAL_SUPPLY) * 100 : null;

  return res.status(200).json({
    balance: balance, pct: pct,
    sigmaBalance: sigmaBalance,
    communityBalance: communityBalance
  });
};
