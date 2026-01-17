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

    def retrieve_by_team(self, team_name: str, n_results: int = 10, only_played: bool = True, only_future: bool = False) -> Dict[str, Any]:
        """
        Retrieve documents related to a specific team

        Args:
            team_name: Name of the team (e.g., "RM VOLLEY #18")
            n_results: Number of results
            only_played: If True, return only past matches (with results)
            only_future: If True, return only future matches (to be played)

        Returns:
            Retrieved documents for the team, sorted by date
            - Past matches: most recent first
            - Future matches: closest upcoming first
        """
        from datetime import datetime

        # Retrieve more results to filter - need enough to cover all team's matches
        # Always get at least 50 results to ensure we find all relevant matches
        query = f"partite {team_name}"
        raw_results = self.retrieve(query, max(50, min(n_results * 10, 100)))

        # Filter and sort
        filtered_docs = []
        filtered_metas = []
        filtered_dists = []
        filtered_ids = []

        today = datetime.now()

        for doc, meta, dist, doc_id in zip(
            raw_results["documents"],
            raw_results["metadatas"],
            raw_results["distances"],
            raw_results["ids"]
        ):
            # Check if it's a match
            if meta.get("type") != "match":
                continue

            # Check if it's the right team
            rm_team = meta.get("rm_team", "")
            if team_name.replace(" ", "").upper() not in rm_team.replace(" ", "").upper():
                continue

            # Parse date
            date_str = meta.get("date", "")
            try:
                match_date = datetime.strptime(date_str, "%d/%m/%Y")
                meta["_parsed_date"] = match_date
            except:
                continue  # Skip if date can't be parsed

            # Filter based on past/future
            is_future = match_date > today

            if only_played and is_future:
                continue  # Skip future matches when looking for past
            if only_future and not is_future:
                continue  # Skip past matches when looking for future

            filtered_docs.append(doc)
            filtered_metas.append(meta)
            filtered_dists.append(dist)
            filtered_ids.append(doc_id)

        # Sort by date
        if filtered_metas:
            if only_future:
                # Future matches: closest upcoming first (ascending order)
                sorted_indices = sorted(
                    range(len(filtered_metas)),
                    key=lambda i: filtered_metas[i].get("_parsed_date", datetime.max),
                    reverse=False  # Ascending - closest first
                )
            else:
                # Past matches: most recent first (descending order)
                sorted_indices = sorted(
                    range(len(filtered_metas)),
                    key=lambda i: filtered_metas[i].get("_parsed_date", datetime.min),
                    reverse=True  # Descending - most recent first
                )

            filtered_docs = [filtered_docs[i] for i in sorted_indices[:n_results]]
            filtered_metas = [filtered_metas[i] for i in sorted_indices[:n_results]]
            filtered_dists = [filtered_dists[i] for i in sorted_indices[:n_results]]
            filtered_ids = [filtered_ids[i] for i in sorted_indices[:n_results]]

        return {
            "documents": filtered_docs[:n_results],
            "metadatas": filtered_metas[:n_results],
            "distances": filtered_dists[:n_results],
            "ids": filtered_ids[:n_results]
        }

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
