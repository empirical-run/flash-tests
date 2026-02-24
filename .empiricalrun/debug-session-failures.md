If you are asked to analyse failures in a test that creates session and gets stuck on tool call/result, you can dig further by 

GET on BUILD_URL/api/chat-sessions/id/state

Use BUILD_URL for the test run

Authorization: Bearer $TRIAGE_API_KEY (this is provided to you)

The output can be large, so use JSON parse to figure out the diagnosis economically.

## Response payload structure

```
{
  "data": {
    "chat_state": {
      "version": "0.1",
      "model": "...",
      "askUserForInput": true,   // true = session is idle/done, false = still processing
      "error": null,
      "messages": [ ... ]
    }
  }
}
```

### Message types in `chat_state.messages`

Each message has: `id`, `role` (`user` | `assistant` | `tool`), `timestamp`, `parts[]`.

**User message** (`role: "user"`):
```json
{
  "id": 1, "role": "user", "timestamp": "...",
  "parts": [{ "text": "what's the commit sha..." }]
}
```

**Assistant message** (`role: "assistant"`):
```json
{
  "id": 2, "role": "assistant", "timestamp": "...",
  "parts": [
    { "text": "...", "thinking": true, "signature": "..." },  // thinking block
    { "toolCall": { "name": "safeBash", "id": "toolu_01Ad89...", "input": { "script": "git rev-parse HEAD" } } }
  ]
}
```

**Tool result message** (`role: "tool"`):
```json
{
  "id": 3, "role": "tool", "timestamp": "...",
  "parts": [
    {
      "toolCallId": "toolu_01Ad89...",   // ⚠️ sibling key on the part, NOT nested inside toolResult
      "toolName": "safeBash",
      "toolResult": {
        "result": "b028df844e4ffb38d1cfeba6cdb4432de556cffc",
        "isError": false
      }
    }
  ]
}
```

> ⚠️ **Important**: `toolCallId` is a **sibling key on the part object**, not nested inside `toolResult`. 
> Accessing `part['toolResult']['toolCallId']` will fail — use `part['toolCallId']` instead.

### How to detect a stuck tool call

Compare timestamps between the assistant message (tool call) and the subsequent tool message (tool result):

```python
# Tool call started at: message[role=assistant].timestamp (when toolCall part appears)
# Tool result arrived at: message[role=tool].timestamp
# Duration = tool_result.timestamp - tool_call.timestamp
```

If `askUserForInput` is `true` but the test timed out, the tool did eventually complete — 
the issue is that it took longer than the test's `toBeVisible` timeout (commonly 60 seconds).
