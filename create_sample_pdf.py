import pypdf
from pypdf import PdfWriter
from pypdf.generic import (
    DictionaryObject,
    NameObject,
    NumberObject,
    ArrayObject,
    DecodedStreamObject,
    ByteStringObject,
)

def create_sample_pdf(filepath: str):
    # Creates a 3-page PDF with actual extractable text streams
    writer = PdfWriter()

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

    for title, paragraphs in pages_content:
        # Create text stream
        stream_lines = ["BT", "/F1 16 Tf", "50 730 Td", f"({title}) Tj", "ET"]
        y_pos = 680
        for para in paragraphs:
            stream_lines.extend(["BT", "/F1 11 Tf", f"50 {y_pos} Td", f"({para[:90]}) Tj", "ET"])
            if len(para) > 90:
                stream_lines.extend(["BT", "/F1 11 Tf", f"50 {y_pos - 15} Td", f"({para[90:180]}) Tj", "ET"])
            if len(para) > 180:
                stream_lines.extend(["BT", "/F1 11 Tf", f"50 {y_pos - 30} Td", f"({para[180:270]}) Tj", "ET"])
            y_pos -= 60

        stream_data = "\n".join(stream_lines).encode("latin-1")
        
        # Add blank page then attach text stream
        page = writer.add_blank_page(width=612, height=792)
        
        # Add basic font resource
        font_dict = DictionaryObject({
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        })
        res_dict = DictionaryObject({
            NameObject("/Font"): DictionaryObject({
                NameObject("/F1"): font_dict
            })
        })
        page[NameObject("/Resources")] = res_dict

        stream_obj = DecodedStreamObject()
        stream_obj.set_data(stream_data)
        page[NameObject("/Contents")] = stream_obj

    with open(filepath, "wb") as f:
        writer.write(f)

    print(f"Generated sample PDF at: {filepath}")

if __name__ == "__main__":
    create_sample_pdf("d:/DOWNLOADS/new_pro_mcp/sample_research_paper.pdf")
