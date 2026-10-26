import { OllamaService } from '../src/main/ollama.ts';

async function testOllama() {
  console.log('Testing local Ollama connection...');
  const svc = new OllamaService();
  const modelRes = await svc.getModels();

  if (!modelRes.success) {
    console.error('Ollama connection test failed:', modelRes.error);
    process.exit(1);
  }

  console.log(`Found ${modelRes.models.length} local models:`, modelRes.models.map(m => m.name).join(', '));
  const testModel = modelRes.models.find(m => m.name.includes('qwen2.5:1.5b'))?.name || modelRes.models[0].name;
  console.log(`Using model "${testModel}" for Markdown translation test...`);

  const sampleMarkdown = `# Overview\n\nFlyMD is a **fast** and *sleek* markdown viewer.\n\n- Feature 1: Drop zone\n- Feature 2: Local AI translation`;

  console.log('Translating sample Markdown to French...');
  let streamed = '';
  const result = await svc.translate(
    {
      text: sampleMarkdown,
      targetLanguage: 'French',
      model: testModel,
    },
    'http://127.0.0.1:11434',
    (chunk) => {
      streamed += chunk;
      process.stdout.write(chunk);
    }
  );

  console.log('\n--- Translation Finished ---');
  if (result.success && streamed.trim().length > 0) {
    console.log('Ollama translation verified successfully!');
    process.exit(0);
  } else {
    console.error('Translation failed:', result.error);
    process.exit(1);
  }
}

testOllama();
