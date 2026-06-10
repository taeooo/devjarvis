import re
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pydantic.alias_generators import to_camel

_WINDOWS_DRIVE_PATH_PATTERN = re.compile(r"^[A-Za-z]:.*")
_SENSITIVE_EXTENSIONS = {"pem", "key", "jks", "p12"}
_SENSITIVE_NAME_KEYWORDS = {"secret", "password", "token"}


class CamelCaseModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        frozen=True,
    )


class ManifestFileItem(CamelCaseModel):
    relative_path: str = Field(min_length=1, max_length=1000)
    file_name: str = Field(min_length=1, max_length=255)
    extension: str = Field(default="", max_length=50)
    language: str = Field(default="unknown", max_length=50)
    size_bytes: int = Field(ge=0)
    sha256: str | None = Field(default=None, max_length=128)
    excluded: bool = False
    excluded_reason: str | None = Field(default=None, max_length=100)

    @field_validator("relative_path", mode="before")
    @classmethod
    def normalize_relative_path(cls, value: str) -> str:
        if not isinstance(value, str) or not value.strip():
            raise ValueError("relativePath is required")

        normalized = value.strip().replace("\\", "/")
        if (
            normalized.startswith("/")
            or normalized.startswith("//")
            or normalized.startswith("~")
            or _WINDOWS_DRIVE_PATH_PATTERN.match(normalized)
        ):
            raise ValueError("relativePath must be project-root-relative")

        segments = normalized.split("/")
        if any(segment in {"", ".", ".."} for segment in segments):
            raise ValueError("relativePath contains an unsafe path segment")

        return normalized

    @field_validator("file_name", mode="before")
    @classmethod
    def normalize_file_name(cls, value: str) -> str:
        if not isinstance(value, str) or not value.strip():
            raise ValueError("fileName is required")
        return value.strip()

    @field_validator("extension", mode="before")
    @classmethod
    def normalize_extension(cls, value: str | None) -> str | None:
        if value is None:
            return ""
        if not isinstance(value, str):
            return value
        if not value.strip():
            return ""
        normalized = value.strip().lower()
        return normalized[1:] if normalized.startswith(".") else normalized

    @field_validator("language", mode="before")
    @classmethod
    def normalize_language(cls, value: str | None) -> str | None:
        if value is None:
            return "unknown"
        if not isinstance(value, str):
            return value
        if not value.strip():
            return "unknown"
        return value.strip().lower()

    @field_validator("sha256", "excluded_reason", mode="before")
    @classmethod
    def normalize_nullable_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str):
            return value
        if not value.strip():
            return None
        return value.strip()

    @model_validator(mode="after")
    def validate_file_name_matches_relative_path(self) -> Self:
        expected_file_name = self.relative_path.rsplit("/", 1)[-1]
        if expected_file_name != self.file_name:
            raise ValueError("fileName must match the last segment of relativePath")
        return self

    def is_sensitive_file(self) -> bool:
        lower_relative_path = self.relative_path.lower()
        lower_file_name = self.file_name.lower()
        if lower_file_name == ".env" or lower_file_name.startswith(".env."):
            return True
        if self.extension in _SENSITIVE_EXTENSIONS:
            return True
        return any(keyword in lower_relative_path for keyword in _SENSITIVE_NAME_KEYWORDS)


class ValidateManifestRequest(CamelCaseModel):
    files: list[ManifestFileItem] = Field(min_length=1, max_length=10000)

    @model_validator(mode="after")
    def validate_unique_relative_paths(self) -> Self:
        seen_paths: set[str] = set()
        duplicate_paths: set[str] = set()
        for file in self.files:
            if file.relative_path in seen_paths:
                duplicate_paths.add(file.relative_path)
            seen_paths.add(file.relative_path)

        if duplicate_paths:
            raise ValueError(f"Duplicate relativePath values are not allowed: {sorted(duplicate_paths)}")
        return self


class ValidateManifestResponse(CamelCaseModel):
    requested_file_count: int
    excluded_file_count: int
    sensitive_file_count: int
    target_file_count: int
