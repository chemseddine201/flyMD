//! Stream line decoders for LLM providers (OpenAI SSE, Ollama NDJSON).

/// One parsed streaming delta from an HTTP LLM endpoint.
#[derive(Debug, Default, PartialEq, Clone)]
pub struct StreamDelta {
    pub content: Option<String>,
    pub reasoning: Option<String>,
    pub prompt_tokens: Option<u32>,
    pub completion_tokens: Option<u32>,
    pub cache_read_tokens: Option<u64>,
}

/// Parses an OpenAI-compatible SSE line. Supports `reasoning_content` (DeepSeek)
/// and `reasoning` (OpenRouter-style) deltas plus a trailing `usage` object.
pub fn parse_openai_sse_line(line: &str) -> Option<StreamDelta> {
    let payload = line.strip_prefix("data:")?.trim();
    if payload.is_empty() || payload == "[DONE]" {
        return None;
    }
    let v: serde_json::Value = serde_json::from_str(payload).ok()?;
    let delta = v.pointer("/choices/0/delta");
    let get_str = |key: &str| {
        delta
            .and_then(|d| d.get(key))
            .and_then(|x| x.as_str())
            .map(|s| s.to_string())
    };
    let usage = v.get("usage");
    let get_u32 = |key: &str| {
        usage
            .and_then(|u| u.get(key))
            .and_then(|x| x.as_u64())
            .map(|n| n as u32)
    };
    let cache_read = usage
        .and_then(|u| {
            u.pointer("/prompt_tokens_details/cached_tokens")
                .or_else(|| u.get("cached_tokens"))
        })
        .and_then(|x| x.as_u64());

    Some(StreamDelta {
        content: get_str("content"),
        reasoning: get_str("reasoning_content").or_else(|| get_str("reasoning")),
        prompt_tokens: get_u32("prompt_tokens"),
        completion_tokens: get_u32("completion_tokens"),
        cache_read_tokens: cache_read,
    })
}

/// Parses an Ollama `/api/chat` NDJSON line (`message.thinking` on newer builds,
/// `<think>` tags in `message.content` on older builds are handled by the splitter).
pub fn parse_ollama_line(line: &str) -> Option<StreamDelta> {
    let v: serde_json::Value = serde_json::from_str(line).ok()?;
    if let Some(err) = v.get("error").and_then(|e| e.as_str()) {
        return Some(StreamDelta {
            content: Some(format!("\n\n> Ollama error: {}\n", err)),
            ..Default::default()
        });
    }
    let msg = v.get("message");
    let get_str = |key: &str| {
        msg.and_then(|m| m.get(key))
            .and_then(|x| x.as_str())
            .map(|s| s.to_string())
    };
    let get_u32 = |key: &str| v.get(key).and_then(|x| x.as_u64()).map(|n| n as u32);
    Some(StreamDelta {
        content: get_str("content").or_else(|| {
            v.get("response").and_then(|x| x.as_str()).map(|s| s.to_string())
        }),
        reasoning: get_str("thinking"),
        prompt_tokens: get_u32("prompt_eval_count"),
        completion_tokens: get_u32("eval_count"),
        cache_read_tokens: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_openai_sse_line() {
        let line = "data: {\"choices\":[{\"delta\":{\"content\":\"hello \",\"reasoning_content\":\"thinking\"}}]}";
        let delta = parse_openai_sse_line(line).unwrap();
        assert_eq!(delta.content.as_deref(), Some("hello "));
        assert_eq!(delta.reasoning.as_deref(), Some("thinking"));

        assert!(parse_openai_sse_line("data: [DONE]").is_none());
        assert!(parse_openai_sse_line("heartbeat").is_none());
    }

    #[test]
    fn test_parse_ollama_line() {
        let line = "{\"message\":{\"role\":\"assistant\",\"content\":\"hello\",\"thinking\":\"plan\"}}";
        let delta = parse_ollama_line(line).unwrap();
        assert_eq!(delta.content.as_deref(), Some("hello"));
        assert_eq!(delta.reasoning.as_deref(), Some("plan"));
    }
}
