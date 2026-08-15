
## Test your NocoDB connection (run in terminal)

curl -H "xc-token: nc_pat_xMVicz1gDYg6j5l7NjtuirIlacvicQenvNsowvGB" \
  https://app.nocodb.com/api/v2/tables/ma3r5v5bnaihyms/records?limit=2

Should return {"list":[]} or your rows.

## Test Gemini (after you get GEMINI_API_KEY from https://aistudio.google.com/app/apikey)

curl -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=YOUR_GEMINI_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "generationConfig": {"responseMimeType": "application/json"},
    "systemInstruction": {"parts": [{"text": "You are English teacher for Japanese learner. Return JSON {corrected_text, explanation_ja}"}]},
    "contents": [{"role": "user", "parts": [{"text": "I very like go to Shibuya. It was very fun!"}]}]
  }'

## Updated lib/nocodb.ts mapping for your table
Your table uses CreatedAt (system) as created_at, no Title column.
The code in this zip already handles that - it sends original_text, status, etc. and uses CreatedAt automatically.
No Title field needed.
