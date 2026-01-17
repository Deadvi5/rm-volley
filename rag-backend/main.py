"""
RM Volley RAG API Server
FastAPI backend for volleyball statistics RAG system
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import uvicorn
import os
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from retriever import get_retriever
from llm_client import get_llm_client
from embeddings import get_embedding_generator

# Initialize FastAPI app
app = FastAPI(
    title="RM Volley RAG API",
    description="RAG system for volleyball statistics and match data",
    version="1.0.0"
)

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:8080",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8080",
        "http://localhost:5500",  # Live Server
        "http://127.0.0.1:5500",
        "*"  # Allow all in development (restrict in production)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response Models
class QueryRequest(BaseModel):
    """Request model for RAG queries"""
    question: str = Field(..., description="User question about volleyball data")
    n_results: int = Field(10, description="Number of context chunks to retrieve", ge=1, le=20)
    temperature: float = Field(0.5, description="LLM temperature", ge=0.0, le=1.0)
    filter_type: Optional[str] = Field(None, description="Filter by type: 'match' or 'standing'")


class QueryResponse(BaseModel):
    """Response model for RAG queries"""
    answer: str = Field(..., description="Generated answer")
    sources: List[Dict[str, Any]] = Field(..., description="Source documents metadata")
    context_used: str = Field(..., description="Retrieved context")
    query: str = Field(..., description="Original query")
    timestamp: str = Field(..., description="Response timestamp")


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    database_count: int
    ollama_available: bool
    model: str


# Global instances (initialized on startup)
retriever = None
llm_client = None
embedder = None


@app.on_event("startup")
async def startup_event():
    """Initialize components on startup"""
    global retriever, llm_client, embedder

    print("=" * 60)
    print("🏐 RM VOLLEY RAG API SERVER")
    print("=" * 60)

    try:
        # Initialize retriever
        print("\n📊 Initializing retriever...")
        retriever = get_retriever(db_path="./volleyball_db")

        # Initialize embedder
        print("\n🔤 Initializing embedder...")
        embedder = get_embedding_generator()

        # Initialize LLM client
        print("\n🤖 Initializing LLM client...")
        llm_client = get_llm_client()

        print("\n✅ All components initialized successfully!")
        print("=" * 60)

    except Exception as e:
        print(f"\n❌ Startup error: {e}")
        print("\nTroubleshooting:")
        print("1. Run indexer.py first to create the database")
        print("2. Make sure Ollama is running: ollama serve")
        print("3. Pull the model: ollama pull llama3.2:3b")
        raise


@app.get("/", response_model=Dict[str, str])
async def root():
    """Root endpoint"""
    return {
        "message": "RM Volley RAG API",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "ask": "/ask (POST)",
            "search": "/search (GET)",
            "stats": "/stats"
        }
    }


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    stats = retriever.get_collection_stats()

    return HealthResponse(
        status="healthy",
        database_count=stats["count"],
        ollama_available=llm_client.is_available(),
        model=llm_client.model
    )


@app.post("/ask", response_model=QueryResponse)
async def ask_question(request: QueryRequest):
    """
    Main RAG endpoint: Answer questions using retrieved context

    Example request:
    ```json
    {
        "question": "How did RM VOLLEY #18 perform in January?",
        "n_results": 5,
        "temperature": 0.5
    }
    ```
    """
    try:
        # Step 1: Detect if query is about a specific team
        import re
        team_patterns = [
            r"RM\s*VOLLEY\s*#?(\d+)",
            r"RMVOLLEY\s*#?(\d+)",
            r"RM\s*VOLLEY\s*PIACENZA"
        ]

        detected_team = None
        for pattern in team_patterns:
            match = re.search(pattern, request.question.upper())
            if match:
                if match.groups():
                    detected_team = f"RM VOLLEY #{match.group(1)}"
                else:
                    detected_team = "RM VOLLEY PIACENZA"
                break

        # Step 2: Retrieve relevant context
        filter_metadata = None
        if request.filter_type:
            filter_metadata = {"type": request.filter_type}

        # Detect if query is about past matches (results)
        past_keywords = ["recente", "giocato", "giocata", "performance", "risultat",
                        "ultima", "ieri", "scorsa", "contro", "com'è andata", "come è andata",
                        "vinto", "perso", "pareggio", "punteggio", "score"]
        is_past_query = any(kw in request.question.lower() for kw in past_keywords)

        # Detect if query is about future matches
        future_keywords = ["prossima", "prossime", "calendario", "quando gioca",
                         "prossimo", "futura", "future", "da giocare"]
        is_future_query = any(kw in request.question.lower() for kw in future_keywords)

        # Use team-specific retrieval if a team was detected and query is about matches
        if detected_team and is_past_query and not is_future_query:
            results = retriever.retrieve_by_team(
                team_name=detected_team,
                n_results=request.n_results,
                only_played=True,
                only_future=False
            )
        elif detected_team and is_future_query:
            # If asking for "la prossima" (singular), return only 1 result
            # If asking for "le prossime" (plural), return more
            is_singular = "prossima" in request.question.lower() and "prossime" not in request.question.lower()
            n_future = 1 if is_singular else request.n_results

            results = retriever.retrieve_by_team(
                team_name=detected_team,
                n_results=n_future,
                only_played=False,
                only_future=True  # Only future matches, sorted closest first
            )
        else:
            results = retriever.retrieve(
                query=request.question,
                n_results=request.n_results,
                filter_metadata=filter_metadata
            )

        # Step 2: Format context for LLM
        context = retriever.format_results_for_llm(results, max_length=2000)

        # Step 3: Generate answer
        answer = llm_client.generate_rag_response(
            query=request.question,
            context=context,
            temperature=request.temperature,
            max_tokens=400
        )

        # Step 4: Return response
        return QueryResponse(
            answer=answer,
            sources=results["metadatas"],
            context_used=context,
            query=request.question,
            timestamp=datetime.now().isoformat()
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG query failed: {str(e)}")


@app.get("/search")
async def search_documents(
    query: str = Query(..., description="Search query"),
    n_results: int = Query(5, ge=1, le=20, description="Number of results"),
    filter_type: Optional[str] = Query(None, description="Filter by type: 'match' or 'standing'")
):
    """
    Direct vector search endpoint (without LLM generation)

    Returns raw retrieved documents
    """
    try:
        filter_metadata = None
        if filter_type:
            filter_metadata = {"type": filter_type}

        results = retriever.retrieve(
            query=query,
            n_results=n_results,
            filter_metadata=filter_metadata
        )

        return {
            "query": query,
            "results": [
                {
                    "document": doc,
                    "metadata": meta,
                    "distance": dist,
                    "id": doc_id
                }
                for doc, meta, dist, doc_id in zip(
                    results["documents"],
                    results["metadatas"],
                    results["distances"],
                    results["ids"]
                )
            ],
            "count": len(results["documents"])
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@app.get("/stats")
async def get_statistics():
    """Get database and system statistics"""
    try:
        collection_stats = retriever.get_collection_stats()

        return {
            "database": {
                "name": collection_stats["name"],
                "document_count": collection_stats["count"],
                "embedding_dimension": collection_stats["embedding_dimension"]
            },
            "llm": {
                "model": llm_client.model,
                "base_url": llm_client.base_url,
                "available": llm_client.is_available()
            },
            "embedder": {
                "dimension": embedder.get_dimension()
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")


@app.get("/matches")
async def search_matches(
    query: str = Query(..., description="Match search query"),
    n_results: int = Query(10, ge=1, le=50)
):
    """Search only match documents"""
    try:
        results = retriever.retrieve_matches(query, n_results)

        return {
            "query": query,
            "matches": [
                {
                    "text": doc,
                    "match_id": meta.get("match_id"),
                    "date": meta.get("date"),
                    "home_team": meta.get("home_team"),
                    "away_team": meta.get("away_team"),
                    "result": meta.get("result"),
                    "league": meta.get("league")
                }
                for doc, meta in zip(results["documents"], results["metadatas"])
            ],
            "count": len(results["documents"])
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Match search failed: {str(e)}")


@app.get("/standings")
async def search_standings(
    query: str = Query(..., description="Standings search query"),
    n_results: int = Query(10, ge=1, le=50)
):
    """Search only standings documents"""
    try:
        results = retriever.retrieve_standings(query, n_results)

        return {
            "query": query,
            "standings": [
                {
                    "text": doc,
                    "team": meta.get("team"),
                    "league": meta.get("league"),
                    "position": meta.get("position"),
                    "points": meta.get("points"),
                    "wins": meta.get("wins"),
                    "losses": meta.get("losses")
                }
                for doc, meta in zip(results["documents"], results["metadatas"])
            ],
            "count": len(results["documents"])
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Standings search failed: {str(e)}")


@app.get("/team/{team_name}")
async def get_team_info(
    team_name: str,
    n_results: int = Query(10, ge=1, le=50)
):
    """Get information about a specific team"""
    try:
        results = retriever.retrieve_by_team(team_name, n_results)

        return {
            "team": team_name,
            "documents": results["documents"],
            "metadatas": results["metadatas"],
            "count": len(results["documents"])
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Team query failed: {str(e)}")


if __name__ == "__main__":
    # Run the server
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # Auto-reload on code changes
        log_level="info"
    )
