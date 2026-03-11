// Persistent storage for the current session (Vercel warm starts)
let cache = {
    data: null,
    timestamp: null
};

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-heatsignal-secret');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const GH_TOKEN = process.env.GITHUB_TOKEN;
    const GH_REPO = process.env.GITHUB_REPO || 'heatsignal';
    const GH_OWNER = process.env.GITHUB_OWNER || 'clancyjwh';
    const FILE_PATH = 'public/data/latest_analysis.json';

    // GET: Return the latest analysis
    if (req.method === 'GET') {
        if (cache.data) {
            return res.status(200).json(cache.data);
        }

        // If memory is empty, try to fetch the committed file from GitHub API (not raw)
        try {
            const fileUrl = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${FILE_PATH}`;
            const headers = GH_TOKEN ? { 'Authorization': `token ${GH_TOKEN}` } : {};
            const ghRes = await fetch(fileUrl, { headers });

            if (ghRes.ok) {
                const fileData = await ghRes.json();
                const content = Buffer.from(fileData.content, 'base64').toString();
                cache.data = JSON.parse(content);
                return res.status(200).json(cache.data);
            }
        } catch (e) {
            console.error('GH Fetch Error:', e.message);
        }

        return res.status(200).json({ success: false, message: 'No data found' });
    }

    // POST: Update analysis from Webhook
    if (req.method === 'POST') {
        try {
            const payload = req.body;

            // LOGGING: Crucial for user to see in Vercel
            console.log('Incoming Webhook Payload:', JSON.stringify(payload).substring(0, 500) + '...');

            // Security check
            const incomingSecret = req.headers['x-heatsignal-secret'] || payload.secret;
            const targetSecret = process.env.MAKE_SECRET || 'Heatsignal_Alpha_9xK2m_2026';

            if (incomingSecret !== targetSecret) {
                console.error('AUTH FAILURE: Expected', targetSecret, 'but got', incomingSecret);
                return res.status(401).json({
                    success: false,
                    error: 'Unauthorized',
                    message: `Secret mismatch. Provided: ${incomingSecret}`
                });
            }

            // Navigate the ResultCollection structure
            const root = payload.payloadCollection || payload; // fallback if missing wrapper
            const assetsRaw = root.assetsArray || [];

            // Handle if assetsArray is an object (Make.com sometimes flattens it)
            const assetsArray = Array.isArray(assetsRaw)
                ? assetsRaw
                : Object.values(assetsRaw);

            if (assetsArray.length === 0) {
                console.error('DATA ERROR: assetsArray is empty or missing');
                return res.status(400).json({ success: false, error: 'No assets found in payload' });
            }

            // Map standard format - EXACT MAPPING FOR ResultCollection
            const processedData = assetsArray.map(asset => {
                // Ensure we handle nested compositeScore
                const score = asset.cumulativeSignalCollection?.compositeScore
                    || asset.cumulativeSignalCollection?.blended
                    || asset.compositeScore
                    || 0;

                return {
                    pair: asset.pair,
                    price: asset.price || "0.00000",
                    compositeScore: parseFloat(score),
                    inputs: asset.inputsCollection || asset.indicatorsCollection || {}
                };
            });

            const finalPayload = {
                success: true,
                project: root.project || 'HeatSignal',
                runDate: root.runDate || new Date().toISOString().split('T')[0],
                assetCount: processedData.length,
                data: processedData,
                timestamp: new Date().toISOString()
            };

            // Update local memory cache directly
            cache.data = finalPayload;

            // PERSISTENCE: Save to GitHub
            if (GH_TOKEN) {
                try {
                    const fileUrl = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${FILE_PATH}`;
                    const getRes = await fetch(fileUrl, {
                        headers: { 'Authorization': `token ${GH_TOKEN}` }
                    });

                    let sha = null;
                    if (getRes.ok) {
                        const fileData = await getRes.json();
                        sha = fileData.sha;
                    }

                    const updateRes = await fetch(fileUrl, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `token ${GH_TOKEN}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            message: `Update analysis: ${processedData.length} pairs`,
                            content: Buffer.from(JSON.stringify(finalPayload, null, 2)).toString('base64'),
                            sha: sha
                        })
                    });

                    if (!updateRes.ok) {
                        const errText = await updateRes.text();
                        console.error('GitHub Sync Failed:', errText);
                    } else {
                        console.log('Successfully committed to GitHub persistence.');
                    }
                } catch (ghErr) {
                    console.error('Persistence Exception:', ghErr.message);
                }
            } else {
                console.warn('GITHUB_TOKEN missing. Persistence limited to warm restarts.');
            }

            return res.status(200).json({
                success: true,
                message: 'Analysis updated successfully',
                processedCount: processedData.length,
                persistence: GH_TOKEN ? 'GitHub' : 'In-Memory Only'
            });

        } catch (err) {
            console.error('CRITICAL WEBHOOK ERROR:', err.message);
            return res.status(500).json({ success: false, error: 'Internal Server Error', details: err.message });
        }
    } else {
        res.setHeader('Allow', ['GET', 'POST', 'OPTIONS']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
