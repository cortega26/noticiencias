"""Pydantic model with an extra field not in TypeScript."""

from typing import List, Optional
from pydantic import BaseModel, Field, HttpUrl


class AstroPost(BaseModel):
    """Test model with an extra field."""

    title: str = Field(..., min_length=5)
    excerpt: str = Field(..., min_length=10)
    extra_field_only_in_python: str = "oops"
    categories: List[str] = Field(default_factory=list)
