"""
PDF Report Lambda — Professional attendance report with structured corporate layout.
"""

import os
import json
import calendar
from io import BytesIO
from datetime import date, datetime
import boto3
from boto3.dynamodb.conditions import Key
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor, white
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

ddb = boto3.resource("dynamodb")
s3 = boto3.client("s3")
emp_table = ddb.Table(os.environ.get("TABLE_EMPLOYEES", "NovasysV2_Employees"))
daily = ddb.Table(os.environ.get("TABLE_DAILY", "NovasysV2_DailySummary"))
REPORT_BUCKET = os.environ.get("REPORT_BUCKET", "novasys-v2-reports").strip()

# ── Colors ──
BRAND = HexColor("#1e3a5f")
BRAND_DARK = HexColor("#0f172a")
ACCENT = HexColor("#2563eb")
TH_BG = HexColor("#1e3a5f")
ROW_EVEN = HexColor("#ffffff")
ROW_ODD = HexColor("#f8fafc")
WEEKEND_BG = HexColor("#f1f5f9")
BORDER = HexColor("#cbd5e1")
BORDER_LIGHT = HexColor("#e2e8f0")
TXT = HexColor("#0f172a")
TXT2 = HexColor("#475569")
TXT3 = HexColor("#94a3b8")
GREEN = HexColor("#059669")
GREEN_BG = HexColor("#ecfdf5")
RED = HexColor("#dc2626")
RED_BG = HexColor("#fef2f2")
AMBER = HexColor("#d97706")
AMBER_BG = HexColor("#fffbeb")
BLUE = HexColor("#2563eb")
BLUE_BG = HexColor("#eff6ff")
GRAY = HexColor("#6b7280")
GRAY_BG = HexColor("#f3f4f6")
SUMMARY_BG = HexColor("#f0f4ff")

DAY_ES = {0: "Lunes", 1: "Martes", 2: "Miércoles", 3: "Jueves",
           4: "Viernes", 5: "Sábado", 6: "Domingo"}

MONTH_ES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
            "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

STATUS_LABEL = {
    "OK": "Completo", "REGULARIZED": "Regularizado", "SHORT": "Incompleto",
    "MISSING": "Sin registro", "ABSENCE": "Ausencia", "OPEN": "En curso",
    "No Laborable": "No laborable",
}

WORK_MODE_LABEL = {
    "REMOTE": "Remoto", "ONSITE": "Presencial", "HYBRID": "Híbrido",
}


def resp(code, body):
    return {"statusCode": code, "headers": {"content-type": "application/json", "cache-control": "no-store"},
            "body": json.dumps(body, ensure_ascii=False)}


def parse_iso_week(week_str):
    y, w = week_str.split("-W")
    return date.fromisocalendar(int(y), int(w), 1), date.fromisocalendar(int(y), int(w), 7)


def parse_month(month_str):
    y, m = month_str.split("-")
    year, month = int(y), int(m)
    return date(year, month, 1), date(year, month, calendar.monthrange(year, month)[1])


def extract_time(item, local_key, plain_key):
    for k in (local_key, plain_key):
        v = item.get(k)
        if v and v != "-":
            if "T" in str(v):
                try:
                    return datetime.fromisoformat(str(v).replace("Z", "+00:00")).strftime("%H:%M")
                except Exception:
                    try:
                        return str(v).split("T", 1)[1][:5]
                    except Exception:
                        return str(v)
            s = str(v)
            return s[:5] if len(s) > 5 else s
    return "—"


def fmt_hours(minutes):
    if not minutes:
        return "—"
    h, m = divmod(int(minutes), 60)
    return f"{h}h {m:02d}m" if m else f"{h}h"


def fmt_date_long(d):
    return f"{d.day} de {MONTH_ES[d.month]} {d.year}"


def status_colors(status):
    s = (status or "").upper()
    if s in ("OK", "REGULARIZED"):
        return GREEN, GREEN_BG
    if s == "SHORT":
        return AMBER, AMBER_BG
    if s in ("MISSING", "ABSENCE"):
        return RED, RED_BG
    if s == "OPEN":
        return BLUE, BLUE_BG
    return GRAY, GRAY_BG


def get_employee_info(employee_id):
    try:
        return emp_table.get_item(Key={"EmployeeID": employee_id}).get("Item", {})
    except Exception:
        return {}


def build_day(ds, item, current_date):
    day_name = DAY_ES.get(current_date.weekday(), "")
    is_weekend = current_date.weekday() >= 5

    if item:
        reason = item.get("regularizationReasonLabel", "")
        note = (item.get("regularizationNote") or "").strip()
        if note:
            reason = f"{reason} — {note}" if reason else note
        return {
            "date": ds, "day": day_name,
            "in": extract_time(item, "firstInLocal", "firstIn"),
            "out": extract_time(item, "lastOutLocal", "lastOut"),
            "brk": int(item.get("breakMinutes", 0)),
            "wrk": int(item.get("workedMinutes", 0)),
            "status": item.get("status", "MISSING"),
            "reason": reason, "weekend": is_weekend,
        }

    return {
        "date": ds, "day": day_name, "in": "—", "out": "—",
        "brk": 0, "wrk": 0,
        "status": "No Laborable" if is_weekend else "MISSING",
        "reason": "", "weekend": is_weekend,
    }


# ═══════════════════════════════════════════════════════
# PDF Builder
# ═══════════════════════════════════════════════════════

def build_pdf(emp_key, emp_info, report_title, period_label, days, start_d, end_d):
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    W, H = A4
    LM = 40          # left margin
    RM = W - 40       # right margin
    UW = RM - LM      # usable width
    ROW_H = 17
    page = [1]

    name = emp_info.get("FullName") or emp_key
    area = emp_info.get("Area") or "—"
    position = emp_info.get("Position") or "—"
    dni = emp_info.get("DNI") or "—"
    email = emp_info.get("Email") or emp_key
    work_mode = WORK_MODE_LABEL.get(emp_info.get("WorkMode", ""), emp_info.get("WorkMode", "—"))

    # Column layout
    cols = [
        ("FECHA", 62), ("DÍA", 56), ("ENTRADA", 50), ("SALIDA", 50),
        ("BREAK", 42), ("HORAS", 48), ("ESTADO", 70),
    ]
    obs_w = UW - sum(w for _, w in cols)
    cols.append(("OBS.", obs_w))

    col_x = []
    cx = LM
    for _, w in cols:
        col_x.append(cx)
        cx += w

    # ── Drawing helpers ──

    def hline(y, color=BORDER_LIGHT, width=0.5):
        c.setStrokeColor(color)
        c.setLineWidth(width)
        c.line(LM, y, RM, y)

    def draw_top_section(y):
        """Title block + employee info — structured formal document."""
        # ─── Top accent line ───
        c.setFillColor(BRAND)
        c.rect(0, y, W, 2.5, fill=True, stroke=False)
        y -= 2.5

        # ─── Title row ───
        y -= 20
        c.setFillColor(BRAND_DARK)
        c.setFont("Helvetica-Bold", 12)
        c.drawString(LM, y, "Novasys")

        c.setFillColor(TXT2)
        c.setFont("Helvetica", 11)
        c.drawString(LM + c.stringWidth("Novasys", "Helvetica-Bold", 12) + 4, y, f"— Reporte de Asistencia ({work_mode})")

        c.setFillColor(BRAND)
        c.setFont("Helvetica-Bold", 8.5)
        c.drawRightString(RM, y + 1, f"Reporte {report_title}")

        # ─── Separator ───
        y -= 8
        hline(y, BORDER, 0.6)

        # ─── Employee info — 3 columns x 3 rows ───
        FS = 7.5       # font size
        LBL_F = "Helvetica-Bold"
        VAL_F = "Helvetica"
        RH = 12        # row height

        # Column positions (3 columns across the page)
        c1 = LM
        c2 = LM + 190
        c3 = LM + 370

        def info_row(y, pairs):
            """Draw a row of label: value pairs at given column positions."""
            col_positions = [c1, c2, c3]
            for i, (lbl, val) in enumerate(pairs):
                if i >= len(col_positions):
                    break
                cx = col_positions[i]
                c.setFont(LBL_F, FS)
                c.setFillColor(TXT2)
                lbl_w = c.stringWidth(lbl, LBL_F, FS)
                c.drawString(cx, y, lbl)
                c.setFont(VAL_F, FS)
                c.setFillColor(TXT)
                c.drawString(cx + lbl_w + 3, y, str(val))

        y -= RH
        info_row(y, [
            ("Empleado: ", name),
            ("Cargo: ", position),
            ("Modalidad: ", work_mode),
        ])

        y -= RH
        info_row(y, [
            ("Email: ", email),
            ("Área: ", area),
            ("DNI: ", dni),
        ])

        y -= RH
        period_str = f"{fmt_date_long(start_d)}  —  {fmt_date_long(end_d)}"
        hire = emp_info.get("HireDate", "—")
        phone = emp_info.get("Phone", "—") or "—"
        info_row(y, [
            ("Período: ", period_str),
            ("Ingreso: ", hire),
            ("Teléfono: ", phone),
        ])

        # ─── Separator ───
        y -= 8
        hline(y, BORDER, 0.6)

        # ─── Section title ───
        y -= 13
        c.setFillColor(BRAND_DARK)
        c.setFont("Helvetica-Bold", 8.5)
        c.drawString(LM, y, "DETALLE DE ASISTENCIA")

        c.setFillColor(TXT3)
        c.setFont("Helvetica", 7)
        c.drawRightString(RM, y, period_label)

        y -= 6
        return y

    def draw_table_header(y):
        """Dark table header row."""
        c.setFillColor(TH_BG)
        c.rect(LM, y - 2, UW, ROW_H + 1, fill=True, stroke=False)

        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 7)
        for i, (label, _) in enumerate(cols):
            c.drawString(col_x[i] + 4, y + 3, label)

        return y - ROW_H

    def draw_footer():
        hline(38, BORDER, 0.5)
        c.setFillColor(TXT3)
        c.setFont("Helvetica", 6.5)
        ts = datetime.utcnow().strftime("%d/%m/%Y %H:%M UTC")
        c.drawString(LM, 28, f"Generado el {ts}  |  Novasys Asistencia v2  |  Documento confidencial")
        c.drawRightString(RM, 28, f"Página {page[0]}")
        page[0] += 1

    def new_page_header():
        y = H - 10
        y = draw_top_section(y)
        y = draw_table_header(y)
        return y

    # ═══ Start building ═══
    y = new_page_header()

    total_wrk = 0
    total_brk = 0
    days_worked = 0
    days_complete = 0
    days_missing = 0
    row_i = 0

    for d in days:
        if y < 85:
            draw_footer()
            c.showPage()
            y = new_page_header()
            row_i = 0

        # Row background
        if d["weekend"]:
            bg = WEEKEND_BG
        elif row_i % 2 == 1:
            bg = ROW_ODD
        else:
            bg = ROW_EVEN

        c.setFillColor(bg)
        c.rect(LM, y - 2, UW, ROW_H, fill=True, stroke=False)

        # Bottom border
        c.setStrokeColor(BORDER_LIGHT)
        c.setLineWidth(0.3)
        c.line(LM, y - 2, RM, y - 2)

        status = d["status"]
        wrk = d["wrk"]
        brk = d["brk"]

        # ── Fecha ──
        c.setFillColor(TXT)
        c.setFont("Helvetica", 7.5)
        c.drawString(col_x[0] + 4, y + 3, d["date"])

        # ── Día ──
        c.setFillColor(TXT3 if d["weekend"] else TXT2)
        c.setFont("Helvetica", 7)
        c.drawString(col_x[1] + 4, y + 3, d["day"])

        # ── Entrada / Salida ──
        c.setFillColor(TXT)
        c.setFont("Helvetica", 7.5)
        c.drawString(col_x[2] + 4, y + 3, d["in"])
        c.drawString(col_x[3] + 4, y + 3, d["out"])

        # ── Break ──
        c.setFillColor(TXT2)
        c.setFont("Helvetica", 7)
        c.drawString(col_x[4] + 4, y + 3, f"{brk} min" if brk > 0 else "—")

        # ── Horas ──
        c.setFillColor(TXT)
        c.setFont("Helvetica-Bold" if wrk > 0 else "Helvetica", 7.5)
        c.drawString(col_x[5] + 4, y + 3, fmt_hours(wrk))

        # ── Estado badge ──
        label = STATUS_LABEL.get(status, status)
        fg, bg_c = status_colors(status)

        bw = min(c.stringWidth(label, "Helvetica-Bold", 6.5) + 8, cols[6][1] - 6)
        bx = col_x[6] + 3
        by = y

        c.setFillColor(bg_c)
        c.roundRect(bx, by, bw, 12, 2, fill=True, stroke=False)
        c.setFillColor(fg)
        c.setFont("Helvetica-Bold", 6.5)
        c.drawString(bx + 4, y + 3, label)

        # ── Observaciones ──
        reason = d.get("reason", "")
        if len(reason) > 38:
            reason = reason[:35] + "..."
        c.setFillColor(TXT3)
        c.setFont("Helvetica", 6.5)
        c.drawString(col_x[7] + 4, y + 3, reason)

        # Stats
        total_wrk += wrk
        total_brk += brk
        if wrk > 0:
            days_worked += 1
        su = status.upper()
        if su in ("OK", "REGULARIZED"):
            days_complete += 1
        if su == "MISSING":
            days_missing += 1

        y -= ROW_H
        row_i += 1

    # ── Bottom table border ──
    hline(y + ROW_H - 2, BORDER, 0.5)

    # ── Totals row ──
    y -= 6
    c.setFillColor(TXT)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(LM + 4, y, f"Total período (min): {total_wrk}")
    c.drawString(LM + 160, y, f"Total (horas): {total_wrk / 60:.1f}")
    c.drawString(LM + 310, y, f"Total break: {fmt_hours(total_brk)}")

    # ═══ Summary Card ═══
    y -= 24
    card_h = 60

    if y - card_h < 55:
        draw_footer()
        c.showPage()
        y = H - 60

    # Card border & background
    c.setFillColor(SUMMARY_BG)
    c.setStrokeColor(ACCENT)
    c.setLineWidth(0.8)
    c.roundRect(LM, y - card_h, UW, card_h, 5, fill=True, stroke=True)

    # Title
    sy = y - 16
    c.setFillColor(BRAND)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(LM + 14, sy, "Resumen del Período")

    # Stats
    sy -= 22
    stats = [
        ("Días trabajados", str(days_worked)),
        ("Días completos", str(days_complete)),
        ("Sin registro", str(days_missing)),
        ("Total horas", fmt_hours(total_wrk)),
        ("Total break", fmt_hours(total_brk)),
    ]
    sw = (UW - 28) / len(stats)
    for i, (lbl, val) in enumerate(stats):
        sx = LM + 14 + i * sw
        c.setFillColor(BRAND_DARK)
        c.setFont("Helvetica-Bold", 14)
        c.drawString(sx, sy, val)
        c.setFillColor(TXT2)
        c.setFont("Helvetica", 7)
        c.drawString(sx, sy - 12, lbl)

    # ── Legal note ──
    y = y - card_h - 12
    c.setFillColor(TXT3)
    c.setFont("Helvetica-Oblique", 6.5)
    c.drawString(LM, y, "Nota: horas basadas en registros y/o regularizaciones con trazabilidad. Hora de servidor en backend.")

    draw_footer()
    c.showPage()
    c.save()
    buf.seek(0)
    return buf.read()


# ═══════════════════════════════════════════════════════
# Lambda Handler
# ═══════════════════════════════════════════════════════

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

        employee_id = employee_key if employee_key.startswith("EMP#") else f"EMP#{employee_key}"
        emp_info = get_employee_info(employee_id)

        if week:
            start_d, end_d = parse_iso_week(week)
            report_title = "Semanal"
            period_label = f"Semana {week}"
            key_part = week
        else:
            start_d, end_d = parse_month(month)
            y, m = month.split("-")
            report_title = "Mensual"
            period_label = f"Mes: {MONTH_ES[int(m)]} {y}"
            key_part = month

        sk_from = f"DATE#{start_d.isoformat()}"
        sk_to = f"DATE#{end_d.isoformat()}"

        out = daily.query(
            KeyConditionExpression=Key("EmployeeID").eq(employee_id) & Key("WorkDate").between(sk_from, sk_to)
        )
        by_date = {it["WorkDate"].replace("DATE#", ""): it for it in out.get("Items", [])}

        days = []
        d = start_d
        while d <= end_d:
            ds = d.isoformat()
            days.append(build_day(ds, by_date.get(ds, {}), d))
            d = date.fromordinal(d.toordinal() + 1)

        pdf_bytes = build_pdf(employee_key, emp_info, report_title, period_label, days, start_d, end_d)

        rtype = "weekly" if week else "monthly"
        safe = employee_key.replace("@", "_at_").replace("#", "_")
        key = f"reports/{rtype}/{key_part}/{safe}.pdf"

        s3.put_object(Bucket=REPORT_BUCKET, Key=key, Body=pdf_bytes, ContentType="application/pdf")
        url = s3.generate_presigned_url("get_object", Params={"Bucket": REPORT_BUCKET, "Key": key}, ExpiresIn=900)

        return resp(200, {"ok": True, "url": url, "s3Key": key, "reportType": rtype,
                          "employeeId": employee_id, "fromDate": start_d.isoformat(), "toDate": end_d.isoformat()})

    except Exception as e:
        return resp(500, {"ok": False, "error": str(e)})
