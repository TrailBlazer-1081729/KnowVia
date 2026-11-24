import pymupdf

def create_sample_pdf(filepath: str):
    pages_content = [
        (
            "Quantum Error Mitigation in Distributed Retrieval-Augmented Generation",
            [
                "1. Introduction and Architectural Motivation",
                "Large Language Models (LLMs) deployed in mission-critical analytical workflows frequently suffer from hallucination when specialized domain knowledge is omitted from the parametric training weights. Retrieval-Augmented Generation (RAG) bridges this gap by grounding generations in retrieved textual evidence.",
                "In this research monograph, we formulate a distributed retrieval orchestration framework where Model Context Protocol (MCP) servers manage asynchronous ingestion and vector query routing.",
                "Section 1.2 highlights the empirical vulnerability of naive dense retrieval pipelines when document density exceeds 10,000 contextual chunks.",
            ]
        ),
        (
            "2. Scalable Ingestion Pipeline & Dense Vector Projections",
            [
                "2.1 Multi-Stage Pipeline Decomposition",
                "Our ingestion pipeline processes raw PDF streams through four discrete deterministic phases: structure extraction, semantic chunking, 768-dimensional embedding generation, and hierarchical index assembly.",
                "Under benchmark evaluation with 500 academic whitepapers, latency scales sub-linearly with an average indexing throughput of 142 pages per second.",
                "Table 2.4 demonstrates an 18.4% improvement in MRR (Mean Reciprocal Rank) compared to traditional fixed-window chunking algorithms.",
            ]
        ),
        (
            "3. Grounded Synthesis and Realtime Audio Interaction",
            [
                "3.1 Audio-to-Audio Conversational Interface",
                "Rather than serializing speech recognition followed by text synthesis, the assistant establishes direct PCM16 audio streaming with Gemini Live models.",
                "Realtime acoustic feedback indicates a median conversational turnaround of 480 milliseconds, enabling natural academic discourse.",
                "Section 3.4 concludes that grounding verification reduces false claim propagation by 94.2% across verified legal and clinical test suites.",
            ]
        )
    ]

    doc = pymupdf.open()
    for title, paragraphs in pages_content:
        page = doc.new_page(width=612, height=792)
        y = 60
        page.insert_text((50, y), title, fontsize=16)
        y += 35
        for para in paragraphs:
            # Wrap text to fit page
            rect = pymupdf.Rect(50, y, 560, y + 100)
            page.insert_textbox(rect, para, fontsize=11)
            y += 65

    doc.save(filepath)
    doc.close()
    print(f"Generated sample PDF at: {filepath}")

if __name__ == "__main__":
    create_sample_pdf("sample_research_paper.pdf")
