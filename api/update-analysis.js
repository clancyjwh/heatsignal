export default async function handler(req, res) {
    if (req.method === 'POST') {
        const payload = req.body;
        const secret = req.headers['x-heatsignal-secret'] || payload.secret;

        // Security check
        if (secret !== process.env.MAKE_SECRET && process.env.NODE_ENV === 'production') {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Handle ResultCollection Structure
        const assets = payload.payloadCollection?.assetsArray || [];

        console.log(`Received ResultCollection for project: ${payload.payloadCollection?.project}`);
        console.log(`Processing ${assets.length} assets...`);

        // In a real app, we would save this to a database (e.g., Supabase)
        // For now, we return a success response with the count
        return res.status(200).json({
            success: true,
            message: 'Analysis updated successfully',
            processedCount: assets.length,
            timestamp: new Date().toISOString()
        });
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
