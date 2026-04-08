# Audit Log — Infrastructure

## Status

| Piece | Status | Owner |
|---|---|---|
| `NovasysV2_AuditLog` table | ✅ Created in `us-east-1` | DynamoDB |
| 4 GSIs (`Tenant`, `Entity`, `Actor`, `Group`) | ✅ Active | DynamoDB |
| TTL on `expiresAt` | ✅ Enabled | DynamoDB |
| DynamoDB Streams `NEW_AND_OLD_IMAGES` | ✅ Enabled | DynamoDB |
| S3 bucket `novasys-audit-archive` | ⏳ Phase 3 | S3 |
| Archiver Lambda | ⏳ Phase 3 | Lambda |

## Table schema

```
NovasysV2_AuditLog
├── PK: AuditID (S)    e.g. AUDIT#TENANT#novasys#2026-01-15T10:22:33.000Z#a1b2c3d4
├── SK: SK (S)         always "META"
├── Billing: PAY_PER_REQUEST
├── TTL: expiresAt (unix seconds, 90 days after createdAt)
├── Streams: NEW_AND_OLD_IMAGES
└── GSIs:
    ├── Tenant-CreatedAt-index     PK=tenantId         SK=createdAt
    ├── Entity-CreatedAt-index     PK=entityPartition  SK=createdAt
    ├── Actor-CreatedAt-index      PK=actorId          SK=createdAt
    └── Group-index                PK=groupId
```

## Recreating from scratch

If you ever need to recreate the table (for another stage/region), the exact
command used in production is preserved below. It was executed via AWS CLI
authenticated with the credentials in `.env.local`.

```bash
aws dynamodb create-table \
  --table-name NovasysV2_AuditLog \
  --attribute-definitions \
    AttributeName=AuditID,AttributeType=S \
    AttributeName=SK,AttributeType=S \
    AttributeName=tenantId,AttributeType=S \
    AttributeName=createdAt,AttributeType=S \
    AttributeName=entityPartition,AttributeType=S \
    AttributeName=actorId,AttributeType=S \
    AttributeName=groupId,AttributeType=S \
  --key-schema \
    AttributeName=AuditID,KeyType=HASH \
    AttributeName=SK,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES \
  --global-secondary-indexes '[
    {"IndexName":"Tenant-CreatedAt-index","KeySchema":[{"AttributeName":"tenantId","KeyType":"HASH"},{"AttributeName":"createdAt","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}},
    {"IndexName":"Entity-CreatedAt-index","KeySchema":[{"AttributeName":"entityPartition","KeyType":"HASH"},{"AttributeName":"createdAt","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}},
    {"IndexName":"Actor-CreatedAt-index","KeySchema":[{"AttributeName":"actorId","KeyType":"HASH"},{"AttributeName":"createdAt","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"}},
    {"IndexName":"Group-index","KeySchema":[{"AttributeName":"groupId","KeyType":"HASH"}],"Projection":{"ProjectionType":"ALL"}}
  ]'

aws dynamodb wait table-exists --table-name NovasysV2_AuditLog

aws dynamodb update-time-to-live \
  --table-name NovasysV2_AuditLog \
  --time-to-live-specification "Enabled=true, AttributeName=expiresAt"
```

## Phase 3 (cold tier) — future work

When the hot tier fills up and you want long-term retention for compliance:

1. Create S3 bucket `novasys-audit-archive` with intelligent tiering + lifecycle.
2. Deploy a Lambda subscribed to the AuditLog Stream that converts each INSERT/MODIFY event to a JSONL line keyed by `tenantId/year/month/day/hour.jsonl`.
3. Point Athena at the bucket as an external table for ad-hoc queries.

Nothing in Phase 1/2 depends on this — they read/write exclusively against the hot DynamoDB table.
