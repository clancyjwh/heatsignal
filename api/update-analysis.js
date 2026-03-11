export default async function handler(req, res) {
    if (req.method === 'POST') {
        const payload = req.body;
        const secret = req.headers['x-heatsignal-secret'] || payload.secret;

        // Security check
        if (secret !== process.env.MAKE_SECRET && process.env.NODE_ENV === 'production') {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const assets = payload.payloadCollection?.assetsArray || [];

        // Prepare data for persistent storage (e.g., Supabase)
        // If the user has set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
        if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
            try {
                const upsertData = assets.map(asset => ({
                    pair: asset.pair,
                    price: asset.price,
                    composite_score: asset.cumulativeSignalCollection.compositeScore,
                    indicators: asset.inputsCollection,
                    updated_at: new Date().toISOString()
                }));

                // Using direct fetch to avoid npm dependencies in a serverless environment
                const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/analysis`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
                        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
                        'Prefer': 'resolution=merge-duplicates'
                    },
                    body: JSON.stringify(upsertData)
                });

                if (!response.ok) {
                    const error = await response.text();
                    console.error('Supabase error:', error);
                    return res.status(500).json({ error: 'Failed to update database' });
                }
            } catch (err) {
                console.error('Fetch error:', err);
                return res.status(500).json({ error: 'Failed to connect to persistency layer' });
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Analysis updated persistently',
            processedCount: assets.length,
            timestamp: new Date().toISOString()
        });
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
