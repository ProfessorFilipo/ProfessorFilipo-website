"""
Cloudflare R2 client (S3-compatible API), used for uploading/reading media
files. R2 has zero egress fees, unlike most S3-compatible services.
"""
import boto3

from app.core.config import settings


def get_r2_client():
    """Returns a boto3 S3 client configured to talk to Cloudflare R2 instead of AWS."""
    return boto3.client(
        "s3",
        endpoint_url=settings.r2_endpoint_url,
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        region_name="auto",  # R2 doesn't use AWS regions, but boto3 requires this field
    )
