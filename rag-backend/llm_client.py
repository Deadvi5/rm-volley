"""
LLM Client Module
Handles interaction with LLM providers (Ollama local or Groq cloud)
"""

import requests
from typing import Optional
from datetime import datetime
import os
from abc import ABC, abstractmethod


class BaseLLMClient(ABC):
    """Abstract base class for LLM clients"""

    def __init__(self, model: str, timeout: int = 60):
        self.model = model
        self.timeout = timeout

    @abstractmethod
    def is_available(self) -> bool:
        """Check if the LLM service is available"""
        pass

    @abstractmethod
    def generate(self,
                 prompt: str,
                 system_prompt: Optional[str] = None,
                 temperature: float = 0.7,
                 max_tokens: int = 512) -> str:
        """Generate text completion"""
        pass

    def _get_today_date(self) -> str:
        """Get today's date in Italian format"""
        return datetime.now().strftime("%d/%m/%Y")

    def _get_system_prompt(self) -> str:
        """Get the RAG system prompt"""
        return f"""Sei un assistente di statistiche di pallavolo per RM Volley, un'organizzazione sportiva locale con diverse squadre divise per fasce d'età.

DATA ODIERNA: {self._get_today_date()}

CRITICO - DISTINZIONE TEMPORALE:
- Se lo stato della partita è "da giocare" o "da disputare" → la partita è nel FUTURO, NON è ancora stata giocata
- Se la partita ha un risultato (es. "3-1", "3-0") → la partita è già stata giocata (PASSATO)
- NON inventare risultati per partite future
- Se ti chiedono "l'ultima partita" o "com'è andata", cerca SOLO partite GIÀ GIOCATE (con risultato)
- Se ti chiedono "la prossima partita", cerca SOLO partite DA GIOCARE

CRITICO - DISTINZIONE SQUADRE (NON CONFONDERLE MAI):
- "RM VOLLEY PIACENZA" = squadra SERIE D FEMMINILE (adulte) - gioca nel campionato "DF Gir. A"
- "RMVOLLEY#18" = squadra UNDER 18 FEMMINILE (giovanile) - gioca nel campionato "UNDER 18 FEMMINILE"
- "RMVOLLEY#16" = squadra UNDER 16 FEMMINILE
- "RMVOLLEY#14" o "RMVOLLEY#13/14/15" = squadre UNDER 14 FEMMINILE
- "RMVOLLEY#2" = squadra SECONDA DIVISIONE FEMMINILE

QUESTE SONO SQUADRE DIVERSE! Se l'utente chiede di "RM VOLLEY PIACENZA", NON rispondere con informazioni su "RMVOLLEY#18" e viceversa.

Il tuo ruolo è rispondere a domande su:
- Risultati delle partite (SOLO quelle già giocate)
- Calendari e prossime partite (quelle da giocare)
- Classifiche dei campionati
- Statistiche delle squadre

Linee guida:
- Rispondi SOLO in base al contesto fornito - NON INVENTARE MAI dati
- VERIFICA SEMPRE che la squadra nel contesto corrisponda a quella richiesta dall'utente
- Sii specifico con numeri, date, nomi delle squadre e punteggi
- Se il contesto non contiene informazioni sulla squadra richiesta, dillo chiaramente
- Rispondi sempre in italiano
- Sii conciso ma informativo

CRITICO - COSA NON PUOI FARE:
- NON puoi fare PREVISIONI su chi vincerà una partita futura
- NON puoi inventare classifiche o posizioni non presenti nel contesto
- NON puoi mescolare dati di squadre diverse
- Se ti chiedono "chi vincerà?" rispondi: "Non posso fare previsioni sui risultati futuri. Posso solo fornirti statistiche storiche e informazioni sulle prossime partite."
- Se non hai dati sufficienti, ammettilo invece di inventare"""

    def _get_rag_prompt(self, query: str, context: str) -> str:
        """Get the RAG user prompt"""
        return f"""Contesto dal database:
{context}

Domanda dell'utente: {query}

ISTRUZIONI CRITICHE PER LE CLASSIFICHE:
- Se il contesto contiene una classifica, COPIA l'ordine ESATTO dal contesto
- La posizione 1 nel contesto = primo posto in classifica (la squadra con più punti)
- La posizione 2 nel contesto = secondo posto in classifica
- NON riordinare le squadre in base al nome - mantieni l'ordine numerico esatto
- RM VOLLEY PIACENZA potrebbe NON essere prima in classifica - mostra la posizione reale

ISTRUZIONI CRITICHE PER LE PARTITE:
1. Se ti chiedono "la prossima partita" → rispondi con la PRIMA partita nell'elenco (è la più vicina)
2. Se ti chiedono "l'ultima partita" → rispondi con la PRIMA partita con risultato nell'elenco (è la più recente)
3. NON confondere RM VOLLEY PIACENZA (Serie D) con RMVOLLEY#18 (Under 18)

Rispondi alla domanda copiando fedelmente i dati dal contesto:"""

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
        return self.generate(
            prompt=self._get_rag_prompt(query, context),
            system_prompt=self._get_system_prompt(),
            temperature=temperature,
            max_tokens=max_tokens
        )


class OllamaClient(BaseLLMClient):
    """Client for Ollama LLM API (local)"""

    def __init__(self,
                 base_url: str = "http://localhost:11434",
                 model: str = "llama3.2:3b",
                 timeout: int = 60):
        super().__init__(model, timeout)
        self.base_url = base_url.rstrip('/')

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
                 max_tokens: int = 512) -> str:
        """Generate text completion using Ollama"""
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
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
                timeout=self.timeout
            )
            response.raise_for_status()
            result = response.json()
            return result.get("response", "")

        except requests.exceptions.Timeout:
            raise TimeoutError(f"Ollama request timed out after {self.timeout}s")
        except Exception as e:
            raise RuntimeError(f"Ollama generation failed: {e}")


class GroqClient(BaseLLMClient):
    """Client for Groq LLM API (cloud)"""

    GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

    # Available Groq models (as of 2024)
    AVAILABLE_MODELS = [
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant",
        "llama3-70b-8192",
        "llama3-8b-8192",
        "mixtral-8x7b-32768",
        "gemma2-9b-it",
    ]

    def __init__(self,
                 api_key: str,
                 model: str = "llama-3.3-70b-versatile",
                 timeout: int = 60):
        super().__init__(model, timeout)
        self.api_key = api_key

        if not api_key:
            raise ValueError(
                "Groq API key is required. "
                "Get one at https://console.groq.com/keys and set GROQ_API_KEY in .env"
            )

        # Test connection
        if not self.is_available():
            raise ConnectionError(
                "Cannot connect to Groq API. Check your API key and internet connection."
            )

        print(f"✅ Connected to Groq: {model}")

    def is_available(self) -> bool:
        """Check if Groq API is available"""
        try:
            # Make a minimal request to check connectivity
            response = requests.get(
                "https://api.groq.com/openai/v1/models",
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=10
            )
            return response.status_code == 200
        except:
            return False

    def generate(self,
                 prompt: str,
                 system_prompt: Optional[str] = None,
                 temperature: float = 0.7,
                 max_tokens: int = 512) -> str:
        """Generate text completion using Groq"""
        messages = []

        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})

        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        try:
            response = requests.post(
                self.GROQ_API_URL,
                json=payload,
                headers=headers,
                timeout=self.timeout
            )
            response.raise_for_status()
            result = response.json()
            return result["choices"][0]["message"]["content"]

        except requests.exceptions.Timeout:
            raise TimeoutError(f"Groq request timed out after {self.timeout}s")
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 401:
                raise ValueError("Invalid Groq API key")
            elif e.response.status_code == 429:
                raise RuntimeError("Groq rate limit exceeded. Please wait and try again.")
            else:
                raise RuntimeError(f"Groq API error: {e.response.text}")
        except Exception as e:
            raise RuntimeError(f"Groq generation failed: {e}")


# Singleton instance
_llm_client = None


def get_llm_client() -> BaseLLMClient:
    """
    Get or create singleton LLM client based on environment configuration

    Environment variables:
        LLM_PROVIDER: "ollama" (default) or "groq"

        For Ollama:
            OLLAMA_BASE_URL: Ollama server URL (default: http://localhost:11434)
            OLLAMA_MODEL: Model name (default: llama3.2:3b)

        For Groq:
            GROQ_API_KEY: Your Groq API key (required)
            GROQ_MODEL: Model name (default: llama-3.3-70b-versatile)

    Returns:
        BaseLLMClient instance (OllamaClient or GroqClient)
    """
    global _llm_client

    if _llm_client is None:
        provider = os.getenv("LLM_PROVIDER", "ollama").lower()

        if provider == "groq":
            api_key = os.getenv("GROQ_API_KEY")
            model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
            _llm_client = GroqClient(api_key=api_key, model=model)
        else:
            # Default to Ollama
            base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
            model = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
            _llm_client = OllamaClient(base_url=base_url, model=model)

    return _llm_client


if __name__ == "__main__":
    # Test LLM client
    from dotenv import load_dotenv
    load_dotenv()

    provider = os.getenv("LLM_PROVIDER", "ollama")
    print(f"Testing LLM client with provider: {provider}")

    try:
        client = get_llm_client()

        # Test simple generation
        print("\n🤖 Testing simple generation:")
        response = client.generate("Cos'è la pallavolo? Rispondi in una frase.", max_tokens=100)
        print(f"Response: {response}")

        # Test RAG-style response
        print("\n🏐 Testing RAG response:")
        context = """
        Partita del 15/01/2026: RM VOLLEY #18 vs Team X. Risultato finale: 3-2.
        Parziali: (25-20) (23-25) (25-18) (20-25) (15-10).
        RM VOLLEY #18 ha vinto 3-2 contro Team X.
        """
        query = "Com'è andata la partita di RM VOLLEY #18 contro Team X?"
        rag_response = client.generate_rag_response(query, context)
        print(f"Response: {rag_response}")

        print(f"\n✅ {provider.upper()} client test successful!")

    except Exception as e:
        print(f"\n❌ Error: {e}")
        if provider == "ollama":
            print("\nMake sure:")
            print("1. Ollama is installed and running")
            print("2. Model is pulled (e.g., ollama pull llama3.2:3b)")
        else:
            print("\nMake sure:")
            print("1. GROQ_API_KEY is set in .env")
            print("2. Your API key is valid")
