#!/usr/bin/env python3
"""
Test script for RM Volley RAG System
Verifies all components are working correctly
"""

import sys
import time
from typing import Dict, Any

# Color codes for terminal output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

def print_test(name: str):
    print(f"\n{Colors.BLUE}🧪 Testing: {name}{Colors.RESET}")

def print_success(message: str):
    print(f"{Colors.GREEN}✅ {message}{Colors.RESET}")

def print_error(message: str):
    print(f"{Colors.RED}❌ {message}{Colors.RESET}")

def print_info(message: str):
    print(f"{Colors.YELLOW}ℹ️  {message}{Colors.RESET}")

def test_imports() -> bool:
    """Test if all required libraries can be imported"""
    print_test("Python Imports")

    try:
        import chromadb
        print_success("ChromaDB imported")
    except ImportError as e:
        print_error(f"ChromaDB import failed: {e}")
        return False

    try:
        from sentence_transformers import SentenceTransformer
        print_success("SentenceTransformers imported")
    except ImportError as e:
        print_error(f"SentenceTransformers import failed: {e}")
        return False

    try:
        from fastapi import FastAPI
        print_success("FastAPI imported")
    except ImportError as e:
        print_error(f"FastAPI import failed: {e}")
        return False

    try:
        import pandas as pd
        print_success("Pandas imported")
    except ImportError as e:
        print_error(f"Pandas import failed: {e}")
        return False

    return True

def test_ollama() -> bool:
    """Test Ollama connection and model availability"""
    print_test("Ollama Connection")

    try:
        import requests

        # Check if Ollama is running
        response = requests.get("http://localhost:11434/api/tags", timeout=5)

        if response.status_code == 200:
            print_success("Ollama server is running")

            # Check if recommended model is available
            models = response.json().get("models", [])
            model_names = [m["name"] for m in models]

            if "llama3.2:3b" in model_names:
                print_success("llama3.2:3b model is installed")
                return True
            else:
                print_error("llama3.2:3b model not found")
                print_info("Install with: ollama pull llama3.2:3b")
                return False
        else:
            print_error("Ollama server responded with error")
            return False

    except requests.exceptions.ConnectionError:
        print_error("Cannot connect to Ollama server")
        print_info("Start Ollama with: ollama serve")
        return False
    except Exception as e:
        print_error(f"Ollama test failed: {e}")
        return False

def test_database() -> bool:
    """Test if vector database exists and is accessible"""
    print_test("Vector Database")

    try:
        import chromadb
        from chromadb.config import Settings

        client = chromadb.PersistentClient(
            path="./volleyball_db",
            settings=Settings(anonymized_telemetry=False)
        )

        try:
            collection = client.get_collection("rm_volley")
            count = collection.count()

            print_success(f"Database found with {count} documents")

            if count == 0:
                print_error("Database is empty")
                print_info("Run: python indexer.py")
                return False

            return True

        except Exception as e:
            print_error("Collection 'rm_volley' not found")
            print_info("Run: python indexer.py")
            return False

    except Exception as e:
        print_error(f"Database test failed: {e}")
        return False

def test_embeddings() -> bool:
    """Test embedding generation"""
    print_test("Embedding Generation")

    try:
        from embeddings import get_embedding_generator

        embedder = get_embedding_generator()

        # Test embedding
        test_text = "RM VOLLEY #18 won 3-0"
        start_time = time.time()
        embedding = embedder.embed_query(test_text)
        elapsed = (time.time() - start_time) * 1000

        print_success(f"Generated {len(embedding)}-dimensional embedding in {elapsed:.0f}ms")

        return True

    except Exception as e:
        print_error(f"Embedding test failed: {e}")
        return False

def test_retriever() -> bool:
    """Test vector retrieval"""
    print_test("Vector Retrieval")

    try:
        from retriever import get_retriever

        retriever = get_retriever()

        # Test search
        query = "RM VOLLEY #18"
        start_time = time.time()
        results = retriever.retrieve(query, n_results=3)
        elapsed = (time.time() - start_time) * 1000

        num_results = len(results["documents"])
        print_success(f"Retrieved {num_results} documents in {elapsed:.0f}ms")

        if num_results > 0:
            print_info(f"Sample result: {results['documents'][0][:80]}...")

        return True

    except Exception as e:
        print_error(f"Retriever test failed: {e}")
        return False

def test_llm() -> bool:
    """Test LLM generation"""
    print_test("LLM Generation")

    try:
        from llm_client import get_llm_client

        client = get_llm_client()

        # Test simple generation
        prompt = "What is volleyball?"
        print_info("Generating response (this may take a few seconds)...")

        start_time = time.time()
        response = client.generate(prompt, max_tokens=50)
        elapsed = time.time() - start_time

        tokens = len(response.split())
        tps = tokens / elapsed if elapsed > 0 else 0

        print_success(f"Generated {tokens} tokens in {elapsed:.1f}s ({tps:.1f} tokens/sec)")
        print_info(f"Response: {response[:100]}...")

        return True

    except Exception as e:
        print_error(f"LLM test failed: {e}")
        return False

def test_rag_pipeline() -> bool:
    """Test full RAG pipeline"""
    print_test("Full RAG Pipeline")

    try:
        from retriever import get_retriever
        from llm_client import get_llm_client

        retriever = get_retriever()
        llm = get_llm_client()

        # Test RAG query
        query = "How many matches did RM VOLLEY play?"
        print_info(f"Query: {query}")

        # Retrieve context
        print_info("Retrieving context...")
        results = retriever.retrieve(query, n_results=3)
        context = retriever.format_results_for_llm(results, max_length=500)

        print_success(f"Retrieved {len(results['documents'])} context chunks")

        # Generate answer
        print_info("Generating answer...")
        start_time = time.time()
        answer = llm.generate_rag_response(query, context, max_tokens=100)
        elapsed = time.time() - start_time

        print_success(f"Generated answer in {elapsed:.1f}s")
        print_info(f"Answer: {answer[:150]}...")

        return True

    except Exception as e:
        print_error(f"RAG pipeline test failed: {e}")
        return False

def test_data_files() -> bool:
    """Test if data files exist"""
    print_test("Data Files")

    import os

    files = {
        "../Gare.xls": "Match data",
        "../classifica.json": "Standings data"
    }

    all_found = True
    for filepath, description in files.items():
        if os.path.exists(filepath):
            size = os.path.getsize(filepath)
            print_success(f"{description} found ({size:,} bytes)")
        else:
            print_error(f"{description} not found at {filepath}")
            all_found = False

    if not all_found:
        print_info("Run: python update_gare.py")

    return all_found

def main():
    """Run all tests"""
    print("=" * 60)
    print("🏐 RM VOLLEY RAG SYSTEM TESTS")
    print("=" * 60)

    tests = [
        ("Data Files", test_data_files),
        ("Python Imports", test_imports),
        ("Ollama Connection", test_ollama),
        ("Vector Database", test_database),
        ("Embeddings", test_embeddings),
        ("Vector Retrieval", test_retriever),
        ("LLM Generation", test_llm),
        ("Full RAG Pipeline", test_rag_pipeline),
    ]

    results = {}

    for name, test_func in tests:
        try:
            results[name] = test_func()
        except Exception as e:
            print_error(f"Test crashed: {e}")
            results[name] = False

    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)

    passed = sum(1 for r in results.values() if r)
    total = len(results)

    for name, result in results.items():
        status = f"{Colors.GREEN}PASS{Colors.RESET}" if result else f"{Colors.RED}FAIL{Colors.RESET}"
        print(f"{status} - {name}")

    print("\n" + "=" * 60)
    print(f"Results: {passed}/{total} tests passed")

    if passed == total:
        print_success("All tests passed! System is ready to use.")
        print("\nNext steps:")
        print("  1. Start Ollama: ollama serve")
        print("  2. Start API: python main.py")
        print("  3. Open: ../rag-chat.html")
        return 0
    else:
        print_error(f"{total - passed} test(s) failed. Please fix the issues above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
