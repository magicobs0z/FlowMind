import logging
import uuid
from typing import Optional

logger = logging.getLogger(__name__)


class KnowledgeDoc:
    def __init__(self, doc_id: str, title: str, content: str,
                 tags: list[str] | None = None, source: str = ""):
        self.doc_id = doc_id
        self.title = title
        self.content = content
        self.tags = tags or []
        self.source = source


class KnowledgeService:
    def __init__(self):
        self._docs: dict[str, KnowledgeDoc] = {}
        self._tag_index: dict[str, list[str]] = {}

    def add_doc(self, title: str, content: str,
                tags: list[str] | None = None,
                source: str = "") -> str:
        doc_id = f"doc_{uuid.uuid4().hex[:8]}"
        doc = KnowledgeDoc(doc_id, title, content, tags, source)
        self._docs[doc_id] = doc
        for tag in (tags or []):
            self._tag_index.setdefault(tag, []).append(doc_id)
        return doc_id

    def add_docs_batch(self, docs: list[dict]) -> list[str]:
        ids = []
        for d in docs:
            ids.append(self.add_doc(
                title=d.get("title", ""),
                content=d.get("content", ""),
                tags=d.get("tags"),
                source=d.get("source", ""),
            ))
        return ids

    def retrieve(self, query: str, top_k: int = 3,
                 tags: list[str] | None = None) -> list[KnowledgeDoc]:
        candidates = set(self._docs.keys())
        if tags:
            tagged = set()
            for tag in tags:
                tagged.update(self._tag_index.get(tag, []))
            candidates &= tagged

        query_lower = query.lower()
        query_terms = set(query_lower.split())

        scored: list[tuple[float, str]] = []
        for doc_id in candidates:
            doc = self._docs[doc_id]
            score = 0.0
            title_lower = doc.title.lower()
            content_lower = doc.content.lower()
            for term in query_terms:
                if term in title_lower:
                    score += 3.0
                if term in content_lower:
                    score += 1.0
                for tag in doc.tags:
                    if term in tag.lower():
                        score += 2.0
            if score > 0:
                scored.append((score, doc_id))

        scored.sort(reverse=True)
        return [self._docs[did] for _, did in scored[:top_k]]

    def retrieve_by_tags(self, tags: list[str]) -> list[KnowledgeDoc]:
        ids = set()
        for tag in tags:
            ids.update(self._tag_index.get(tag, []))
        return [self._docs[did] for did in ids]

    def get_doc(self, doc_id: str) -> Optional[KnowledgeDoc]:
        return self._docs.get(doc_id)

    def get_all_tags(self) -> list[str]:
        return list(self._tag_index.keys())

    def format_context(self, docs: list[KnowledgeDoc], max_chars: int = 2000) -> str:
        parts = []
        remaining = max_chars
        for doc in docs:
            snippet = doc.content[:remaining]
            if snippet:
                parts.append(f"[{doc.title}]\n{snippet}")
                remaining -= len(snippet)
            if remaining <= 0:
                break
        return "\n\n".join(parts)

    def remove_doc(self, doc_id: str):
        doc = self._docs.pop(doc_id, None)
        if doc:
            for tag in doc.tags:
                if tag in self._tag_index:
                    self._tag_index[tag] = [
                        did for did in self._tag_index[tag] if did != doc_id
                    ]

    def clear(self):
        self._docs.clear()
        self._tag_index.clear()
