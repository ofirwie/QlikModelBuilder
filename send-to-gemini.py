import json
import requests

API_KEY = "AIzaSyANbBIMoqUyYAIlM0YgJkmFPLWw4ivRkm4"
URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key={API_KEY}"

# Read the plan file
with open("docs/plans/2026-01-22-qlikfox-merge-plan.md", "r", encoding="utf-8") as f:
    plan_content = f.read()

prompt = f"""You are a senior DevOps engineer reviewing a Git branch merge plan.

Review the following COMPLETE implementation plan and provide a score from 0-100.

## Review Criteria:
1. Completeness - Does the plan cover all merge steps?
2. Safety - Are there proper rollback procedures?
3. Best Practices - Does it follow Git best practices?
4. Verification - Are there proper verification steps?
5. Risk Management - Are risks identified and mitigated?
6. Clarity - Is the plan clear and unambiguous?

## FULL IMPLEMENTATION PLAN:

{plan_content}

## Required Response Format (JSON only):
{{
  "score": <number 0-100>,
  "summary": "<brief assessment>",
  "issues": [
    {{
      "severity": "critical|warning|info",
      "category": "<category>",
      "description": "<issue description>",
      "suggestion": "<fix suggestion>"
    }}
  ],
  "strengths": ["<strength 1>", "<strength 2>"],
  "approved": <boolean - true if score >= 100>
}}"""

body = {
    "contents": [{"parts": [{"text": prompt}]}],
    "generationConfig": {"temperature": 0.2, "maxOutputTokens": 8192}
}

response = requests.post(URL, json=body, headers={"Content-Type": "application/json"})

if response.status_code == 200:
    result = response.json()
    try:
        print(result["candidates"][0]["content"]["parts"][0]["text"])
    except (KeyError, IndexError) as e:
        print(f"Response structure error: {e}")
        print(json.dumps(result, indent=2))
else:
    print(f"Error {response.status_code}: {response.text}")
