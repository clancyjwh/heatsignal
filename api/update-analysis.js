// In-memory store (clears on Vercel cold starts, but provides "Bolt-like" temporary persistence)
let latestAnalysis = null;

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

    if (req.method === 'GET') {
        return res.status(200).json(latestAnalysis || { success: false, message: 'No data received yet' });
    }

    if (req.method === 'POST') {
        try {
            const payload = req.body;
            const incomingSecret = req.headers['x-heatsignal-secret'] || payload.secret;
            const targetSecret = process.env.MAKE_SECRET || 'Heatsignal_Alpha_9xK2m_2026';

            // Security check - Only enforce in production if secret is provided or expected
            if (process.env.NODE_ENV === 'production') {
                if (incomingSecret !== targetSecret) {
                    console.warn(`Unauthorized attempt with secret: ${incomingSecret}`);
                    return res.status(401).json({ error: 'Unauthorized', message: 'Check your x-heatsignal-secret header' });
                }
            }

            // Handle ResultCollection Structure
            const collection = payload.payloadCollection || {};
            let assetsRaw = collection.assetsArray || [];

            // If assetsArray is an object (1Collection, 2Collection...), convert to array
            const assetsArray = Array.isArray(assetsRaw)
                ? assetsRaw
                : Object.values(assetsRaw);

            if (assetsArray.length === 0) {
                return res.status(400).json({ error: 'No assets found in payload' });
            }

            // Map and store the data
            const processedData = assetsArray.map(asset => ({
                pair: asset.pair,
                price: asset.price,
                compositeScore: asset.compositeScore || asset.cumulativeSignalCollection?.blended || 0,
                inputs: asset.inputsCollection || {}
            }));

            latestAnalysis = {
                success: true,
                project: collection.project,
                runDate: collection.runDate,
                assetCount: assetsArray.length,
                data: processedData,
                timestamp: new Date().toISOString()
            };

            console.log(`Successfully processed ${assetsArray.length} assets for ${collection.project}`);

            return res.status(200).json({
                success: true,
                message: 'Analysis updated successfully',
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
