"""
Retriever Module
Handles vector similarity search using ChromaDB
"""

import chromadb
from chromadb.config import Settings
from typing import List, Dict, Any, Optional
from embeddings import get_embedding_generator


class VectorRetriever:
    """Retrieve relevant documents using vector similarity search"""

    def __init__(self, db_path: str = "./volleyball_db", collection_name: str = "rm_volley"):
        """
        Initialize retriever

        Args:
            db_path: Path to ChromaDB persistence directory
            collection_name: Name of the collection to query
        """
        self.db_path = db_path
        self.collection_name = collection_name

        # Initialize ChromaDB client
        self.client = chromadb.PersistentClient(
            path=db_path,
            settings=Settings(anonymized_telemetry=False)
        )

        # Get collection
        try:
            self.collection = self.client.get_collection(collection_name)
            print(f"✅ Connected to collection '{collection_name}' ({self.collection.count()} documents)")
        except Exception as e:
            raise RuntimeError(
                f"Failed to load collection '{collection_name}'. "
                f"Make sure to run indexer.py first. Error: {e}"
            )

        # Initialize embedding generator
        self.embedder = get_embedding_generator()

    def retrieve(self,
                 query: str,
                 n_results: int = 5,
                 filter_metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Retrieve relevant documents for a query

        Args:
            query: Search query
            n_results: Number of results to return
            filter_metadata: Optional metadata filters (e.g., {"type": "match"})

        Returns:
            Dictionary with documents, metadatas, distances, and ids
        """
        # Generate query embedding
        query_embedding = self.embedder.embed_query(query)

        # Build query parameters
        query_params = {
            "query_embeddings": [query_embedding],
            "n_results": n_results
        }

        if filter_metadata:
            query_params["where"] = filter_metadata

        # Execute search
        results = self.collection.query(**query_params)

        return {
            "documents": results["documents"][0],
            "metadatas": results["metadatas"][0],
            "distances": results["distances"][0],
            "ids": results["ids"][0]
        }

    def retrieve_matches(self, query: str, n_results: int = 5) -> Dict[str, Any]:
        """
        Retrieve only match documents

        Args:
            query: Search query
            n_results: Number of results

        Returns:
            Retrieved match documents
        """
        return self.retrieve(query, n_results, filter_metadata={"type": "match"})

    def retrieve_standings(self, query: str, n_results: int = 5) -> Dict[str, Any]:
        """
        Retrieve only standings documents

        Args:
            query: Search query
            n_results: Number of results

        Returns:
            Retrieved standings documents
        """
        return self.retrieve(query, n_results, filter_metadata={"type": "standing"})

    def retrieve_by_team(self, team_name: str, n_results: int = 10) -> Dict[str, Any]:
        """
        Retrieve documents related to a specific team

        Args:
            team_name: Name of the team (e.g., "RM VOLLEY #18")
            n_results: Number of results

        Returns:
            Retrieved documents for the team
        """
        query = f"matches and statistics for {team_name}"
        return self.retrieve(query, n_results)

    def retrieve_by_league(self, league_name: str, n_results: int = 10) -> Dict[str, Any]:
        """
        Retrieve documents from a specific league

        Args:
            league_name: Name of the league
            n_results: Number of results

        Returns:
            Retrieved documents from the league
        """
        return self.retrieve(
            query=f"standings and matches in {league_name}",
            n_results=n_results,
            filter_metadata={"league": league_name}
        )

    def get_collection_stats(self) -> Dict[str, Any]:
        """Get statistics about the collection"""
        return {
            "name": self.collection_name,
            "count": self.collection.count(),
            "embedding_dimension": self.embedder.get_dimension()
        }

    def format_results_for_llm(self, results: Dict[str, Any], max_length: int = 2000) -> str:
        """
        Format retrieval results as context for LLM

        Args:
            results: Results from retrieve()
            max_length: Maximum character length of context

        Returns:
            Formatted context string
        """
        context_parts = []

        for i, (doc, metadata) in enumerate(zip(results["documents"], results["metadatas"]), 1):
            # Format based on document type
            doc_type = metadata.get("type", "unknown")

            if doc_type == "match":
                context_parts.append(f"[Match {i}] {doc}")
            elif doc_type == "standing":
                context_parts.append(f"[Standing {i}] {doc}")
            else:
                context_parts.append(f"[Document {i}] {doc}")

        # Join and truncate if needed
        context = "\n\n".join(context_parts)

        if len(context) > max_length:
            context = context[:max_length] + "..."

        return context


# Singleton instance
_retriever = None


def get_retriever(db_path: str = "./volleyball_db") -> VectorRetriever:
    """
    Get or create singleton retriever instance

    Args:
        db_path: Path to ChromaDB database

    Returns:
        VectorRetriever instance
    """
    global _retriever
    if _retriever is None:
        _retriever = VectorRetriever(db_path)
    return _retriever


if __name__ == "__main__":
    # Test retriever
    print("Testing VectorRetriever...")

    retriever = VectorRetriever()

    # Test queries
    test_queries = [
        "How did RM VOLLEY #18 perform?",
        "Show me Serie D standings",
        "Recent matches in January 2026"
    ]

    for query in test_queries:
        print(f"\n🔍 Query: {query}")
        results = retriever.retrieve(query, n_results=3)

        print(f"Found {len(results['documents'])} results:")
        for i, doc in enumerate(results['documents'], 1):
            print(f"{i}. {doc[:100]}...")

    # Show stats
    print(f"\n📊 Collection stats: {retriever.get_collection_stats()}")
