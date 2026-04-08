# novasys-audit-archiver

Lambda triggered by the `NovasysV2_AuditLog` DynamoDB Stream. For each row it
receives, it writes a JSON Lines entry to S3 so that the cold tier has the
complete history beyond the 90-day DynamoDB TTL.

## S3 layout

```
s3://novasys-v2-audit-archive/
  tenantId={id}/year=YYYY/month=MM/day=DD/{HH}.jsonl
```

Each file is append-only JSON Lines. Idempotent on `AuditID` so retried batches
don't duplicate entries.

## Deployment (manual — one time)

```bash
# 1. Install deps
cd infrastructure/audit-archiver-lambda
npm install --production

# 2. Package
zip -r function.zip .

# 3. Create IAM role (if not already done)
aws iam create-role --role-name novasys-audit-archiver-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

aws iam attach-role-policy --role-name novasys-audit-archiver-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

aws iam attach-role-policy --role-name novasys-audit-archiver-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaDynamoDBExecutionRole

aws iam put-role-policy --role-name novasys-audit-archiver-role \
  --policy-name s3-audit-archive-rw --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": "arn:aws:s3:::novasys-v2-audit-archive/*"
    }]
  }'

# 4. Create the function
aws lambda create-function \
  --function-name novasys-audit-archiver \
  --runtime nodejs20.x \
  --role arn:aws:iam::731736972577:role/novasys-audit-archiver-role \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --environment 'Variables={AUDIT_ARCHIVE_BUCKET=novasys-v2-audit-archive}' \
  --timeout 30

# 5. Subscribe to the stream
STREAM_ARN=$(aws dynamodb describe-table --table-name NovasysV2_AuditLog \
  --query 'Table.LatestStreamArn' --output text)

aws lambda create-event-source-mapping \
  --function-name novasys-audit-archiver \
  --event-source-arn "$STREAM_ARN" \
  --starting-position LATEST \
  --batch-size 50
```

After this, every write to `NovasysV2_AuditLog` will be archived to S3 within
a few seconds. The table retains rows for 90 days (via TTL on `expiresAt`),
then they're removed from Dynamo but permanently live in S3.
