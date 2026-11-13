import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function openAiCoachPlugin() {
  return {
    name: 'openai-coach-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/coach' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              const env = loadEnv('development', process.cwd(), '');
              const apiKey = process.env.OPENAI_API_KEY || env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY;

              if (!apiKey) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'OpenAI API key not configured on server' }));
                return;
              }

              const data = JSON.parse(body || '{}');
              const { exercise, valid_reps, invalid_reps, average_angle, body_alignment, errors = [], promptType = 'summary' } = data;

              let systemPrompt = "You are FormFit's elite AI movement biomechanist and Olympic strength coach. You analyze real-time exercise telemetry from MediaPipe computer vision. Give concise, encouraging, and anatomically precise guidance.";
              let userPrompt = "";

              if (promptType === 'live') {
                userPrompt = `User is performing ${exercise}. Currently at ${valid_reps} valid reps, ${invalid_reps} invalid reps. Observed issues: ${errors.join(', ') || 'Clean execution'}. Give 1 sharp, actionable coaching cue in under 12 words.`;
              } else {
                userPrompt = `Generate a concise post-workout biomechanical assessment:
- Exercise: ${exercise}
- Valid Repetitions: ${valid_reps}
- Invalid / Incomplete Repetitions: ${invalid_reps}
- Average Primary Joint Angle: ${average_angle || 90}°
- Average Body Alignment: ${body_alignment || 170}°
- Detected Faults: ${errors.length > 0 ? errors.join(', ') : 'None, pristine alignment'}

Provide:
1. Executive Form Assessment (2 sentences)
2. Biomechanical Strengths observed (2 bullet points)
3. Priority Improvement Cue (1 actionable sentence)
Keep the tone encouraging, calm, and professional.`;
              }

              const openAiRes = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                  model: 'gpt-4o-mini',
                  messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                  ],
                  temperature: 0.6,
                  max_tokens: 350
                })
              });

              if (!openAiRes.ok) {
                const errText = await openAiRes.text();
                res.writeHead(openAiRes.status, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'OpenAI upstream error', details: errText }));
                return;
              }

              const json = await openAiRes.json();
              const feedback = json.choices?.[0]?.message?.content || 'Session completed with steady form.';

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ feedback, model: json.model }));
            } catch (err) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }
        next();
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), openAiCoachPlugin()],
  server: {
    port: 5173,
    host: true
  }
});
