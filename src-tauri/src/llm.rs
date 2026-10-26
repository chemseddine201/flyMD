use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

pub fn system_translation_prompt(target_language: &str) -> String {
    format!(
        "You are an expert technical translator. Translate the given Markdown text into {}.\n\
        STRICT RULES:\n\
        1. Preserve all Markdown structure, syntax, headers (#, ##), bold (**), italic (*), code blocks (```), inline code (`), blockquotes (>), lists (- / 1.), and tables (|---|) exactly.\n\
        2. DO NOT translate code identifiers, URLs, programming code, KaTeX math blocks ($...$ or $$...$$), or HTML tags.\n\
        3. Output ONLY the translated Markdown content. Do not include any greeting, preamble, explanations, or conversational filler.",
        target_language
    )
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LLMConfig {
    pub provider: String,
    #[serde(rename = "endpointUrl")]
    pub endpoint_url: String,
    #[serde(rename = "apiKey")]
    pub api_key: Option<String>,
    #[serde(default)]
    pub model: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct OllamaModelDetails {
    pub family: Option<String>,
    pub parameter_size: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct OllamaModel {
    pub name: String,
    pub modified_at: Option<String>,
    pub size: Option<u64>,
    pub digest: Option<String>,
    pub details: Option<OllamaModelDetails>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LlmTestConnectionResult {
    pub success: bool,
    pub message: String,
    pub models: Option<Vec<OllamaModel>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LlmGetModelsResult {
    pub success: bool,
    pub models: Vec<OllamaModel>,
    pub error: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TranslationRequest {
    pub text: String,
    #[serde(rename = "targetLanguage")]
    pub target_language: String,
    pub model: Option<String>,
    pub config: Option<LLMConfig>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TranslationDoneEvent {
    pub success: bool,
    pub text: Option<String>,
    pub error: Option<String>,
}

pub struct LlmManager {
    pub cancel_flag: Arc<AtomicBool>,
    client: reqwest::Client,
}

impl LlmManager {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(120))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());

        Self {
            cancel_flag: Arc::new(AtomicBool::new(false)),
            client,
        }
    }
}

pub type SharedLlmManager = Arc<LlmManager>;

fn normalize_base_url(endpoint: &str) -> String {
    let mut base = endpoint.trim().trim_end_matches('/').to_string();
    if !base.starts_with("http://") && !base.starts_with("https://") {
        base = format!("http://{}", base);
    }
    base
}

fn normalize_chat_url(endpoint: &str) -> String {
    let base = normalize_base_url(endpoint);
    if base.ends_with("/chat/completions") {
        base
    } else {
        format!("{}/chat/completions", base)
    }
}

#[tauri::command]
pub async fn cmd_llm_test_connection(
    config: LLMConfig,
    llm: tauri::State<'_, SharedLlmManager>,
) -> Result<LlmTestConnectionResult, String> {
    let base_url = normalize_base_url(&config.endpoint_url);

    if config.provider == "ollama" {
        let tags_url = format!("{}/api/tags", base_url);
        let res = llm.client.get(&tags_url).send().await;

        match res {
            Ok(resp) => {
                if resp.status().is_success() {
                    #[derive(Deserialize)]
                    struct OllamaTagsResponse {
                        models: Option<Vec<OllamaModel>>,
                    }

                    if let Ok(data) = resp.json::<OllamaTagsResponse>().await {
                        let models = data.models.unwrap_or_default();
                        Ok(LlmTestConnectionResult {
                            success: true,
                            message: format!("Connected to Ollama! Found {} model(s).", models.len()),
                            models: Some(models),
                        })
                    } else {
                        Ok(LlmTestConnectionResult {
                            success: true,
                            message: "Connected to Ollama successfully!".to_string(),
                            models: Some(Vec::new()),
                        })
                    }
                } else {
                    Ok(LlmTestConnectionResult {
                        success: false,
                        message: format!("Ollama returned HTTP status {}", resp.status()),
                        models: None,
                    })
                }
            }
            Err(e) => Ok(LlmTestConnectionResult {
                success: false,
                message: format!("Failed to connect to Ollama at {}: {}", base_url, e),
                models: None,
            }),
        }
    } else {
        // OpenAI / OpenAI-compatible
        let models_url = if base_url.ends_with("/v1") {
            format!("{}/models", base_url)
        } else {
            format!("{}/v1/models", base_url)
        };

        let mut req_builder = llm.client.get(&models_url);
        if let Some(key) = &config.api_key {
            let trimmed = key.trim();
            if !trimmed.is_empty() {
                req_builder = req_builder.header("Authorization", format!("Bearer {}", trimmed));
            }
        }

        if let Ok(resp) = req_builder.send().await {
            if resp.status().is_success() {
                #[derive(Deserialize)]
                struct OpenAiModelItem {
                    id: Option<String>,
                    name: Option<String>,
                }
                #[derive(Deserialize)]
                struct OpenAiModelsResponse {
                    data: Option<Vec<OpenAiModelItem>>,
                }

                if let Ok(body) = resp.json::<OpenAiModelsResponse>().await {
                    let mut list = Vec::new();
                    if let Some(items) = body.data {
                        for item in items {
                            let name = item.id.or(item.name).unwrap_or_default();
                            if !name.is_empty() {
                                list.push(OllamaModel {
                                    name,
                                    modified_at: None,
                                    size: None,
                                    digest: None,
                                    details: None,
                                });
                            }
                        }
                    }
                    return Ok(LlmTestConnectionResult {
                        success: true,
                        message: format!("Connected successfully! Found {} model(s).", list.len()),
                        models: Some(list),
                    });
                }
            }
        }

        // Fallback: ping chat completions with max_tokens: 1
        let chat_url = normalize_chat_url(&config.endpoint_url);
        let mut chat_req = llm.client.post(&chat_url).header("Content-Type", "application/json");

        if let Some(key) = &config.api_key {
            let trimmed = key.trim();
            if !trimmed.is_empty() {
                chat_req = chat_req.header("Authorization", format!("Bearer {}", trimmed));
            }
        }

        let model_name = if config.model.trim().is_empty() {
            "gpt-4o-mini"
        } else {
            config.model.trim()
        };

        let body = serde_json::json!({
            "model": model_name,
            "messages": [{ "role": "user", "content": "ping" }],
            "max_tokens": 1
        });

        match chat_req.json(&body).send().await {
            Ok(resp) => {
                let status = resp.status();
                if status.is_success() || status.as_u16() == 400 {
                    Ok(LlmTestConnectionResult {
                        success: true,
                        message: format!("Connected to {} server successfully!", config.provider),
                        models: None,
                    })
                } else if status.as_u16() == 401 || status.as_u16() == 403 {
                    Ok(LlmTestConnectionResult {
                        success: false,
                        message: format!("Authentication failed (HTTP {}): Invalid API Key.", status),
                        models: None,
                    })
                } else {
                    Ok(LlmTestConnectionResult {
                        success: false,
                        message: format!("Server responded with HTTP {}", status),
                        models: None,
                    })
                }
            }
            Err(e) => Ok(LlmTestConnectionResult {
                success: false,
                message: format!("Failed to connect to server: {}", e),
                models: None,
            }),
        }
    }
}

#[tauri::command]
pub async fn cmd_llm_get_models(
    config: LLMConfig,
    llm: tauri::State<'_, SharedLlmManager>,
) -> Result<LlmGetModelsResult, String> {
    let base_url = normalize_base_url(&config.endpoint_url);

    if config.provider == "ollama" {
        let tags_url = format!("{}/api/tags", base_url);
        match llm.client.get(&tags_url).send().await {
            Ok(resp) => {
                let status = resp.status();
                if status.is_success() {
                    #[derive(Deserialize)]
                    struct OllamaTagsResponse {
                        models: Option<Vec<OllamaModel>>,
                    }
                    if let Ok(data) = resp.json::<OllamaTagsResponse>().await {
                        return Ok(LlmGetModelsResult {
                            success: true,
                            models: data.models.unwrap_or_default(),
                            error: None,
                        });
                    }
                }
                Ok(LlmGetModelsResult {
                    success: false,
                    models: Vec::new(),
                    error: Some(format!("Ollama returned status {}", status)),
                })
            }
            Err(e) => Ok(LlmGetModelsResult {
                success: false,
                models: Vec::new(),
                error: Some(e.to_string()),
            }),
        }
    } else {
        let models_url = if base_url.ends_with("/v1") {
            format!("{}/models", base_url)
        } else {
            format!("{}/v1/models", base_url)
        };

        let mut req_builder = llm.client.get(&models_url);
        if let Some(key) = &config.api_key {
            let trimmed = key.trim();
            if !trimmed.is_empty() {
                req_builder = req_builder.header("Authorization", format!("Bearer {}", trimmed));
            }
        }

        match req_builder.send().await {
            Ok(resp) => {
                let status = resp.status();
                if status.is_success() {
                    #[derive(Deserialize)]
                    struct OpenAiModelItem {
                        id: Option<String>,
                        name: Option<String>,
                    }
                    #[derive(Deserialize)]
                    struct OpenAiModelsResponse {
                        data: Option<Vec<OpenAiModelItem>>,
                    }

                    if let Ok(body) = resp.json::<OpenAiModelsResponse>().await {
                        let mut list = Vec::new();
                        if let Some(items) = body.data {
                            for item in items {
                                let name = item.id.or(item.name).unwrap_or_default();
                                if !name.is_empty() {
                                    list.push(OllamaModel {
                                        name,
                                        modified_at: None,
                                        size: None,
                                        digest: None,
                                        details: None,
                                    });
                                }
                            }
                        }
                        return Ok(LlmGetModelsResult {
                            success: true,
                            models: list,
                            error: None,
                        });
                    }
                }
                Ok(LlmGetModelsResult {
                    success: false,
                    models: Vec::new(),
                    error: Some(format!("Server returned HTTP {}", status)),
                })
            }
            Err(e) => Ok(LlmGetModelsResult {
                success: false,
                models: Vec::new(),
                error: Some(e.to_string()),
            }),
        }
    }
}

#[tauri::command]
pub async fn cmd_llm_start_translation(
    app: AppHandle,
    req: TranslationRequest,
    llm: tauri::State<'_, SharedLlmManager>,
) -> Result<(), String> {
    llm.cancel_flag.store(false, Ordering::SeqCst);
    let cancel_flag = Arc::clone(&llm.cancel_flag);
    let client = llm.client.clone();
    let app_clone = app.clone();

    tauri::async_runtime::spawn(async move {
        let config = req.config.unwrap_or(LLMConfig {
            provider: "ollama".to_string(),
            endpoint_url: "http://127.0.0.1:11434".to_string(),
            api_key: None,
            model: "qwen2.5:3b".to_string(),
        });

        let model = req.model.unwrap_or_else(|| {
            if config.model.is_empty() {
                "qwen2.5:3b".to_string()
            } else {
                config.model.clone()
            }
        });

        let system_prompt = system_translation_prompt(&req.target_language);
        let mut full_text = String::new();

        if config.provider == "ollama" {
            let url = format!("{}/api/generate", normalize_base_url(&config.endpoint_url));
            let body = serde_json::json!({
                "model": model,
                "prompt": req.text,
                "system": system_prompt,
                "stream": true,
                "options": {
                    "temperature": 0.2
                }
            });

            let resp = client.post(&url).json(&body).send().await;
            match resp {
                Ok(response) => {
                    if !response.status().is_success() {
                        let err_text = response.text().await.unwrap_or_default();
                        app_clone.emit("llm:translate:done", TranslationDoneEvent {
                            success: false,
                            text: None,
                            error: Some(format!("Ollama error: {}", err_text)),
                        }).ok();
                        return;
                    }

                    let mut stream = response.bytes_stream();
                    let mut buffer = String::new();

                    while let Some(chunk_res) = stream.next().await {
                        if cancel_flag.load(Ordering::SeqCst) {
                            app_clone.emit("llm:translate:done", TranslationDoneEvent {
                                success: false,
                                text: Some(full_text),
                                error: Some("Translation aborted by user".to_string()),
                            }).ok();
                            return;
                        }

                        if let Ok(bytes) = chunk_res {
                            buffer.push_str(&String::from_utf8_lossy(&bytes));

                            while let Some(pos) = buffer.find('\n') {
                                let line = buffer[..pos].trim().to_string();
                                buffer = buffer[pos + 1..].to_string();

                                if line.is_empty() {
                                    continue;
                                }

                                #[derive(Deserialize)]
                                struct OllamaChunk {
                                    response: Option<String>,
                                    done: Option<bool>,
                                }

                                if let Ok(chunk) = serde_json::from_str::<OllamaChunk>(&line) {
                                    if let Some(text) = chunk.response {
                                        if !text.is_empty() {
                                            full_text.push_str(&text);
                                            app_clone.emit("llm:translate:chunk", &text).ok();
                                        }
                                    }
                                    if chunk.done.unwrap_or(false) {
                                        break;
                                    }
                                }
                            }
                        }
                    }

                    app_clone.emit("llm:translate:done", TranslationDoneEvent {
                        success: true,
                        text: Some(full_text),
                        error: None,
                    }).ok();
                }
                Err(e) => {
                    app_clone.emit("llm:translate:done", TranslationDoneEvent {
                        success: false,
                        text: None,
                        error: Some(e.to_string()),
                    }).ok();
                }
            }
        } else {
            // OpenAI / OpenAI-compatible
            let chat_url = normalize_chat_url(&config.endpoint_url);
            let mut req_builder = client.post(&chat_url).header("Content-Type", "application/json");

            if let Some(key) = &config.api_key {
                let trimmed = key.trim();
                if !trimmed.is_empty() {
                    req_builder = req_builder.header("Authorization", format!("Bearer {}", trimmed));
                }
            }

            let body = serde_json::json!({
                "model": model,
                "messages": [
                    { "role": "system", "content": system_prompt },
                    { "role": "user", "content": req.text }
                ],
                "stream": true,
                "temperature": 0.2
            });

            let resp = req_builder.json(&body).send().await;
            match resp {
                Ok(response) => {
                    if !response.status().is_success() {
                        let err_text = response.text().await.unwrap_or_default();
                        app_clone.emit("llm:translate:done", TranslationDoneEvent {
                            success: false,
                            text: None,
                            error: Some(format!("Provider error: {}", err_text)),
                        }).ok();
                        return;
                    }

                    let mut stream = response.bytes_stream();
                    let mut buffer = String::new();

                    while let Some(chunk_res) = stream.next().await {
                        if cancel_flag.load(Ordering::SeqCst) {
                            app_clone.emit("llm:translate:done", TranslationDoneEvent {
                                success: false,
                                text: Some(full_text),
                                error: Some("Translation aborted by user".to_string()),
                            }).ok();
                            return;
                        }

                        if let Ok(bytes) = chunk_res {
                            buffer.push_str(&String::from_utf8_lossy(&bytes));

                            while let Some(pos) = buffer.find('\n') {
                                let line = buffer[..pos].trim().to_string();
                                buffer = buffer[pos + 1..].to_string();

                                if line.is_empty() {
                                    continue;
                                }

                                if line.starts_with("data: ") {
                                    let data_str = line[6..].trim();
                                    if data_str == "[DONE]" {
                                        break;
                                    }

                                    #[derive(Deserialize)]
                                    struct OpenAiDelta {
                                        content: Option<String>,
                                    }
                                    #[derive(Deserialize)]
                                    struct OpenAiChoice {
                                        delta: Option<OpenAiDelta>,
                                    }
                                    #[derive(Deserialize)]
                                    struct OpenAiStreamResponse {
                                        choices: Option<Vec<OpenAiChoice>>,
                                    }

                                    if let Ok(data) = serde_json::from_str::<OpenAiStreamResponse>(data_str) {
                                        if let Some(choices) = data.choices {
                                            if let Some(first) = choices.first() {
                                                if let Some(delta) = &first.delta {
                                                    if let Some(content) = &delta.content {
                                                        if !content.is_empty() {
                                                            full_text.push_str(content);
                                                            app_clone.emit("llm:translate:chunk", content).ok();
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    app_clone.emit("llm:translate:done", TranslationDoneEvent {
                        success: true,
                        text: Some(full_text),
                        error: None,
                    }).ok();
                }
                Err(e) => {
                    app_clone.emit("llm:translate:done", TranslationDoneEvent {
                        success: false,
                        text: None,
                        error: Some(e.to_string()),
                    }).ok();
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn cmd_llm_abort_translation(
    llm: tauri::State<'_, SharedLlmManager>,
) -> Result<(), String> {
    llm.cancel_flag.store(true, Ordering::SeqCst);
    Ok(())
}
