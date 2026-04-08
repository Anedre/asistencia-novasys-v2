# novasys-daily-notifications

Daily cron Lambda that scans tenants for birthdays, anniversaries, and stale
pending requests, and inserts corresponding rows into `NovasysV2_UserNotifications`.

## Schedule

EventBridge rule `novasys-daily-notifications-trigger` fires the Lambda once a
day at **13:00 UTC** (= 08:00 Lima, UTC-5, no DST).

## Idempotency

Each notification uses a deterministic `notificationId` derived from
`{type}#{YYYY-MM-DD}#{participants}`. Running the Lambda twice on the same day
overwrites the previous row (same PK) instead of duplicating.

## Deploy (manual, one-time)

```bash
# 1. Package
cd infrastructure/daily-notifications-lambda
zip -r function.zip index.js package.json

# 2. IAM role
aws iam create-role --role-name novasys-daily-notifications-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

aws iam attach-role-policy --role-name novasys-daily-notifications-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

aws iam put-role-policy --role-name novasys-daily-notifications-role \
  --policy-name dynamodb-access --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": [
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:BatchWriteItem",
        "dynamodb:PutItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:us-east-1:*:table/NovasysV2_Tenants",
        "arn:aws:dynamodb:us-east-1:*:table/NovasysV2_Employees",
        "arn:aws:dynamodb:us-east-1:*:table/NovasysV2_Employees/index/*",
        "arn:aws:dynamodb:us-east-1:*:table/NovasysV2_ApprovalRequests",
        "arn:aws:dynamodb:us-east-1:*:table/NovasysV2_ApprovalRequests/index/*",
        "arn:aws:dynamodb:us-east-1:*:table/NovasysV2_UserNotifications"
      ]
    }]
  }'

# 3. Lambda function
aws lambda create-function \
  --function-name novasys-daily-notifications \
  --runtime nodejs20.x \
  --role arn:aws:iam::ACCOUNT_ID:role/novasys-daily-notifications-role \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --timeout 60 \
  --environment 'Variables={TABLE_PREFIX=NovasysV2_}'

# 4. EventBridge rule + target
aws events put-rule \
  --name novasys-daily-notifications-trigger \
  --schedule-expression "cron(0 13 * * ? *)"

aws lambda add-permission \
  --function-name novasys-daily-notifications \
  --statement-id eventbridge-daily \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:us-east-1:ACCOUNT_ID:rule/novasys-daily-notifications-trigger

aws events put-targets \
  --rule novasys-daily-notifications-trigger \
  --targets 'Id=1,Arn=arn:aws:lambda:us-east-1:ACCOUNT_ID:function:novasys-daily-notifications'
```

## Test

```bash
aws lambda invoke \
  --function-name novasys-daily-notifications \
  --payload '{}' response.json

cat response.json
aws logs tail /aws/lambda/novasys-daily-notifications --since 5m
```
