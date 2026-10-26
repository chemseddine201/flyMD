export const MD_EXTENSIONS = ['md', 'markdown', 'mdown', 'txt'] as const;

export const MD_REGEX = /\.(md|markdown|mdown|txt)$/i;

export const DEFAULT_WELCOME_MD = `# Welcome to FlyMD 🪶

Drop any Markdown file onto the floating circle or select a project folder to supervise!

## Features
- 🚀 **On-the-fly preview & editing**
- 📂 **Project folder tree supervision & auto-open**
- 🌐 **Multi-provider AI translation (Ollama, OpenAI, Groq, OpenRouter, vLLM)**
- 📊 **KaTeX math & Mermaid charts**
- 📌 **Always-on-top floating hub**

\`\`\`python
def fly_md():
    print("Hello from FlyMD with Multi-Tabs & Folder Supervision!")
\`\`\`
`;

