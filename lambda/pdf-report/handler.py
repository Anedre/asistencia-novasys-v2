"""
PDF Report Lambda — Professional attendance report with clean corporate design.
Columns: Fecha | Dia | Entrada | Salida | Break | Horas | Estado | Observaciones
Footer: summary stats + total hours
"""

import os
import json
import calendar
from io import BytesIO
from datetime import date, datetime
import boto3
from boto3.dynamodb.conditions import Key
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor, white, Color
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT

ddb = boto3.resource("dynamodb")
s3 = boto3.client("s3")
emp_table = ddb.Table(os.environ.get("TABLE_EMPLOYEES", "NovasysV2_Employees"))
daily = ddb.Table(os.environ.get("TABLE_DAILY", "NovasysV2_DailySummary"))
REPORT_BUCKET = os.environ.get("REPORT_BUCKET", "novasys-v2-reports").strip()

# Professional color palette
BRAND_DARK = HexColor("#0f172a")
BRAND_PRIMARY = HexColor("#1e3a5f")
BRAND_ACCENT = HexColor("#2563eb")
HEADER_BG = HexColor("#1e3a5f")
TABLE_HEADER_BG = HexColor("#334155")
ROW_EVEN = HexColor("#ffffff")
ROW_ODD = HexColor("#f8fafc")
BORDER_COLOR = HexColor("#e2e8f0")
TEXT_PRIMARY = HexColor("#0f172a")
TEXT_SECONDARY = HexColor("#64748b")
TEXT_MUTED = HexColor("#94a3b8")
GREEN = HexColor("#059669")
GREEN_BG = HexColor("#ecfdf5")
RED = HexColor("#dc2626")
RED_BG = HexColor("#fef2f2")
AMBER = HexColor("#d97706")
AMBER_BG = HexColor("#fffbeb")
BLUE = HexColor("#2563eb")
BLUE_BG = HexColor("#eff6ff")
GRAY = HexColor("#6b7280")
GRAY_BG = HexColor("#f9fafb")

DAY_NAMES_ES = {
    0: "Lunes", 1: "Martes", 2: "Miércoles", 3: "Jueves",
    4: "Viernes", 5: "Sábado", 6: "Domingo",
}

STATUS_LABELS = {
    "OK": "Completo",
    "REGULARIZED": "Regularizado",
    "SHORT": "Incompleto",
    "MISSING": "Sin registro",
    "ABSENCE": "Ausencia",
    "OPEN": "En curso",
    "No Laborable": "No laborable",
}


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
                return dt.strftime("%H:%M")
            except Exception:
                try:
                    return value.split("T", 1)[1][:5]
                except Exception:
                    return str(value)
        if len(value) > 5:
            return value[:5]
        return str(value)
    value = item.get(plain_key)
    if value and value != "-":
        v = str(value)
        return v[:5] if len(v) > 5 else v
    return "—"


def format_hours(minutes):
    if minutes == 0:
        return "—"
    h = minutes // 60
    m = minutes % 60
    if m == 0:
        return f"{h}h"
    return f"{h}h {m:02d}m"


def format_date_es(d):
    months = [
        "", "Ene", "Feb", "Mar", "Abr", "May", "Jun",
        "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
    ]
    return f"{d.day} {months[d.month]} {d.year}"


def build_day_record(ds, it, current_date):
    day_name = DAY_NAMES_ES.get(current_date.weekday(), "")

    if it:
        reason_text = it.get("regularizationReasonLabel", "")
        note = (it.get("regularizationNote") or "").strip()
        if note:
            reason_text = f"{reason_text} — {note}" if reason_text else note
        return {
            "date": ds,
            "dayName": day_name,
            "firstIn": extract_time_value(it, "firstInLocal", "firstIn"),
            "lastOut": extract_time_value(it, "lastOutLocal", "lastOut"),
            "breakMinutes": int(it.get("breakMinutes", 0)),
            "workedMinutes": int(it.get("workedMinutes", 0)),
            "status": it.get("status", "MISSING"),
            "reason": reason_text,
            "isWeekend": current_date.weekday() >= 5,
        }

    if current_date.weekday() >= 5:
        return {
            "date": ds,
            "dayName": day_name,
            "firstIn": "—",
            "lastOut": "—",
            "breakMinutes": 0,
            "workedMinutes": 0,
            "status": "No Laborable",
            "reason": "",
            "isWeekend": True,
        }

    return {
        "date": ds,
        "dayName": day_name,
        "firstIn": "—",
        "lastOut": "—",
        "breakMinutes": 0,
        "workedMinutes": 0,
        "status": "MISSING",
        "reason": "",
        "isWeekend": False,
    }


def status_style(status):
    s = (status or "").upper()
    if s in ("OK", "REGULARIZED"):
        return GREEN, GREEN_BG
    if s in ("SHORT",):
        return AMBER, AMBER_BG
    if s in ("MISSING", "ABSENCE"):
        return RED, RED_BG
    if s in ("OPEN",):
        return BLUE, BLUE_BG
    return GRAY, GRAY_BG


def get_employee_info(employee_id):
    try:
        out = emp_table.get_item(Key={"EmployeeID": employee_id})
        return out.get("Item", {})
    except Exception:
        return {}


def draw_rounded_rect(c, x, y, w, h, r, fill_color):
    c.setFillColor(fill_color)
    c.setStrokeColor(fill_color)
    c.roundRect(x, y, w, h, r, fill=True, stroke=False)


def build_pdf_bytes(employee_key, employee_info, label_title, label_value, days, start_d, end_d):
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4
    margin = 40
    right_margin = width - margin
    usable_width = right_margin - margin
    page_num = 1

    emp_name = employee_info.get("FullName", employee_key)
    emp_area = employee_info.get("Area", "—")
    emp_position = employee_info.get("Position", "—")
    emp_dni = employee_info.get("DNI", "—")

    # Column widths (proportional)
    col_widths = {
        "fecha": 62,
        "dia": 58,
        "entrada": 52,
        "salida": 52,
        "break": 42,
        "horas": 50,
        "estado": 72,
        "obs": usable_width - 62 - 58 - 52 - 52 - 42 - 50 - 72,
    }

    col_x = {}
    x = margin
    for key in ["fecha", "dia", "entrada", "salida", "break", "horas", "estado", "obs"]:
        col_x[key] = x
        x += col_widths[key]

    row_height = 18

    def draw_header_bar(y):
        # Top brand bar
        c.setFillColor(HEADER_BG)
        c.rect(0, y, width, 60, fill=True, stroke=False)

        # Company name
        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 18)
        c.drawString(margin, y + 38, "NOVASYS")

        c.setFont("Helvetica", 9)
        c.drawString(margin, y + 22, "Sistema de Control de Asistencia")

        # Report type badge on right
        c.setFont("Helvetica-Bold", 10)
        report_label = f"Reporte {label_title}"
        c.drawRightString(right_margin, y + 38, report_label)

        c.setFont("Helvetica", 9)
        c.drawRightString(right_margin, y + 22, label_value)

        # Thin accent line below header
        c.setFillColor(BRAND_ACCENT)
        c.rect(0, y - 3, width, 3, fill=True, stroke=False)

        return y - 3

    def draw_employee_card(y):
        # Employee info card
        card_h = 52
        card_y = y - card_h - 12

        # Card background
        c.setFillColor(HexColor("#f8fafc"))
        c.setStrokeColor(BORDER_COLOR)
        c.setLineWidth(0.5)
        c.roundRect(margin, card_y, usable_width, card_h, 4, fill=True, stroke=True)

        # Left column: name + position
        inner_y = card_y + card_h - 14
        c.setFillColor(TEXT_PRIMARY)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(margin + 12, inner_y, emp_name)

        inner_y -= 14
        c.setFillColor(TEXT_SECONDARY)
        c.setFont("Helvetica", 8)
        c.drawString(margin + 12, inner_y, f"{emp_position}  •  {emp_area}")

        inner_y -= 12
        c.setFont("Helvetica", 7.5)
        c.drawString(margin + 12, inner_y, f"Email: {employee_key}   |   DNI: {emp_dni}")

        # Right column: period
        c.setFillColor(TEXT_SECONDARY)
        c.setFont("Helvetica", 8)
        period_text = f"Período: {format_date_es(start_d)} — {format_date_es(end_d)}"
        c.drawRightString(right_margin - 12, card_y + card_h - 14, period_text)

        return card_y - 10

    def draw_table_header(y):
        # Table header background
        c.setFillColor(TABLE_HEADER_BG)
        c.roundRect(margin, y - 4, usable_width, row_height + 2, 3, fill=True, stroke=False)

        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 7.5)

        headers = [
            ("fecha", "FECHA"),
            ("dia", "DÍA"),
            ("entrada", "ENTRADA"),
            ("salida", "SALIDA"),
            ("break", "BREAK"),
            ("horas", "HORAS"),
            ("estado", "ESTADO"),
            ("obs", "OBSERVACIONES"),
        ]
        for key, label in headers:
            c.drawString(col_x[key] + 4, y + 2, label)

        return y - row_height

    def draw_page_header(y):
        y = draw_header_bar(y)
        y = draw_employee_card(y)
        y = draw_table_header(y)
        return y

    def draw_footer():
        nonlocal page_num
        # Footer line
        c.setStrokeColor(BORDER_COLOR)
        c.setLineWidth(0.5)
        c.line(margin, 42, right_margin, 42)

        c.setFillColor(TEXT_MUTED)
        c.setFont("Helvetica", 6.5)
        ts = datetime.utcnow().strftime("%d/%m/%Y %H:%M UTC")
        c.drawString(margin, 30, f"Generado automáticamente el {ts}")
        c.drawString(margin, 21, "Novasys Asistencia v2 — Documento confidencial")
        c.drawRightString(right_margin, 30, f"Página {page_num}")
        page_num += 1

    # Start building the PDF
    y = height - 10
    y = draw_page_header(y)

    total_worked = 0
    total_break = 0
    days_worked = 0
    days_complete = 0
    days_missing = 0
    row_idx = 0

    for d in days:
        if y < 90:
            draw_footer()
            c.showPage()
            y = height - 10
            y = draw_page_header(y)
            row_idx = 0

        # Row background
        bg = ROW_ODD if row_idx % 2 == 1 else ROW_EVEN
        if d.get("isWeekend"):
            bg = HexColor("#f1f5f9")
        c.setFillColor(bg)
        c.rect(margin, y - 4, usable_width, row_height, fill=True, stroke=False)

        # Bottom border
        c.setStrokeColor(BORDER_COLOR)
        c.setLineWidth(0.3)
        c.line(margin, y - 4, right_margin, y - 4)

        status = d.get("status", "MISSING")
        worked = int(d.get("workedMinutes", 0))
        brk = int(d.get("breakMinutes", 0))

        # Date
        c.setFillColor(TEXT_PRIMARY)
        c.setFont("Helvetica", 8)
        c.drawString(col_x["fecha"] + 4, y + 2, d["date"])

        # Day name
        c.setFillColor(TEXT_SECONDARY if not d.get("isWeekend") else TEXT_MUTED)
        c.setFont("Helvetica", 7.5)
        c.drawString(col_x["dia"] + 4, y + 2, d.get("dayName", ""))

        # Entry/exit
        c.setFillColor(TEXT_PRIMARY)
        c.setFont("Helvetica", 8)
        c.drawString(col_x["entrada"] + 4, y + 2, str(d.get("firstIn", "—")))
        c.drawString(col_x["salida"] + 4, y + 2, str(d.get("lastOut", "—")))

        # Break
        c.setFont("Helvetica", 7.5)
        c.setFillColor(TEXT_SECONDARY)
        brk_text = f"{brk} min" if brk > 0 else "—"
        c.drawString(col_x["break"] + 4, y + 2, brk_text)

        # Hours worked
        c.setFillColor(TEXT_PRIMARY)
        c.setFont("Helvetica-Bold" if worked > 0 else "Helvetica", 8)
        c.drawString(col_x["horas"] + 4, y + 2, format_hours(worked))

        # Status badge
        status_label = STATUS_LABELS.get(status, status)
        fg, bg_color = status_style(status)

        badge_w = min(len(status_label) * 4.5 + 10, col_widths["estado"] - 6)
        badge_x = col_x["estado"] + 3
        badge_y = y - 1

        draw_rounded_rect(c, badge_x, badge_y, badge_w, 12, 2, bg_color)
        c.setFillColor(fg)
        c.setFont("Helvetica-Bold", 6.5)
        c.drawString(badge_x + 4, y + 1.5, status_label)

        # Observations
        reason = d.get("reason", "")
        if len(reason) > 35:
            reason = reason[:32] + "..."
        c.setFillColor(TEXT_MUTED)
        c.setFont("Helvetica", 6.5)
        c.drawString(col_x["obs"] + 4, y + 2, reason)

        # Accumulate stats
        total_worked += worked
        total_break += brk
        if worked > 0:
            days_worked += 1
        s_upper = status.upper()
        if s_upper in ("OK", "REGULARIZED"):
            days_complete += 1
        if s_upper == "MISSING":
            days_missing += 1

        y -= row_height
        row_idx += 1

    # Summary section
    y -= 12

    # Summary card
    summary_h = 58
    if y - summary_h < 60:
        draw_footer()
        c.showPage()
        y = height - 60

    c.setFillColor(HexColor("#f0f4ff"))
    c.setStrokeColor(BRAND_ACCENT)
    c.setLineWidth(0.8)
    c.roundRect(margin, y - summary_h, usable_width, summary_h, 4, fill=True, stroke=True)

    # Summary title
    sy = y - 14
    c.setFillColor(BRAND_PRIMARY)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin + 12, sy, "Resumen del Período")

    # Stats row
    sy -= 18
    stats = [
        ("Días trabajados", str(days_worked)),
        ("Días completos", str(days_complete)),
        ("Sin registro", str(days_missing)),
        ("Total horas", format_hours(total_worked)),
        ("Total break", format_hours(total_break)),
    ]

    stat_width = (usable_width - 24) / len(stats)
    for i, (label, value) in enumerate(stats):
        sx = margin + 12 + i * stat_width

        c.setFillColor(BRAND_PRIMARY)
        c.setFont("Helvetica-Bold", 12)
        c.drawString(sx, sy, value)

        c.setFillColor(TEXT_SECONDARY)
        c.setFont("Helvetica", 7)
        c.drawString(sx, sy - 11, label)

    # Legal note
    y = y - summary_h - 14
    c.setFillColor(TEXT_MUTED)
    c.setFont("Helvetica-Oblique", 6.5)
    c.drawString(
        margin,
        y,
        "Las horas registradas se basan en marcaciones del sistema y/o regularizaciones aprobadas con trazabilidad completa.",
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

        # Fetch employee info for the report header
        employee_info = get_employee_info(employee_id)

        if week:
            start_d, end_d = parse_iso_week(week)
            label_title, label_value = "Semanal", week
            report_key_part = week
        else:
            start_d, end_d = parse_month(month)
            label_title, label_value = "Mensual", month
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

        pdf_bytes = build_pdf_bytes(
            employee_key, employee_info, label_title, label_value, days, start_d, end_d
        )

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
