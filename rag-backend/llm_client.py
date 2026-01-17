"""
LLM Client Module
Handles interaction with Ollama for text generation
"""

import requests
import json
from typing import Optional, Dict, Any, Generator
import os


class OllamaClient:
    """Client for Ollama LLM API"""

    def __init__(self,
                 base_url: str = "http://localhost:11434",
                 model: str = "llama3.2:3b",
                 timeout: int = 60):
        """
        Initialize Ollama client

        Args:
            base_url: Ollama API base URL
            model: Model name to use
                   Recommended models:
                   - llama3.2:3b (fast, good for stats)
                   - mistral:7b (better reasoning)
                   - phi3:mini (smallest, fastest)
            timeout: Request timeout in seconds
        """
        self.base_url = base_url.rstrip('/')
        self.model = model
        self.timeout = timeout

        # Test connection
        if not self.is_available():
            raise ConnectionError(
                f"Cannot connect to Ollama at {base_url}. "
                f"Make sure Ollama is running (try: ollama serve)"
            )

        # Check if model is available
        if not self.model_exists(model):
            raise ValueError(
                f"Model '{model}' not found. "
                f"Pull it with: ollama pull {model}"
            )

        print(f"✅ Connected to Ollama: {model} @ {base_url}")

    def is_available(self) -> bool:
        """Check if Ollama server is available"""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            return response.status_code == 200
        except:
            return False

    def model_exists(self, model_name: str) -> bool:
        """Check if a model is available"""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            if response.status_code == 200:
                models = response.json().get("models", [])
                return any(m["name"] == model_name for m in models)
            return False
        except:
            return False

    def generate(self,
                 prompt: str,
                 system_prompt: Optional[str] = None,
                 temperature: float = 0.7,
                 max_tokens: int = 512,
                 stream: bool = False) -> str:
        """
        Generate text completion

        Args:
            prompt: User prompt
            system_prompt: Optional system prompt
            temperature: Sampling temperature (0.0 = deterministic, 1.0 = creative)
            max_tokens: Maximum tokens to generate
            stream: Whether to stream response

        Returns:
            Generated text
        """
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": stream,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            }
        }

        if system_prompt:
            payload["system"] = system_prompt

        try:
            response = requests.post(
                f"{self.base_url}/api/generate",
                json=payload,
                timeout=self.timeout,
                stream=stream
            )
            response.raise_for_status()

            if stream:
                # Handle streaming response
                full_response = ""
                for line in response.iter_lines():
                    if line:
                        chunk = json.loads(line)
                        if "response" in chunk:
                            full_response += chunk["response"]
                        if chunk.get("done", False):
                            break
                return full_response
            else:
                # Handle non-streaming response
                result = response.json()
                return result.get("response", "")

        except requests.exceptions.Timeout:
            raise TimeoutError(f"Ollama request timed out after {self.timeout}s")
        except Exception as e:
            raise RuntimeError(f"Ollama generation failed: {e}")

    def chat(self,
             messages: list,
             temperature: float = 0.7,
             max_tokens: int = 512,
             stream: bool = False) -> str:
        """
        Chat completion with message history

        Args:
            messages: List of message dicts with 'role' and 'content'
                     Example: [{"role": "user", "content": "Hello"}]
            temperature: Sampling temperature
            max_tokens: Maximum tokens
            stream: Whether to stream response

        Returns:
            Generated response
        """
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": stream,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            }
        }

        try:
            response = requests.post(
                f"{self.base_url}/api/chat",
                json=payload,
                timeout=self.timeout,
                stream=stream
            )
            response.raise_for_status()

            if stream:
                full_response = ""
                for line in response.iter_lines():
                    if line:
                        chunk = json.loads(line)
                        if "message" in chunk and "content" in chunk["message"]:
                            full_response += chunk["message"]["content"]
                        if chunk.get("done", False):
                            break
                return full_response
            else:
                result = response.json()
                return result.get("message", {}).get("content", "")

        except requests.exceptions.Timeout:
            raise TimeoutError(f"Ollama request timed out after {self.timeout}s")
        except Exception as e:
            raise RuntimeError(f"Ollama chat failed: {e}")

    def generate_rag_response(self,
                              query: str,
                              context: str,
                              temperature: float = 0.5,
                              max_tokens: int = 400) -> str:
        """
        Generate RAG response using retrieved context

        Args:
            query: User question
            context: Retrieved context from vector database
            temperature: Lower for more factual responses
            max_tokens: Maximum response length

        Returns:
            Generated answer
        """
        system_prompt = """You are a helpful volleyball statistics assistant for RM Volley, a local volleyball organization with multiple teams across different age groups and divisions.

Your role is to answer questions about:
- Match results and schedules
- Team performance and statistics
- League standings
- Player statistics
- Historical data and trends

Guidelines:
- Base your answers ONLY on the provided context
- Be specific with numbers, dates, team names, and scores
- If the context doesn't contain enough information, say so clearly
- Use Italian team names and terms when appropriate
- Be concise but informative
- Format numbers and statistics clearly"""

        prompt = f"""Context from database:
{context}

User question: {query}

Answer the question based on the context provided above. Be specific and cite relevant details."""

        return self.generate(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=max_tokens
        )


# Singleton instance
_llm_client = None


def get_llm_client(model: str = None) -> OllamaClient:
    """
    Get or create singleton LLM client

    Args:
        model: Optional model name (uses env var or default if not provided)

    Returns:
        OllamaClient instance
    """
    global _llm_client

    if _llm_client is None:
        # Get configuration from environment or use defaults
        base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        model_name = model or os.getenv("OLLAMA_MODEL", "llama3.2:3b")

        _llm_client = OllamaClient(base_url=base_url, model=model_name)

    return _llm_client


if __name__ == "__main__":
    # Test Ollama client
    print("Testing OllamaClient...")

    try:
        client = OllamaClient()

        # Test simple generation
        print("\n🤖 Testing simple generation:")
        response = client.generate("What is volleyball?", max_tokens=100)
        print(f"Response: {response[:200]}...")

        # Test RAG-style response
        print("\n🏐 Testing RAG response:")
        context = """
        Match on 15/01/2026: RM VOLLEY #18 vs Team X. Final result: 3-2.
        Set scores: (25-20) (23-25) (25-18) (20-25) (15-10).
        RM VOLLEY #18 won 3-2 against Team X.
        """
        query = "How did RM VOLLEY #18 perform against Team X?"
        rag_response = client.generate_rag_response(query, context)
        print(f"Response: {rag_response}")

        print("\n✅ Ollama client test successful!")

    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("\nMake sure:")
        print("1. Ollama is installed and running")
        print("2. Model is pulled (e.g., ollama pull llama3.2:3b)")
