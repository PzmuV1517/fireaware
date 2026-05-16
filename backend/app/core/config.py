from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # protected_namespaces=() lets us name a field `model_weights_path` without
    # the Pydantic protected-namespace warning.
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", protected_namespaces=())

    database_url: str = "postgresql+psycopg://fireaware:fireaware@localhost:5432/fireaware"

    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_ttl_min: int = 30
    refresh_token_ttl_days: int = 30

    s3_endpoint: str = "http://localhost:9000"
    s3_access_key: str = "fireaware"
    s3_secret_key: str = "fireaware-secret"
    s3_bucket: str = "fireaware-photos"
    s3_public_base_url: str = "http://localhost:9000/fireaware-photos"

    cors_origins: str = "http://localhost:8081,http://localhost:19006"

    triangulation_radius_km: float = 50.0
    triangulation_time_window_min: int = 120
    cluster_eps_m: float = 200.0
    proximity_eps_m: float = 300.0
    proximity_min_samples: int = 3

    model_weights_path: str = "../trainDataset/best.pt"
    min_fire_confidence: float = 0.3


    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
