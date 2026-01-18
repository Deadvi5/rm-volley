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

# Disable ChromaDB telemetry before importing
os.environ["ANONYMIZED_TELEMETRY"] = "false"
os.environ["CHROMA_TELEMETRY"] = "false"

import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Default embedding model
DEFAULT_EMBEDDING_MODEL = "intfloat/multilingual-e5-small"


class VolleyballDataIndexer:
    """Indexes volleyball data into ChromaDB vector database"""

    def __init__(self,
                 data_dir: str = None,
                 db_path: str = None,
                 model_name: str = None):
        """
        Initialize the indexer

        Args:
            data_dir: Directory containing Gare.xls and classifica.json (default: from .env or "../")
            db_path: Path to ChromaDB persistence directory (default: from .env or "./volleyball_db")
            model_name: SentenceTransformer model for embeddings (default: from .env)
        """
        # Use provided values or fall back to env vars or defaults
        self.data_dir = Path(data_dir or os.getenv("DATA_DIR", "../"))
        self.db_path = db_path or os.getenv("DB_PATH", "./volleyball_db")
        model_name = model_name or os.getenv("EMBEDDING_MODEL", DEFAULT_EMBEDDING_MODEL)

        print(f"🔧 Initializing RM Volley RAG Indexer...")
        print(f"   Data directory: {self.data_dir.absolute()}")
        print(f"   Database path: {self.db_path}")

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

        # Detect team category from team name
        team_category = None
        if rm_team:
            if "#18" in rm_team or " 18" in rm_team:
                team_category = "Under 18 Femminile"
            elif "#16" in rm_team or " 16" in rm_team:
                team_category = "Under 16 Femminile"
            elif "#14" in rm_team or " 14" in rm_team or " 13" in rm_team or " 15" in rm_team:
                team_category = "Under 14 Femminile"
            elif "#2" in rm_team or " 2" in rm_team:
                team_category = "Seconda Divisione Femminile"

        # Build semantic description in Italian
        chunks = []

        # Basic match info with category
        date_str = str(match.get('Data', 'Data sconosciuta'))
        home_team = match.get('SquadraCasa', 'Sconosciuto')
        away_team = match.get('SquadraOspite', 'Sconosciuto')

        if team_category and rm_team:
            chunks.append(f"Partita del {date_str}: {home_team} vs {away_team} (Squadra {team_category})")
        else:
            chunks.append(f"Partita del {date_str}: {home_team} vs {away_team}")

        # Result and sets
        result = match.get('Risultato', '')
        parziali = match.get('Parziali', '')

        if pd.notna(result) and result:
            chunks.append(f"Risultato finale: {result}")

            # Determine winner
            if is_rm_home or is_rm_away:
                try:
                    home_sets, away_sets = map(int, str(result).split('-'))
                    if is_home:
                        rm_won = home_sets > away_sets
                    else:
                        rm_won = away_sets > home_sets

                    outcome = "ha vinto" if rm_won else "ha perso"
                    team_desc = f"{rm_team} ({team_category})" if team_category else rm_team
                    chunks.append(f"{team_desc} {outcome} {result} contro {opponent}")
                except:
                    pass

        if pd.notna(parziali) and parziali:
            chunks.append(f"Parziali: {parziali}")

        # Venue and league
        venue = match.get('Impianto', '')
        if pd.notna(venue) and venue:
            chunks.append(f"Impianto: {venue}")

        league = match.get('Campionato', '')
        if pd.notna(league) and league:
            chunks.append(f"Campionato: {league}")

        # Match status
        status = match.get('StatoDescrizione', '')
        if pd.notna(status) and status:
            status_it = status
            if "gara omologata" in status.lower():
                status_it = "partita omologata"
            elif "risultato ufficioso" in status.lower():
                status_it = "risultato non ufficiale"
            elif "da disputare" in status.lower():
                status_it = "da giocare"
            chunks.append(f"Stato: {status_it}")

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
            if team_category:
                metadata["team_category"] = team_category

        if pd.notna(result) and result:
            metadata["result"] = str(result)

        return {
            "id": f"match_{match.get('Gara N', self.indexed_count)}",
            "text": text,
            "metadata": metadata
        }

    def create_league_standing_chunk(self, teams: List[Dict], league_name: str) -> Dict[str, Any]:
        """
        Convert an entire league standings into a single semantic text chunk

        Args:
            teams: List of team dictionaries with standing data
            league_name: Name of the league

        Returns:
            Dictionary with text, metadata, and ID
        """
        if not teams:
            return None

        # Helper function to safely convert to int
        def safe_int(value, default=0):
            try:
                return int(value) if value not in [None, '', '-', 'nan'] else default
            except (ValueError, TypeError):
                return default

        # Sort teams by position
        sorted_teams = sorted(teams, key=lambda t: safe_int(t.get('Pos.', 999)))

        # Build the standings text in Italian with query-like preambles for better semantic matching
        preambles = [
            f"Qual è la classifica della {league_name}? Ecco la classifica aggiornata della {league_name}:",
            f"La classifica della {league_name} è la seguente:",
            f"Posizioni e punti della {league_name}:",
            ""  # Empty line for separation
        ]

        lines = preambles.copy()

        for team in sorted_teams:
            team_name = team.get('Squadra', 'Unknown')
            position = safe_int(team.get('Pos.', 0))
            points = safe_int(team.get('Punti', 0))
            played = safe_int(team.get('PG', 0))
            wins = safe_int(team.get('PV', 0))
            losses = safe_int(team.get('PP', 0))
            sets_for = safe_int(team.get('SF', 0))
            sets_against = safe_int(team.get('SS', 0))

            # Format: Position. Team - Points pts (Wins-Losses, Sets For-Against)
            line = (f"{position}. {team_name} - {points} punti "
                   f"({wins} vittorie, {losses} sconfitte, "
                   f"set {sets_for}-{sets_against})")
            lines.append(line)

        text = "\n".join(lines)

        # Metadata with summary info
        metadata = {
            "type": "standing",
            "league": league_name,
            "num_teams": len(sorted_teams),
            "leader": sorted_teams[0].get('Squadra', '') if sorted_teams else ''
        }

        return {
            "id": f"standing_{league_name.replace(' ', '_').replace('-', '_')}",
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

        # Convert to int, handling non-numeric values
        def safe_int(value, default=0):
            try:
                return int(value) if value not in [None, '', '-', 'nan'] else default
            except (ValueError, TypeError):
                return default

        position = safe_int(team.get('Pos.', 0))
        points = safe_int(team.get('Punti', 0))
        played = safe_int(team.get('PG', 0))
        wins = safe_int(team.get('PV', 0))
        losses = safe_int(team.get('PP', 0))
        sets_for = safe_int(team.get('SF', 0))
        sets_against = safe_int(team.get('SS', 0))

        # Calculate set difference
        set_diff = sets_for - sets_against
        set_diff_str = f"+{set_diff}" if set_diff > 0 else str(set_diff)

        # Build semantic description in Italian
        text = (
            f"Classifica {league_name}: "
            f"{team_name} è in posizione {position} con {points} punti. "
            f"Bilancio: {wins} vittorie, {losses} sconfitte in {played} partite giocate. "
            f"Set: {sets_for}-{sets_against} (differenza {set_diff_str})"
        )

        # Add point differential if available
        if 'QS' in team and 'QP' in team:
            points_for = safe_int(team.get('QS', 0))
            points_against = safe_int(team.get('QP', 0))
            point_diff = points_for - points_against
            point_diff_str = f"+{point_diff}" if point_diff > 0 else str(point_diff)
            text += f". Punti realizzati: {points_for}-{points_against} (differenza {point_diff_str})"

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
                # Create a single chunk for the entire league standings
                chunk = self.create_league_standing_chunk(teams, league_name)
                if chunk:
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
