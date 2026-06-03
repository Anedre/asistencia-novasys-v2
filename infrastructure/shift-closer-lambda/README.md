# novasys-shift-closer

Nightly cron Lambda that auto-closes attendance shifts left open at the end
of the working day. Mirrors the pattern of `daily-notifications-lambda`.

## Schedule

EventBridge rule `novasys-shift-closer-trigger` fires once a day at
**04:00 UTC** (= **23:00 Lima**, UTC-5, no DST). It runs on the same
calendar day as the workday it closes — see `todayLima()` in `index.js`.

## Behaviour

For each ACTIVE tenant:

1. Query `NovasysV2_DailySummary` via `Tenant-WorkDate-index` for today's
   rows with `status = "OPEN"` AND `attribute_not_exists(autoClosedAt)`.
2. Read the per-row policy from
   `tenant.settings.workSchedule.autoCloseShifts`:
   - **soft** (`true`, default) → fill `lastOutUtc/Local` with the
     best-known shift end:
     1. Query `NovasysV2_AttendanceEvents` for the latest event
        timestamp for that employee/workDate.
     2. If the last event is **later than scheduleEnd**, use it (so
        overtime is preserved — a `BREAK_END` at 19:00 keeps the day
        open until 19:00, not 18:00).
     3. Otherwise fall back to scheduleEnd.
     4. Always capped to "now" so we never invent future hours.
     The resulting `autoCloseSource` field is `"LAST_EVENT"` or
     `"SCHEDULE_END"` so the admin can audit how the close time was
     chosen. Anomaly tag is `"Auto-cerrado al último evento — revisar"`
     or `"Auto-cerrado a la hora planificada — revisar"` accordingly.
   - **strict** (`false`) → demote to `MISSING`, zero out `workedMinutes`,
     push the anomaly `"Auto-cerrado: jornada no finalizada"`.
3. Stamp `autoClosedAt = <iso>` for idempotency.
4. Write one notification to the employee + one per admin to
   `NovasysV2_UserNotifications` (TTL 30 days). The employee message
   tells them whether the close time came from their last activity or
   their schedule.

Re-running the same day is a no-op because every closed row already has
`autoClosedAt`.

## Deploy (manual, one-time)

```bash
cd infrastructure/shift-closer-lambda
zip -r function.zip index.js package.json

# IAM role
aws iam create-role --role-name novasys-shift-closer-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

aws iam attach-role-policy --role-name novasys-shift-closer-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

aws iam put-role-policy --role-name novasys-shift-closer-role \
  --policy-name dynamodb-access --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": [
        "dynamodb:Scan",
        "dynamodb:Query",
        "dynamodb:GetItem",
        "dynamodb:UpdateItem",
        "dynamodb:BatchWriteItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/NovasysV2_Tenants",
        "arn:aws:dynamodb:*:*:table/NovasysV2_Employees",
        "arn:aws:dynamodb:*:*:table/NovasysV2_Employees/index/*",
        "arn:aws:dynamodb:*:*:table/NovasysV2_DailySummary",
        "arn:aws:dynamodb:*:*:table/NovasysV2_DailySummary/index/*",
        "arn:aws:dynamodb:*:*:table/NovasysV2_AttendanceEvents",
        "arn:aws:dynamodb:*:*:table/NovasysV2_AttendanceEvents/index/*",
        "arn:aws:dynamodb:*:*:table/NovasysV2_UserNotifications"
      ]
    }]
  }'

# Lambda
aws lambda create-function \
  --function-name novasys-shift-closer \
  --runtime nodejs20.x \
  --role arn:aws:iam::ACCOUNT_ID:role/novasys-shift-closer-role \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --timeout 300 \
  --memory-size 256

# EventBridge rule: 23:00 Lima = 04:00 UTC
aws events put-rule \
  --name novasys-shift-closer-trigger \
  --schedule-expression "cron(0 4 * * ? *)"

aws events put-targets \
  --rule novasys-shift-closer-trigger \
  --targets "Id=1,Arn=arn:aws:lambda:REGION:ACCOUNT_ID:function:novasys-shift-closer"

aws lambda add-permission \
  --function-name novasys-shift-closer \
  --statement-id allow-eventbridge \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:REGION:ACCOUNT_ID:rule/novasys-shift-closer-trigger
```

## Update after code change

```bash
cd infrastructure/shift-closer-lambda
zip -r function.zip index.js package.json
aws lambda update-function-code \
  --function-name novasys-shift-closer \
  --zip-file fileb://function.zip
```

## Test invoke

```bash
aws lambda invoke \
  --function-name novasys-shift-closer \
  --payload '{}' \
  /tmp/out.json && cat /tmp/out.json
```

## Per-tenant configuration

The Lambda reads these fields from `tenant.settings.workSchedule`:

| Field | Default | Effect |
|---|---|---|
| `autoCloseShifts` | `true` | `true` = soft mode (auto-set lastOutUtc to schedule end), `false` = strict mode (MISSING) |
| `endTime` | `"18:00"` | Used as the soft auto-close time when the employee has no personal `Schedule.endTime` |

Per-employee `Schedule.endTime` takes priority over the tenant fallback.
