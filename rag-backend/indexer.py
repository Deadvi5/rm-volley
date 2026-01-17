#!/usr/bin/env python3
"""
RM Volley RAG Indexer
Processes match data, standings, and player statistics into vector embeddings
for semantic search and retrieval.
"""

import pandas as pd
import json
import os
import sys
from datetime import datetime
from typing import List, Dict, Any
import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
from pathlib import Path

class VolleyballDataIndexer:
    """Indexes volleyball data into ChromaDB vector database"""

    def __init__(self,
                 data_dir: str = "../",
                 db_path: str = "./volleyball_db",
                 model_name: str = "all-MiniLM-L6-v2"):
        """
        Initialize the indexer

        Args:
            data_dir: Directory containing Gare.xls and classifica.json
            db_path: Path to ChromaDB persistence directory
            model_name: SentenceTransformer model for embeddings
        """
        self.data_dir = Path(data_dir)
        self.db_path = db_path

        print(f"🔧 Initializing RM Volley RAG Indexer...")
        print(f"   Data directory: {self.data_dir.absolute()}")
        print(f"   Database path: {db_path}")

        # Initialize embedding model
        print(f"📦 Loading embedding model: {model_name}")
        self.embedder = SentenceTransformer(model_name)
        print(f"✅ Model loaded (embedding dimension: {self.embedder.get_sentence_embedding_dimension()})")

        # Initialize ChromaDB
        self.client = chromadb.PersistentClient(
            path=db_path,
            settings=Settings(anonymized_telemetry=False)
        )

        # Create or get collection
        try:
            self.client.delete_collection("rm_volley")
            print("🗑️  Deleted existing collection")
        except:
            pass

        self.collection = self.client.create_collection(
            name="rm_volley",
            metadata={"description": "RM Volley matches, standings, and statistics"}
        )
        print("✅ Created new collection: rm_volley")

        self.indexed_count = 0

    def create_match_chunk(self, match: pd.Series) -> Dict[str, Any]:
        """
        Convert a match record into a semantic text chunk

        Args:
            match: Pandas Series with match data

        Returns:
            Dictionary with text, metadata, and ID
        """
        # Determine if RM Volley is involved and if they're home/away
        rm_patterns = ["RM VOLLEY", "RMVOLLEY"]
        is_rm_home = any(pattern in str(match.get('SquadraCasa', '')).upper()
                        for pattern in rm_patterns)
        is_rm_away = any(pattern in str(match.get('SquadraOspite', '')).upper()
                        for pattern in rm_patterns)

        rm_team = None
        opponent = None
        is_home = None

        if is_rm_home:
            rm_team = match.get('SquadraCasa', '')
            opponent = match.get('SquadraOspite', '')
            is_home = True
        elif is_rm_away:
            rm_team = match.get('SquadraOspite', '')
            opponent = match.get('SquadraCasa', '')
            is_home = False

        # Build semantic description
        chunks = []

        # Basic match info
        date_str = str(match.get('Data', 'Unknown date'))
        home_team = match.get('SquadraCasa', 'Unknown')
        away_team = match.get('SquadraOspite', 'Unknown')

        chunks.append(f"Match on {date_str}: {home_team} vs {away_team}")

        # Result and sets
        result = match.get('Risultato', '')
        parziali = match.get('Parziali', '')

        if pd.notna(result) and result:
            chunks.append(f"Final result: {result}")

            # Determine winner
            if is_rm_home or is_rm_away:
                try:
                    home_sets, away_sets = map(int, str(result).split('-'))
                    if is_home:
                        rm_won = home_sets > away_sets
                    else:
                        rm_won = away_sets > home_sets

                    outcome = "won" if rm_won else "lost"
                    chunks.append(f"{rm_team} {outcome} {result} against {opponent}")
                except:
                    pass

        if pd.notna(parziali) and parziali:
            chunks.append(f"Set scores: {parziali}")

        # Venue and league
        venue = match.get('Impianto', '')
        if pd.notna(venue) and venue:
            chunks.append(f"Venue: {venue}")

        league = match.get('Campionato', '')
        if pd.notna(league) and league:
            chunks.append(f"League: {league}")

        # Match status
        status = match.get('StatoDescrizione', '')
        if pd.notna(status) and status:
            chunks.append(f"Status: {status}")

        text = ". ".join(chunks) + "."

        # Create metadata
        metadata = {
            "type": "match",
            "match_id": str(match.get('Gara N', '')),
            "date": date_str,
            "home_team": home_team,
            "away_team": away_team,
            "league": league,
            "status": status,
        }

        if rm_team:
            metadata["rm_team"] = rm_team
            metadata["opponent"] = opponent
            metadata["is_home"] = is_home

        if pd.notna(result) and result:
            metadata["result"] = str(result)

        return {
            "id": f"match_{match.get('Gara N', self.indexed_count)}",
            "text": text,
            "metadata": metadata
        }

    def create_standing_chunk(self, team: Dict, league_name: str) -> Dict[str, Any]:
        """
        Convert a standings record into a semantic text chunk

        Args:
            team: Dictionary with team standing data
            league_name: Name of the league

        Returns:
            Dictionary with text, metadata, and ID
        """
        team_name = team.get('Squadra', 'Unknown team')
        position = team.get('Pos.', 0)
        points = team.get('Punti', 0)
        played = team.get('PG', 0)
        wins = team.get('PV', 0)
        losses = team.get('PP', 0)
        sets_for = team.get('SF', 0)
        sets_against = team.get('SS', 0)

        # Calculate set difference
        set_diff = sets_for - sets_against
        set_diff_str = f"+{set_diff}" if set_diff > 0 else str(set_diff)

        # Build semantic description
        text = (
            f"{team_name} in {league_name}: "
            f"Position {position} with {points} points. "
            f"Record: {wins} wins, {losses} losses in {played} matches. "
            f"Sets: {sets_for}-{sets_against} ({set_diff_str})"
        )

        # Add point differential if available
        if 'QS' in team and 'QP' in team:
            points_for = team.get('QS', 0)
            points_against = team.get('QP', 0)
            point_diff = points_for - points_against
            point_diff_str = f"+{point_diff}" if point_diff > 0 else str(point_diff)
            text += f". Points scored: {points_for}-{points_against} ({point_diff_str})"

        metadata = {
            "type": "standing",
            "league": league_name,
            "team": team_name,
            "position": int(position),
            "points": int(points),
            "wins": int(wins),
            "losses": int(losses),
            "played": int(played),
            "sets_for": int(sets_for),
            "sets_against": int(sets_against),
        }

        return {
            "id": f"standing_{league_name.replace(' ', '_')}_{position}",
            "text": text,
            "metadata": metadata
        }

    def index_matches(self, excel_path: str = "Gare.xls") -> int:
        """
        Index match data from Excel file

        Args:
            excel_path: Path to Gare.xls file (relative to data_dir)

        Returns:
            Number of matches indexed
        """
        full_path = self.data_dir / excel_path

        if not full_path.exists():
            print(f"⚠️  Match file not found: {full_path}")
            return 0

        print(f"\n📊 Processing matches from {excel_path}...")

        try:
            df = pd.read_excel(full_path)
            print(f"   Loaded {len(df)} match records")

            documents = []
            metadatas = []
            ids = []

            for idx, row in df.iterrows():
                chunk = self.create_match_chunk(row)
                documents.append(chunk["text"])
                metadatas.append(chunk["metadata"])
                ids.append(chunk["id"])

            # Generate embeddings in batches
            print(f"   Generating embeddings...")
            embeddings = self.embedder.encode(
                documents,
                show_progress_bar=True,
                batch_size=32
            ).tolist()

            # Add to ChromaDB
            print(f"   Adding to vector database...")
            self.collection.add(
                documents=documents,
                embeddings=embeddings,
                metadatas=metadatas,
                ids=ids
            )

            self.indexed_count += len(documents)
            print(f"✅ Indexed {len(documents)} matches")
            return len(documents)

        except Exception as e:
            print(f"❌ Error indexing matches: {e}")
            return 0

    def index_standings(self, json_path: str = "classifica.json") -> int:
        """
        Index league standings from JSON file

        Args:
            json_path: Path to classifica.json (relative to data_dir)

        Returns:
            Number of standings indexed
        """
        full_path = self.data_dir / json_path

        if not full_path.exists():
            print(f"⚠️  Standings file not found: {full_path}")
            return 0

        print(f"\n🏆 Processing standings from {json_path}...")

        try:
            with open(full_path, 'r', encoding='utf-8') as f:
                standings_data = json.load(f)

            print(f"   Loaded {len(standings_data)} leagues")

            documents = []
            metadatas = []
            ids = []

            for league_name, teams in standings_data.items():
                for team in teams:
                    chunk = self.create_standing_chunk(team, league_name)
                    documents.append(chunk["text"])
                    metadatas.append(chunk["metadata"])
                    ids.append(chunk["id"])

            # Generate embeddings
            print(f"   Generating embeddings...")
            embeddings = self.embedder.encode(
                documents,
                show_progress_bar=True,
                batch_size=32
            ).tolist()

            # Add to ChromaDB
            print(f"   Adding to vector database...")
            self.collection.add(
                documents=documents,
                embeddings=embeddings,
                metadatas=metadatas,
                ids=ids
            )

            self.indexed_count += len(documents)
            print(f"✅ Indexed {len(documents)} standings")
            return len(documents)

        except Exception as e:
            print(f"❌ Error indexing standings: {e}")
            return 0

    def get_stats(self) -> Dict[str, Any]:
        """Get indexing statistics"""
        return {
            "total_chunks": self.indexed_count,
            "collection_count": self.collection.count(),
            "embedding_dimension": self.embedder.get_sentence_embedding_dimension()
        }

    def test_search(self, query: str, n_results: int = 3):
        """
        Test the indexed data with a search query

        Args:
            query: Search query
            n_results: Number of results to return
        """
        print(f"\n🔍 Testing search: '{query}'")

        # Generate query embedding
        query_embedding = self.embedder.encode([query])[0].tolist()

        # Search
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results
        )

        print(f"   Found {len(results['documents'][0])} results:")
        for i, (doc, metadata) in enumerate(zip(results['documents'][0], results['metadatas'][0])):
            print(f"\n   {i+1}. {doc[:150]}...")
            print(f"      Type: {metadata.get('type')}, League: {metadata.get('league', 'N/A')}")


def main():
    """Main indexing function"""
    print("=" * 60)
    print("🏐 RM VOLLEY RAG INDEXER")
    print("=" * 60)

    # Initialize indexer
    indexer = VolleyballDataIndexer(
        data_dir="../",
        db_path="./volleyball_db"
    )

    # Index matches
    matches_indexed = indexer.index_matches("Gare.xls")

    # Index standings
    standings_indexed = indexer.index_standings("classifica.json")

    # Print statistics
    print("\n" + "=" * 60)
    print("📈 INDEXING COMPLETE")
    print("=" * 60)
    stats = indexer.get_stats()
    print(f"Total chunks indexed: {stats['total_chunks']}")
    print(f"Collection count: {stats['collection_count']}")
    print(f"Embedding dimension: {stats['embedding_dimension']}")

    # Test searches
    if stats['total_chunks'] > 0:
        print("\n" + "=" * 60)
        print("🧪 RUNNING TEST SEARCHES")
        print("=" * 60)

        test_queries = [
            "How did RM VOLLEY #18 perform recently?",
            "What is the current standing of Serie D?",
            "Show me matches from January 2026"
        ]

        for query in test_queries:
            indexer.test_search(query, n_results=2)

    print("\n✅ Indexing completed successfully!")
    print(f"   Database saved to: {indexer.db_path}")


if __name__ == "__main__":
    main()
