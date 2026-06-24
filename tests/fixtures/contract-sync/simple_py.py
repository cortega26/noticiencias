"""Minimal Pydantic model for contract-sync testing."""

from typing import List, Optional
from pydantic import BaseModel, Field, HttpUrl


class SourceItem(BaseModel):
    """Source citation item."""

    title: str = Field(..., min_length=1)
    url: HttpUrl
    publisher: Optional[str] = None


class AstroPost(BaseModel):
    """Test model matching the TypeScript test fixture."""

    title: str = Field(..., min_length=5)
    excerpt: str = Field(..., min_length=10)
    author: str = Field(default="Noticiencias")
    categories: List[str] = Field(default_factory=list)
    featured: bool = Field(default=False)
    source_url: Optional[HttpUrl] = None
    sources: Optional[List[SourceItem]] = None
