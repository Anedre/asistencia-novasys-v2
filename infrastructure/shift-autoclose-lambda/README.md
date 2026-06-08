# novasys-shift-autoclose

Every-10-minute Lambda that closes attendance shifts **as soon as the employee
reaches their laborable hours** — distinct from `novasys-shift-closer`, which
runs once nightly and closes anything left open at end of day.

## Schedule

EventBridge rule `novasys-shift-autoclose-trigger` fires `rate(10 minutes)`.

## Behaviour

Per ACTIVE tenant **with `settings.workSchedule.autoCloseAtGoal === true`**:

1. Query `NovasysV2_DailySummary` (`Tenant-WorkDate-index`) for today's (Lima)
   rows with `status = "OPEN"` and no `autoClosedAt`.
2. For each, compute `closeMin = firstIn + plannedMinutes + breakTaken`
   (worked excludes break, so the break actually taken is added back). The goal
   falls back to `shiftEnd − shiftStart − break` when `plannedMinutes` is absent.
3. If Lima "now" ≥ `closeMin`, mark the day closed at exactly that time:
   `lastOut`, `workedMinutes = goal`, `status = OK`, `autoCloseSource =
   "GOAL_REACHED"`, anomaly `"Auto-cerrado al cumplir horas laborables"`,
   `source = AUTO_CLOSE`. A `ConditionExpression` guards against a manual END
   landing first. Employees currently **on break** are skipped.
4. Notify the employee + tenant admins (`NovasysV2_UserNotifications`, TTL 30d).

Toggle lives in **Settings → Horarios** ("Cerrar jornada automáticamente al
cumplir las horas laborables"), persisted to
`tenant.settings.workSchedule.autoCloseAtGoal`. Default OFF.

## Deploy (one-time)

```bash
cd infrastructure/shift-autoclose-lambda
# zip index.js + package.json (PowerShell: Compress-Archive -Path index.js,package.json -DestinationPath function.zip -Force)

aws iam create-role --role-name novasys-shift-autoclose-role \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
aws iam attach-role-policy --role-name novasys-shift-autoclose-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam put-role-policy --role-name novasys-shift-autoclose-role \
  --policy-name dynamodb-access --policy-document file://ddb.json   # Tenants, Employees(+idx), DailySummary(+idx), UserNotifications

aws lambda create-function --function-name novasys-shift-autoclose \
  --runtime nodejs20.x --role arn:aws:iam::ACCOUNT_ID:role/novasys-shift-autoclose-role \
  --handler index.handler --zip-file fileb://function.zip --timeout 300 --memory-size 256

aws events put-rule --name novasys-shift-autoclose-trigger --schedule-expression "rate(10 minutes)"
aws events put-targets --rule novasys-shift-autoclose-trigger \
  --targets "Id=1,Arn=arn:aws:lambda:REGION:ACCOUNT_ID:function:novasys-shift-autoclose"
aws lambda add-permission --function-name novasys-shift-autoclose \
  --statement-id allow-eventbridge --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:REGION:ACCOUNT_ID:rule/novasys-shift-autoclose-trigger
```

## Update after code change

```bash
# Compress-Archive -Path index.js,package.json -DestinationPath function.zip -Force
aws lambda update-function-code --function-name novasys-shift-autoclose --zip-file fileb://function.zip
```

## Test invoke

```bash
aws lambda invoke --function-name novasys-shift-autoclose --payload '{}' /tmp/out.json && cat /tmp/out.json
```
