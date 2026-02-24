If you are asked to analyse failures in a test that creates session and gets stuck on tool call/result, you can dig further by 

GET on BUILD_URL/api/chat-sessions/id/state

Use BUILD_URL for the test run

Authorization: Bearer $TRIAGE_API_KEY (this is provided to you)

The output can be large, so use JSON parse to figure out the diagnosis economically.