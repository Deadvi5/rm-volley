"""
Embeddings Module
Handles text embedding generation using SentenceTransformers
"""

from sentence_transformers import SentenceTransformer
from typing import List, Union
import numpy as np


class EmbeddingGenerator:
    """Generate embeddings for text using SentenceTransformers"""

    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        """
        Initialize embedding generator

        Args:
            model_name: Name of the SentenceTransformer model
                       Default: all-MiniLM-L6-v2 (384 dimensions, fast)
                       Alternatives:
                       - all-mpnet-base-v2 (768 dims, better quality)
                       - paraphrase-multilingual-MiniLM-L12-v2 (384 dims, multilingual)
        """
        print(f"Loading embedding model: {model_name}")
        self.model = SentenceTransformer(model_name)
        self.dimension = self.model.get_sentence_embedding_dimension()
        print(f"Model loaded. Embedding dimension: {self.dimension}")

    def embed(self, text: Union[str, List[str]],
              batch_size: int = 32,
              show_progress: bool = False) -> Union[np.ndarray, List[List[float]]]:
        """
        Generate embeddings for text

        Args:
            text: Single text string or list of texts
            batch_size: Batch size for encoding
            show_progress: Show progress bar

        Returns:
            Embeddings as numpy array or list of lists
        """
        if isinstance(text, str):
            text = [text]

        embeddings = self.model.encode(
            text,
            batch_size=batch_size,
            show_progress_bar=show_progress,
            convert_to_numpy=True
        )

        return embeddings

    def embed_query(self, query: str) -> List[float]:
        """
        Embed a single query string

        Args:
            query: Query text

        Returns:
            Embedding as list of floats
        """
        embedding = self.model.encode([query])[0]
        return embedding.tolist()

    def get_dimension(self) -> int:
        """Get embedding dimension"""
        return self.dimension


# Singleton instance
_embedding_generator = None


def get_embedding_generator(model_name: str = "all-MiniLM-L6-v2") -> EmbeddingGenerator:
    """
    Get or create singleton embedding generator

    Args:
        model_name: Name of the model to use

    Returns:
        EmbeddingGenerator instance
    """
    global _embedding_generator
    if _embedding_generator is None:
        _embedding_generator = EmbeddingGenerator(model_name)
    return _embedding_generator
