// Receives GitHub events forwarded by Vercel Connect to /triggers/github.
// Pings the Vercel Deploy Hook so solux-hub rebuilds.

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const deployHookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (!deployHookUrl) {
    return res.status(500).json({ error: 'Deploy hook missing' });
  }

  try {
    // Body may already be an object (Vercel) or a JSON string.
    let payload = req.body;
    if (typeof payload === 'string') {
      payload = payload ? JSON.parse(payload) : {};
    }
    payload = payload || {};

    // Optional filter: ignore non-main pushes when the payload includes a ref.
    if (payload.ref && payload.ref !== 'refs/heads/main') {
      return res.status(200).json({
        message: 'Ignored — not a main-branch push.',
        ref: payload.ref,
      });
    }

    const hookRes = await fetch(deployHookUrl, { method: 'POST' });
    if (!hookRes.ok) {
      return res.status(502).json({
        error: 'Deploy hook failed',
        status: hookRes.status,
      });
    }

    return res.status(200).json({
      message: 'Sync started! solux-hub is rebuilding.',
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to trigger rebuild' });
  }
};
