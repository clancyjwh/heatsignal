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

    const GH_TOKEN = process.env.GITHUB_TOKEN_PERSISTENCE || process.env.GITHUB_TOKEN;
    const GH_REPO = process.env.GITHUB_REPO || 'heatsignal';
    const GH_OWNER = process.env.GITHUB_OWNER || 'clancyjwh';
    const FILE_PATH = 'public/data/latest_analysis.json';

    if (req.method === 'GET') {
        // Fallback: If for some reason the static file fetch fails on frontend, we can hit this
        try {
            const response = await fetch(`https://raw.githubusercontent.com/${GH_OWNER}/${GH_REPO}/main/${FILE_PATH}`);
            if (response.ok) {
                const data = await response.json();
                return res.status(200).json(data);
            }
            return res.status(200).json({ success: false, message: 'No data yet' });
        } catch (e) {
            return res.status(500).json({ success: false, error: e.message });
        }
    }

    if (req.method === 'POST') {
        try {
            const payload = req.body;
            const incomingSecret = req.headers['x-heatsignal-secret'] || payload.secret;
            const targetSecret = process.env.MAKE_SECRET || 'Heatsignal_Alpha_9xK2m_2026';

            // Security check
            if (incomingSecret !== targetSecret) {
                console.warn(`Unauthorized attempt. Input: ${incomingSecret}`);
                return res.status(401).json({ error: 'Unauthorized' });
            }

            // Handle ResultCollection Structure
            const collection = payload.payloadCollection || {};
            let assetsRaw = collection.assetsArray || [];

            // Handle if assetsArray is an object (1Collection, 2Collection...)
            const assetsArray = Array.isArray(assetsRaw)
                ? assetsRaw
                : Object.values(assetsRaw);

            // Map standard format
            const processedData = assetsArray.map(asset => ({
                pair: asset.pair,
                price: asset.price,
                // Webhook sends compositeScore inside cumulativeSignalCollection
                compositeScore: asset.cumulativeSignalCollection?.compositeScore || asset.cumulativeSignalCollection?.blended || 0,
                inputs: asset.inputsCollection || {}
            }));

            const finalPayload = {
                success: true,
                project: collection.project,
                runDate: collection.runDate,
                assetCount: assetsArray.length,
                data: processedData,
                timestamp: new Date().toISOString()
            };

            // PERSISTENCE: Save to GitHub
            if (GH_TOKEN) {
                // 1. Get current file data (SHA)
                const fileUrl = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${FILE_PATH}`;
                const getRes = await fetch(fileUrl, {
                    headers: { 'Authorization': `token ${GH_TOKEN}` }
                });

                let sha = null;
                if (getRes.ok) {
                    const fileData = await getRes.json();
                    sha = fileData.sha;
                }

                // 2. Update/Create file
                const updateRes = await fetch(fileUrl, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${GH_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `Update analysis: ${collection.project} (${new Date().toISOString()})`,
                        content: Buffer.from(JSON.stringify(finalPayload, null, 2)).toString('base64'),
                        sha: sha
                    })
                });

                if (!updateRes.ok) {
                    const err = await updateRes.text();
                    console.error('GitHub update error:', err);
                }
            }

            return res.status(200).json({
                success: true,
                message: 'Analysis updated and persisted successfully',
                processedCount: assetsArray.length
            });
        } catch (err) {
            console.error('Webhook error:', err);
            return res.status(500).json({ error: 'Internal Server Error', details: err.message });
        }
    } else {
        res.setHeader('Allow', ['GET', 'POST', 'OPTIONS']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
