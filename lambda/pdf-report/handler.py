"""
PDF Report Lambda — Improved version with better visual design.
Preserves the same column structure: Fecha | Entrada | Salida | Break | Trabajo | Estado | Razón/detalle
Preserves footer: Total periodo (min) | Total (horas)
"""

import os
import json
import calendar
from io import BytesIO
from datetime import date, datetime
import boto3
from boto3.dynamodb.conditions import Key
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

ddb = boto3.resource("dynamodb")
s3 = boto3.client("s3")
daily = ddb.Table(os.environ.get("TABLE_DAILY", "NovasysV2_DailySummary"))
REPORT_BUCKET = os.environ.get("REPORT_BUCKET", "novasys-v2-reports").strip()

# Corporate colors
PRIMARY = HexColor("#1a1a2e")
ACCENT = HexColor("#16213e")
HEADER_BG = HexColor("#0f3460")
ROW_ALT = HexColor("#f0f4f8")
TEXT_DARK = HexColor("#1a1a2e")
TEXT_LIGHT = HexColor("#64748b")
GREEN = HexColor("#16a34a")
RED = HexColor("#dc2626")
YELLOW = HexColor("#ca8a04")


def resp(code, body):
    return {
        "statusCode": code,
        "headers": {"content-type": "application/json", "cache-control": "no-store"},
        "body": json.dumps(body, ensure_ascii=False),
    }


def parse_iso_week(week_str):
    y, w = week_str.split("-W")
    monday = date.fromisocalendar(int(y), int(w), 1)
    sunday = date.fromisocalendar(int(y), int(w), 7)
    return monday, sunday


def parse_month(month_str):
    y, m = month_str.split("-")
    year, month = int(y), int(m)
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last_day)


def extract_time_value(item, local_key, plain_key):
    value = item.get(local_key)
    if value and value != "-":
        if "T" in value:
            try:
                dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
                return dt.strftime("%H:%M:%S")
            except Exception:
                try:
                    return value.split("T", 1)[1][:8]
                except Exception:
                    return str(value)
        return str(value)
    value = item.get(plain_key)
    if value and value != "-":
        return str(value)
    return "—"


def build_day_record(ds, it, current_date):
    if it:
        reason_text = it.get("regularizationReasonLabel", "")
        note = (it.get("regularizationNote") or "").strip()
        if note:
            reason_text = f"{reason_text} / {note}" if reason_text else note
        return {
            "date": ds,
            "firstIn": extract_time_value(it, "firstInLocal", "firstIn"),
            "lastOut": extract_time_value(it, "lastOutLocal", "lastOut"),
            "breakMinutes": int(it.get("breakMinutes", 0)),
            "workedMinutes": int(it.get("workedMinutes", 0)),
            "status": it.get("status", "MISSING"),
            "reason": reason_text,
        }

    if current_date.weekday() >= 5:
        return {
            "date": ds,
            "firstIn": "—",
            "lastOut": "—",
            "breakMinutes": 0,
            "workedMinutes": 0,
            "status": "No Laborable",
            "reason": "Fin de semana",
        }

    return {
        "date": ds,
        "firstIn": "—",
        "lastOut": "—",
        "breakMinutes": 0,
        "workedMinutes": 0,
        "status": "MISSING",
        "reason": "",
    }


def status_color(status):
    s = (status or "").upper()
    if s in ("OK", "REGULARIZED"):
        return GREEN
    if s in ("SHORT", "MISSING", "ABSENCE"):
        return RED
    if s in ("OPEN",):
        return YELLOW
    return TEXT_DARK


def build_pdf_bytes(employee_key, label_title, label_value, days):
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4
    margin = 35
    page_num = 1

    # Column positions
    cols = {
        "fecha": margin,
        "entrada": margin + 80,
        "salida": margin + 145,
        "break": margin + 210,
        "trabajo": margin + 265,
        "estado": margin + 325,
        "razon": margin + 400,
    }

    def draw_header(y):
        nonlocal page_num
        # Header bar
        c.setFillColor(HEADER_BG)
        c.rect(0, y - 5, width, 40, fill=True, stroke=False)

        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 14)
        c.drawString(margin, y + 10, "NOVASYS")
        c.setFont("Helvetica", 10)
        c.drawString(margin + 85, y + 10, "Reporte de Asistencia")

        y -= 25

        # Employee info
        c.setFillColor(TEXT_DARK)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(margin, y, f"Empleado: {employee_key}")
        c.setFont("Helvetica", 10)
        c.drawString(margin + 280, y, f"{label_title}: {label_value}")
        y -= 20

        # Table header
        c.setFillColor(ACCENT)
        c.rect(margin - 5, y - 4, width - 2 * margin + 10, 16, fill=True, stroke=False)

        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(cols["fecha"], y, "Fecha")
        c.drawString(cols["entrada"], y, "Entrada")
        c.drawString(cols["salida"], y, "Salida")
        c.drawString(cols["break"], y, "Break")
        c.drawString(cols["trabajo"], y, "Trabajo")
        c.drawString(cols["estado"], y, "Estado")
        c.drawString(cols["razon"], y, "Razón / detalle")

        y -= 18
        return y

    def draw_footer():
        nonlocal page_num
        c.setFillColor(TEXT_LIGHT)
        c.setFont("Helvetica", 7)
        ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
        c.drawString(margin, 25, f"Generado: {ts}")
        c.drawRightString(width - margin, 25, f"Página {page_num}")
        page_num += 1

    y = height - 50
    y = draw_header(y)

    total = 0
    row_idx = 0

    for d in days:
        reason = d.get("reason", "")
        if len(reason) > 42:
            reason = reason[:39] + "..."

        if y < 80:
            draw_footer()
            c.showPage()
            y = height - 50
            y = draw_header(y)
            row_idx = 0

        # Alternating row background
        if row_idx % 2 == 1:
            c.setFillColor(ROW_ALT)
            c.rect(margin - 5, y - 4, width - 2 * margin + 10, 14, fill=True, stroke=False)

        c.setFillColor(TEXT_DARK)
        c.setFont("Helvetica", 8)
        c.drawString(cols["fecha"], y, d["date"])
        c.drawString(cols["entrada"], y, str(d.get("firstIn", "—")))
        c.drawString(cols["salida"], y, str(d.get("lastOut", "—")))
        c.drawString(cols["break"], y, str(d.get("breakMinutes", 0)))
        c.drawString(cols["trabajo"], y, str(d.get("workedMinutes", 0)))

        # Status with color
        c.setFillColor(status_color(d.get("status")))
        c.setFont("Helvetica-Bold", 8)
        c.drawString(cols["estado"], y, str(d.get("status", "—")))

        c.setFillColor(TEXT_LIGHT)
        c.setFont("Helvetica", 7)
        c.drawString(cols["razon"], y, reason)

        total += int(d.get("workedMinutes") or 0)
        y -= 14
        row_idx += 1

    # Totals
    y -= 8
    c.setStrokeColor(ACCENT)
    c.setLineWidth(1)
    c.line(margin, y + 4, width - margin, y + 4)

    y -= 4
    c.setFillColor(PRIMARY)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(
        margin,
        y,
        f"Total periodo: {total} min   |   {round(total / 60, 2)} horas",
    )
    y -= 16

    c.setFillColor(TEXT_LIGHT)
    c.setFont("Helvetica", 8)
    c.drawString(
        margin,
        y,
        "Nota: horas basadas en registros y/o regularizaciones con trazabilidad. Hora de servidor en backend.",
    )

    draw_footer()
    c.showPage()
    c.save()
    buf.seek(0)
    return buf.read()


def handler(event, context):
    try:
        qs = event.get("queryStringParameters") or {}

        employee_key = (qs.get("employeeKey") or "").strip().lower()
        week = (qs.get("week") or "").strip()
        month = (qs.get("month") or "").strip()

        if not employee_key:
            return resp(400, {"ok": False, "error": "Falta employeeKey"})
        if not week and not month:
            return resp(400, {"ok": False, "error": "Falta week o month"})
        if week and month:
            return resp(400, {"ok": False, "error": "Envía solo week o month"})

        employee_id = employee_key
        if not employee_id.startswith("EMP#"):
            employee_id = f"EMP#{employee_key}"

        if week:
            start_d, end_d = parse_iso_week(week)
            label_title, label_value = "Semana", week
            report_key_part = week
        else:
            start_d, end_d = parse_month(month)
            label_title, label_value = "Mes", month
            report_key_part = month

        sk_from = f"DATE#{start_d.isoformat()}"
        sk_to = f"DATE#{end_d.isoformat()}"

        out = daily.query(
            KeyConditionExpression=Key("EmployeeID").eq(employee_id)
            & Key("WorkDate").between(sk_from, sk_to)
        )
        items = out.get("Items", [])
        by_date = {it["WorkDate"].replace("DATE#", ""): it for it in items}

        days = []
        d = start_d
        while d <= end_d:
            ds = d.isoformat()
            it = by_date.get(ds, {})
            days.append(build_day_record(ds, it, d))
            d = date.fromordinal(d.toordinal() + 1)

        pdf_bytes = build_pdf_bytes(employee_key, label_title, label_value, days)

        report_type = "weekly" if week else "monthly"
        safe_emp = employee_key.replace("@", "_at_").replace("#", "_")
        key = f"reports/{report_type}/{report_key_part}/{safe_emp}.pdf"

        s3.put_object(
            Bucket=REPORT_BUCKET,
            Key=key,
            Body=pdf_bytes,
            ContentType="application/pdf",
        )

        url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": REPORT_BUCKET, "Key": key},
            ExpiresIn=900,
        )

        return resp(
            200,
            {
                "ok": True,
                "url": url,
                "s3Key": key,
                "reportType": report_type,
                "employeeId": employee_id,
                "fromDate": start_d.isoformat(),
                "toDate": end_d.isoformat(),
            },
        )

    except Exception as e:
        return resp(500, {"ok": False, "error": str(e)})
