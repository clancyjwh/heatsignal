export default async function handler(req, res) {
    if (req.method === 'POST') {
        const { secret, data } = req.body;

        // Simple secret check (user should set this in Vercel env vars)
        if (secret !== process.env.MAKE_SECRET && process.env.NODE_ENV === 'production') {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // In a real app, we would save this to a database (e.g., Supabase)
        // For this demo/initial version, we'll just acknowledge the data
        console.log('Received analysis data:', data);

        return res.status(200).json({
            message: 'Analysis updated successfully',
            processedCount: data.length
        });
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
