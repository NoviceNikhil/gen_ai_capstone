import os
import openai
from pathlib import Path

def get_api_key() -> str:
    env_path = Path(__file__).resolve().parents[2] / "backend" / ".env"
    try:
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith("GROQ_API_KEY="):
                    return line.split("=", 1)[1].strip()
    except Exception:
        pass
    return os.environ.get("GROQ_API_KEY", "")

def test():
    api_key = get_api_key()
    print("API Key loaded (prefix):", api_key[:10] if api_key else "None")
    client = openai.OpenAI(
        base_url="https://api.groq.com/openai/v1",
        api_key=api_key
    )
    try:
        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=10
        )
        print("Success! Response:", resp.choices[0].message.content)
    except Exception as e:
        print("Error details:", e)

if __name__ == "__main__":
    test()
