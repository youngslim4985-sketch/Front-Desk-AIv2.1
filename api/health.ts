export default function handler(req: any, res: any) {
  return res.status(200).json({
    status: 'ok',
    source: 'standalone-vercel-function',
    time: new Date().toISOString()
  });
}
