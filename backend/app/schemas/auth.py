from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    """Public self-registration. Always creates a civilian account; fireman
    accounts are provisioned exclusively from the FIREMAN_EMAIL_N /
    FIREMAN_PASSWORD_N env vars at server startup."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=2, max_length=80)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str


class UserOut(BaseModel):
    id: str
    email: EmailStr
    display_name: str
    is_verified: bool
    role: str
