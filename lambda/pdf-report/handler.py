"""
PDF Report Lambda — Professional attendance report with structured corporate layout.
"""

import os
import json
import calendar
import unicodedata
from io import BytesIO
from datetime import date, datetime, timezone
import boto3
from boto3.dynamodb.conditions import Key, Attr
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


def month_bounds(ym):
    """'2026-03' -> (date(2026,3,1), date(2026,3,31))."""
    y, m = int(ym[:4]), int(ym[5:7])
    return date(y, m, 1), date(y, m, calendar.monthrange(y, m)[1])


def qs_list(qs, *names):
    """Read a comma-separated query param under any of `names`."""
    for n in names:
        raw = (qs.get(n) or "").strip()
        if raw:
            return [p.strip() for p in raw.split(",") if p.strip()]
    return []


def merge_segments(segs):
    """Sort and coalesce overlapping or adjacent (start, end) pairs."""
    out = []
    for s, e in sorted(segs):
        if out and s <= date.fromordinal(out[-1][1].toordinal() + 1):
            out[-1] = (out[-1][0], max(out[-1][1], e))
        else:
            out.append((s, e))
    return out


def period_key(items):
    """S3-key fragment for a period. Long selections collapse to a summary."""
    joined = "-".join(items)
    return joined if len(joined) <= 60 else items[0] + "_a_" + items[-1] + "_" + str(len(items)) + "p"


def resolve_period(qs):
    """Work out what stretch of time the report covers.

    Returns (segments, label, rtype, key_part), where `segments` is a sorted
    list of inclusive (start, end) date pairs. A list rather than a single
    range because an admin can ask for January, February AND May: the gap
    between them has to stay OUT of the report instead of being quietly filled
    in, which is what a plain from-to range would do.

    Accepted, in precedence order: week, years, months, from+to.
    """
    week = (qs.get("week") or "").strip()
    months = qs_list(qs, "months", "month")
    years = qs_list(qs, "years", "year")
    d_from = (qs.get("from") or "").strip()
    d_to = (qs.get("to") or "").strip()

    if week:
        s, e = parse_iso_week(week)
        return [(s, e)], "Semana " + week, "weekly", week

    if years:
        ys = sorted(set(years))
        segs = [(date(int(y), 1, 1), date(int(y), 12, 31)) for y in ys]
        label = "Ano " + ys[0] if len(ys) == 1 else "Anos " + ", ".join(ys)
        label = label.replace("Ano", "Año")
        return merge_segments(segs), label, "yearly", "-".join(ys)

    if months:
        ms = sorted(set(months))
        segs = [month_bounds(m) for m in ms]
        if len(ms) == 1:
            label = "Mes: " + MONTH_ES[int(ms[0][5:7])] + " " + ms[0][:4]
            rtype = "monthly"
        else:
            short = [MONTH_ES[int(m[5:7])][:3] + " " + m[:4] for m in ms]
            label = ("Meses: " + ", ".join(short)) if len(ms) <= 4 else (
                str(len(ms)) + " meses: " + short[0] + " a " + short[-1])
            rtype = "multi-monthly"
        return merge_segments(segs), label, rtype, period_key(ms)

    if d_from and d_to:
        s = date.fromisoformat(d_from)
        e = date.fromisoformat(d_to)
        if s > e:
            raise ValueError("'from' no puede ser posterior a 'to'")
        return [(s, e)], "Del " + fmt_date_long(s) + " al " + fmt_date_long(e), "range", d_from + "_a_" + d_to

    raise ValueError("Falta el período: envía week, month(s), year(s) o from+to")


def span(segments):
    """Outer bounds of a segment list — what a single Dynamo query must cover."""
    return segments[0][0], segments[-1][1]


def iter_days(segments):
    for s, e in segments:
        d = s
        while d <= e:
            yield d
            d = date.fromordinal(d.toordinal() + 1)


def total_days(segments):
    return sum(1 for _ in iter_days(segments))


def months_of(segments):
    """Ordered 'YYYY-MM' list actually covered by the segments."""
    seen = []
    for d in iter_days(segments):
        ym = d.strftime("%Y-%m")
        if not seen or seen[-1] != ym:
            if ym not in seen:
                seen.append(ym)
    return seen


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
            # Planned / late / source feed the summary columns an admin can now
            # pick (horas planificadas, tardanzas, regularizaciones).
            "pln": int(item.get("plannedMinutes", 0)),
            "late": int(item.get("lateMinutes", 0)),
            "src": item.get("source", ""),
            "recorded": True,
            "status": item.get("status", "MISSING"),
            "reason": reason, "weekend": is_weekend,
        }

    return {
        "date": ds, "day": day_name, "in": "—", "out": "—",
        "brk": 0, "wrk": 0, "pln": 0, "late": 0, "src": "", "recorded": False,
        "status": "No Laborable" if is_weekend else "MISSING",
        "reason": "", "weekend": is_weekend,
    }


# ═══ Summary metrics + configurable columns ═══════════════════════════
# Mirrors src/lib/constants/report-fields.ts: the web app sends the chosen
# column keys as `cols=`, so the two catalogues must stay in step. Keys the
# Lambda does not know are ignored rather than rejected, so an older Lambda
# keeps serving a newer UI instead of erroring out on it.

def day_metrics(days):
    m = {"daysRecorded": 0, "daysPresent": 0, "absences": 0, "regularizations": 0,
         "lateDays": 0, "openDays": 0, "workedMin": 0, "plannedMin": 0,
         "breakMin": 0, "lateMin": 0}
    for d in days:
        if not d.get("recorded"):
            continue
        status = (d.get("status") or "").upper()
        m["daysRecorded"] += 1
        m["workedMin"] += d.get("wrk", 0)
        m["plannedMin"] += d.get("pln", 0)
        m["breakMin"] += d.get("brk", 0)
        m["lateMin"] += d.get("late", 0)
        if d.get("wrk", 0) > 0:
            m["daysPresent"] += 1
        if d.get("late", 0) > 0:
            m["lateDays"] += 1
        if status == "OPEN":
            m["openDays"] += 1
        if status in ("ABSENCE", "MISSING"):
            m["absences"] += 1
        if status == "REGULARIZED" or str(d.get("src", "")).startswith("REGULARIZATION"):
            m["regularizations"] += 1
    return m


def add_metrics(into, other):
    for k in into:
        into[k] += other[k]
    return into


def empty_metrics():
    return {"daysRecorded": 0, "daysPresent": 0, "absences": 0, "regularizations": 0,
            "lateDays": 0, "openDays": 0, "workedMin": 0, "plannedMin": 0,
            "breakMin": 0, "lateMin": 0}


def fmt_delta(minutes):
    if not minutes:
        return "0h"
    sign = "+" if minutes > 0 else "-"
    return sign + fmt_hours(abs(minutes))


def pct_str(part, whole):
    if not whole:
        return "—"
    return str(min(100, int(round(part * 100.0 / whole)))) + "%"


def punctuality_str(m):
    if not m["daysPresent"]:
        return "—"
    ok = max(0, m["daysPresent"] - m["lateDays"])
    return str(int(round(ok * 100.0 / m["daysPresent"]))) + "%"


def avg_str(m):
    if not m["daysPresent"]:
        return "—"
    return fmt_hours(int(m["workedMin"] / m["daysPresent"]))


COL_CATALOG = {
    "dni":             ("DNI", 62, lambda i, m: str(i.get("DNI") or "—")),
    "area":            ("ÁREA", 100, lambda i, m: str(i.get("Area") or "—")),
    "position":        ("CARGO", 95, lambda i, m: str(i.get("Position") or "—")),
    "email":           ("CORREO", 130, lambda i, m: str(i.get("Email") or "—")),
    "daysRecorded":    ("D. REG.", 54, lambda i, m: str(m["daysRecorded"])),
    "daysPresent":     ("DÍAS", 46, lambda i, m: str(m["daysPresent"])),
    "absences":        ("FALTAS", 52, lambda i, m: str(m["absences"])),
    "regularizations": ("REGUL.", 52, lambda i, m: str(m["regularizations"])),
    "lateDays":        ("TARDES", 52, lambda i, m: str(m["lateDays"])),
    "openDays":        ("ABIERT.", 52, lambda i, m: str(m["openDays"])),
    "workedHours":     ("HORAS", 56, lambda i, m: fmt_hours(m["workedMin"])),
    "plannedHours":    ("H. PLAN.", 62, lambda i, m: fmt_hours(m["plannedMin"])),
    "deltaHours":      ("DIF.", 58, lambda i, m: fmt_delta(m["workedMin"] - m["plannedMin"])),
    "overtimeHours":   ("EXTRA", 58, lambda i, m: fmt_hours(max(0, m["workedMin"] - m["plannedMin"]))),
    "missingHours":    ("FALTAN", 58, lambda i, m: fmt_hours(max(0, m["plannedMin"] - m["workedMin"]))),
    "breakHours":      ("BREAK", 55, lambda i, m: fmt_hours(m["breakMin"])),
    "avgHoursPerDay":  ("PROM.", 52, lambda i, m: avg_str(m)),
    "attendancePct":   ("% ASIST.", 55, lambda i, m: pct_str(m["workedMin"], m["plannedMin"])),
    "punctualityPct":  ("% PUNT.", 55, lambda i, m: punctuality_str(m)),
    "lateHours":       ("TARDE", 54, lambda i, m: fmt_hours(m["lateMin"])),
}

DEFAULT_ROSTER_COLS = ["dni", "area", "daysPresent", "workedHours"]
# Past eight the columns get too narrow to read on A4 portrait.
MAX_ROSTER_COLS = 8

# Columns whose subtotal would be a lie if summed (a percentage, a name).
SUBTOTAL_SKIP = {"dni", "area", "position", "email"}


def pick_roster_cols(keys):
    """Validate the requested column keys, keeping the catalogue's order."""
    wanted = [k for k in (keys or []) if k in COL_CATALOG]
    if not wanted:
        wanted = list(DEFAULT_ROSTER_COLS)
    ordered = [k for k in COL_CATALOG if k in set(wanted)]
    return ordered[:MAX_ROSTER_COLS]


# ═══════════════════════════════════════════════════════
# PDF Builder
# ═══════════════════════════════════════════════════════

def build_pdf(emp_key, emp_info, report_title, period_label, days, start_d, end_d, company_name="Novasys", company_ruc=""):
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
        # Left: company legal name + RUC.  Right: report kind.
        y -= 20
        c.setFillColor(BRAND_DARK)
        c.setFont("Helvetica-Bold", 12)
        company_str = (company_name or "Novasys").upper()
        c.drawString(LM, y, company_str)

        if company_ruc:
            c.setFillColor(TXT2)
            c.setFont("Helvetica", 10)
            c.drawString(
                LM + c.stringWidth(company_str, "Helvetica-Bold", 12) + 6,
                y,
                f"- RUC: {company_ruc}",
            )

        c.setFillColor(BRAND)
        c.setFont("Helvetica-Bold", 10)
        c.drawRightString(RM, y + 1, f"Reporte de Asistencia ({work_mode})")

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
# Consolidated monthly report — every employee, one PDF
# ═══════════════════════════════════════════════════════

EMP_INDEX = os.environ.get("INDEX_EMPLOYEES_BY_TENANT", "Tenant-index")
DAILY_INDEX = os.environ.get("INDEX_DAILY_BY_TENANT", "Tenant-WorkDate-index")

# Detail columns for the consolidated register. Deliberately WITHOUT the
# "ESTADO" and "OBS." columns of the per-employee report: this document gets
# printed and handed to a SUNAFIL inspector, and the client asked for a plain
# attendance register — no regularization badges, no internal notes.
#
# Note the column is DROPPED rather than relabelling REGULARIZED days as
# ordinary ones: the register reports the hours actually worked and stays
# silent on how each row was captured, instead of asserting something untrue
# about a specific day. A 0 width means "fill the remaining usable width".
DETAIL_COLS = [("FECHA", 80), ("DÍA", 80), ("ENTRADA", 80),
               ("SALIDA", 80), ("BREAK", 75), ("HORAS", 0)]

def utc_stamp():
    return datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M UTC")


def query_all(table, **kwargs):
    """Query helper that drains every page of results."""
    items, last = [], None
    while True:
        if last:
            kwargs["ExclusiveStartKey"] = last
        out = table.query(**kwargs)
        items.extend(out.get("Items", []))
        last = out.get("LastEvaluatedKey")
        if not last:
            return items


def get_tenant_employees(tenant_id):
    return query_all(
        emp_table,
        IndexName=EMP_INDEX,
        KeyConditionExpression=Key("TenantID").eq(tenant_id),
        FilterExpression=Attr("EmploymentStatus").eq("ACTIVE"),
    )


def get_tenant_daily(tenant_id, start_d, end_d):
    """All daily summaries of the tenant in range, grouped by EmployeeID."""
    rows = query_all(
        daily,
        IndexName=DAILY_INDEX,
        KeyConditionExpression=Key("TenantID").eq(tenant_id)
        & Key("WorkDate").between(
            "DATE#" + start_d.isoformat(), "DATE#" + end_d.isoformat()
        ),
    )
    grouped = {}
    for it in rows:
        emp = it.get("EmployeeID", "")
        grouped.setdefault(emp, {})[it["WorkDate"].replace("DATE#", "")] = it
    return grouped


def area_key(raw):
    """Accent/case-insensitive area key — mirrors src/lib/utils/area.ts."""
    s = unicodedata.normalize("NFD", str(raw or "").strip().lower())
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    return " ".join(s.split())


def build_roster(tenant_id, segments, roster_in=None, roster_only=False, areas=None):
    """Everyone who must appear in the register, sorted by name.

    Active employees plus anyone with attendance in the period — somebody who
    left mid-month still worked days an inspector will ask about, and dropping
    them would leave a hole in the register.

    `roster_in` is the active staff list already resolved by the Next.js
    backend and sent in the invoke payload. Preferred over querying the
    Employees GSI from here, for the same reason the company name and RUC are
    passed in: it keeps this Lambda's IAM scope to GetItem on the table, with
    no permission on the table's indexes.

    `segments` is a list of inclusive (start, end) date pairs, so a report over
    January + February + May contains no March or April rows.

    `areas` narrows the register to those areas. It has to be applied HERE and
    not only in the caller, because the "pull in anyone with attendance" rule
    below would otherwise re-add people from every other area.
    """
    start_d, end_d = span(segments)
    by_emp = get_tenant_daily(tenant_id, start_d, end_d)
    wanted_areas = set(area_key(a) for a in (areas or []) if str(a).strip())

    infos = {}
    if roster_in:
        for e in roster_in:
            emp_id = (e.get("employeeId") or "").strip()
            if emp_id:
                infos[emp_id] = {
                    "EmployeeID": emp_id,
                    "FullName": e.get("fullName") or "",
                    "DNI": e.get("dni") or "",
                    "Area": e.get("area") or "",
                    "Position": e.get("position") or "",
                    "Email": e.get("email") or "",
                }
    else:
        # Direct invocations (no roster supplied) still work, provided the role
        # can query the Employees GSI.
        for e in get_tenant_employees(tenant_id):
            infos[e.get("EmployeeID", "")] = e

    # Someone with attendance but outside the roster is normally pulled in, so a
    # person who left mid-period still appears. When the caller hand-picked who
    # to include, that would silently re-add the very people they excluded, so
    # roster_only turns it off.
    if not roster_only:
        for emp_id in by_emp:
            if emp_id and emp_id not in infos:
                infos[emp_id] = get_employee_info(emp_id) or {"EmployeeID": emp_id}

    if wanted_areas:
        infos = {k: v for k, v in infos.items()
                 if area_key(v.get("Area")) in wanted_areas}

    roster = []
    for emp_id, info in infos.items():
        by_date = by_emp.get(emp_id, {})
        days = []
        for d in iter_days(segments):
            ds = d.isoformat()
            days.append(build_day(ds, by_date.get(ds, {}), d))
        roster.append((emp_id, info, days))

    roster.sort(key=lambda r: (r[1].get("FullName") or r[0] or "").lower())
    return roster


def matrix_buckets(segments):
    """Column layout for the period-comparison grid.

    Months while they still fit on A4; past that the grid switches to years,
    because a 24-column month grid is unreadable and a yearly one is exactly
    what a multi-year selection was asking for anyway.
    """
    months = months_of(segments)
    if len(months) <= 14:
        # The year suffix only earns its space when the grid actually crosses
        # years; inside one year it just pushes "Ene 25" past a 25pt column.
        multi_year = len(set(m[:4] for m in months)) > 1
        labels = [MONTH_ES[int(m[5:7])][:3] + (" " + m[2:4] if multi_year else "")
                  for m in months]
        return months, labels, (lambda ds: ds[:7])
    years = []
    for m in months:
        if m[:4] not in years:
            years.append(m[:4])
    return years, list(years), (lambda ds: ds[:4])


def build_consolidated_pdf(company_name, company_ruc, period_label, segments, roster,
                           cols=None, group_by_area=False, detail=True, area_label=""):
    """One PDF: a roster summary, an optional per-period grid, then (optionally)
    a day-by-day block per employee.

    `cols` picks the summary columns (see COL_CATALOG), `group_by_area` breaks
    the summary into area blocks with subtotals, and `detail` turns off the
    day-by-day section — a full year of 40 people is 14 000 rows nobody prints.
    """
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    W, H = A4
    LM = 40
    RM = W - 40
    UW = RM - LM
    ROW_H = 17
    page = [1]
    start_d, end_d = span(segments)
    cols = pick_roster_cols(cols)
    right_label = "Registro de Asistencia — Consolidado"

    def resolve(spec):
        """Lay out columns across the usable width.

        A 0 width means "take whatever is left". With a configurable column set
        the fixed widths can now add up to more than the page, so they are
        scaled down proportionally instead of letting the flexible column go
        negative and the table run off the sheet.
        """
        flex = any(1 for _l, w in spec if not w)
        fixed = sum(w for _l, w in spec if w) or 1
        if flex:
            budget = UW - 46
            scale = min(1.0, budget / float(fixed))
        else:
            scale = UW / float(fixed)
        out, xs, cx = [], [], LM
        for label, w in spec:
            width = (w * scale) if w else (UW - fixed * scale)
            out.append((label, width))
            xs.append(cx)
            cx += width
        return out, xs

    def hline(y, color=BORDER_LIGHT, width=0.5):
        c.setStrokeColor(color)
        c.setLineWidth(width)
        c.line(LM, y, RM, y)

    def draw_footer():
        hline(38, BORDER, 0.5)
        c.setFillColor(TXT3)
        c.setFont("Helvetica", 6.5)
        c.drawString(LM, 28, "Generado el " + utc_stamp() +
                     "  |  Novasys Asistencia v2  |  Documento confidencial")
        c.drawRightString(RM, 28, "Página " + str(page[0]))
        page[0] += 1

    def draw_masthead(y, label):
        """Company band repeated on every page."""
        c.setFillColor(BRAND)
        c.rect(0, y, W, 2.5, fill=True, stroke=False)
        y -= 22

        # Reserve the right-hand title first, then fit the company block into
        # what is left: a long legal name used to run straight through it.
        title_w = c.stringWidth(label, "Helvetica-Bold", 10)
        ruc_str = ("- RUC: " + company_ruc) if company_ruc else ""
        ruc_w = c.stringWidth(ruc_str, "Helvetica", 10) + 6 if ruc_str else 0
        avail = UW - title_w - 16 - ruc_w

        company_str = clip((company_name or "Novasys").upper(),
                           max(60, avail), "Helvetica-Bold", 12)
        c.setFillColor(BRAND_DARK)
        c.setFont("Helvetica-Bold", 12)
        c.drawString(LM, y, company_str)
        if ruc_str:
            c.setFillColor(TXT2)
            c.setFont("Helvetica", 10)
            c.drawString(LM + c.stringWidth(company_str, "Helvetica-Bold", 12) + 6, y, ruc_str)

        c.setFillColor(BRAND)
        c.setFont("Helvetica-Bold", 10)
        c.drawRightString(RM, y + 1, label)

        y -= 8
        hline(y, BORDER, 0.6)
        return y

    def draw_thead(y, spec_cols, spec_xs, right_align=()):
        c.setFillColor(TH_BG)
        c.rect(LM, y - 2, UW, ROW_H + 1, fill=True, stroke=False)
        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 7)
        for i, (label, w) in enumerate(spec_cols):
            # Clip like the cells: a header wider than its column used to bleed
            # into the next one ("DIAS TRAB.TOTAL HORAS").
            text = clip(label, w, "Helvetica-Bold", 7)
            if i in right_align:
                c.drawRightString(spec_xs[i] + w - 4, y + 3, text)
            else:
                c.drawString(spec_xs[i] + 4, y + 3, text)
        return y - ROW_H

    def clip(text, width, font="Helvetica", size=7.5):
        """Trim to fit its column so long names never bleed into the next one."""
        text = str(text or "")
        if c.stringWidth(text, font, size) <= width - 8:
            return text
        while text and c.stringWidth(text + "...", font, size) > width - 8:
            text = text[:-1]
        return text + "..."

    def zebra(y, i):
        c.setFillColor(ROW_ODD if i % 2 else ROW_EVEN)
        c.rect(LM, y - 2, UW, ROW_H, fill=True, stroke=False)
        c.setStrokeColor(BORDER_LIGHT)
        c.setLineWidth(0.3)
        c.line(LM, y - 2, RM, y - 2)

    # Metrics are computed once and reused by the summary, the grid and the
    # totals, so a 12-month register does not re-walk 4 000 day rows per table.
    entries = [(emp_id, info, days, day_metrics(days)) for emp_id, info, days in roster]

    # ─────────── Roster summary ───────────
    # The name column takes the largest single share, so it is what gives ground
    # when the admin picks a wide column set.
    name_w = 185 if len(cols) <= 4 else (150 if len(cols) <= 6 else 125)
    spec = [("EMPLEADO", name_w)] + [(COL_CATALOG[k][0], COL_CATALOG[k][1]) for k in cols]
    spec[-1] = (spec[-1][0], 0)
    scols, xs = resolve(spec)

    def draw_entry_row(y, i, info, met, label=None, bold=False):
        zebra(y, i)
        name_font = "Helvetica-Bold" if bold else "Helvetica"
        c.setFillColor(TXT)
        c.setFont(name_font, 7.5)
        c.drawString(xs[0] + 4, y + 3,
                     clip(label if label is not None else (info.get("FullName") or ""),
                          scols[0][1], name_font, 7.5))
        for j, key in enumerate(cols):
            if bold and key in SUBTOTAL_SKIP:
                continue
            value = COL_CATALOG[key][2](info, met)
            is_text = key in SUBTOTAL_SKIP
            c.setFillColor(TXT2 if is_text and not bold else TXT)
            c.setFont("Helvetica-Bold" if bold or key == "workedHours" else "Helvetica",
                      7 if is_text else 7.5)
            c.drawString(xs[j + 1] + 4, y + 3,
                         clip(value, scols[j + 1][1], "Helvetica", 7))
        return y - ROW_H

    y = draw_masthead(H - 10, right_label)

    y -= 13
    c.setFillColor(BRAND_DARK)
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(LM, y, "RESUMEN POR EMPLEADO")
    c.setFillColor(TXT3)
    c.setFont("Helvetica", 7)
    c.drawRightString(RM, y, period_label)

    y -= 12
    c.setFillColor(TXT2)
    c.setFont("Helvetica", 7.5)
    meta = "Período: " + fmt_date_long(start_d) + "  —  " + fmt_date_long(end_d)
    if len(segments) > 1:
        meta += " (" + str(len(segments)) + " tramos)"
    meta += "   |   Personal listado: " + str(len(roster))
    c.drawString(LM, y, meta)

    if area_label:
        y -= 11
        c.setFillColor(BRAND)
        c.setFont("Helvetica-Bold", 7.5)
        c.drawString(LM, y, "Área: " + area_label)

    # Clear the header band of the line above it: draw_thead paints a filled
    # rect reaching ~16pt ABOVE its y, so anything closer gets covered.
    y -= 24
    y = draw_thead(y, scols, xs)

    grand = empty_metrics()
    if group_by_area:
        groups = {}
        for emp_id, info, days, met in entries:
            label = (info.get("Area") or "Sin área").strip() or "Sin área"
            groups.setdefault(label, []).append((emp_id, info, days, met))

        for label in sorted(groups, key=lambda s: s.lower()):
            members = groups[label]
            if y < 96:
                draw_footer()
                c.showPage()
                y = draw_masthead(H - 10, right_label)
                y -= 20
                y = draw_thead(y, scols, xs)

            c.setFillColor(SUMMARY_BG)
            c.rect(LM, y - 2, UW, ROW_H, fill=True, stroke=False)
            c.setFillColor(BRAND_DARK)
            c.setFont("Helvetica-Bold", 7.5)
            c.drawString(LM + 4, y + 3,
                         label.upper() + "  (" + str(len(members)) + ")")
            y -= ROW_H

            sub = empty_metrics()
            for i, (_emp_id, info, _days, met) in enumerate(members):
                if y < 70:
                    draw_footer()
                    c.showPage()
                    y = draw_masthead(H - 10, right_label)
                    y -= 20
                    y = draw_thead(y, scols, xs)
                y = draw_entry_row(y, i, info, met)
                add_metrics(sub, met)

            add_metrics(grand, sub)
            y = draw_entry_row(y, 0, {"Area": label}, sub,
                               label="Subtotal " + label, bold=True)
            y -= 4
    else:
        for i, (_emp_id, info, _days, met) in enumerate(entries):
            if y < 70:
                draw_footer()
                c.showPage()
                y = draw_masthead(H - 10, right_label)
                y -= 20
                y = draw_thead(y, scols, xs)
            y = draw_entry_row(y, i, info, met)
            add_metrics(grand, met)

    hline(y + ROW_H - 2, BORDER, 0.5)

    y -= 8
    c.setFillColor(BRAND_DARK)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(LM + 4, y, "TOTAL GENERAL:  " + str(len(roster)) + " empleados")
    c.drawString(LM + 200, y, "Días trabajados: " + str(grand["daysPresent"]))
    c.drawString(LM + 350, y, "Horas: " + fmt_hours(grand["workedMin"]))

    if detail:
        y -= 18
        c.setFillColor(TXT3)
        c.setFont("Helvetica-Oblique", 6.5)
        c.drawString(LM, y, "El detalle diario de cada empleado continúa en las páginas siguientes.")

    draw_footer()
    c.showPage()

    # ─────────── Period grid (only worth a page when there are several) ───────────
    buckets, blabels, bucket_of = matrix_buckets(segments)
    if len(buckets) > 1 and entries:
        per_emp = []
        for _emp_id, info, days, met in entries:
            acc = {}
            for d in days:
                if d.get("recorded"):
                    b = bucket_of(d["date"])
                    acc[b] = acc.get(b, 0) + d.get("wrk", 0)
            per_emp.append((info, acc, met))

        # Every bucket column shares whatever is left after name + total.
        gname_w = 150 if len(buckets) <= 8 else 120
        each = max(30.0, (UW - gname_w - 62) / float(len(buckets)))
        gspec = [("EMPLEADO", gname_w)] + [(lbl, each) for lbl in blabels] + [("TOTAL", 0)]
        gcols, gxs = resolve(gspec)
        right_cols = tuple(range(1, len(gcols)))

        gy = draw_masthead(H - 10, "Horas por período")
        gy -= 13
        c.setFillColor(BRAND_DARK)
        c.setFont("Helvetica-Bold", 8.5)
        c.drawString(LM, gy, "HORAS TRABAJADAS POR PERÍODO")
        c.setFillColor(TXT3)
        c.setFont("Helvetica", 7)
        c.drawRightString(RM, gy, period_label)

        gy -= 12
        c.setFillColor(TXT2)
        c.setFont("Helvetica", 7.5)
        c.drawString(LM, gy, "Un guion significa que no hubo registros en ese período.")

        gy -= 24
        gy = draw_thead(gy, gcols, gxs, right_cols)

        col_totals = dict((b, 0) for b in buckets)
        for i, (info, acc, met) in enumerate(per_emp):
            if gy < 70:
                draw_footer()
                c.showPage()
                gy = draw_masthead(H - 10, "Horas por período")
                gy -= 20
                gy = draw_thead(gy, gcols, gxs, right_cols)

            zebra(gy, i)
            c.setFillColor(TXT)
            c.setFont("Helvetica", 7.5)
            c.drawString(gxs[0] + 4, gy + 3,
                         clip(info.get("FullName") or "", gcols[0][1]))
            for j, b in enumerate(buckets):
                mins = acc.get(b, 0)
                col_totals[b] += mins
                c.setFillColor(TXT if mins else TXT3)
                c.setFont("Helvetica", 7)
                c.drawRightString(gxs[j + 1] + gcols[j + 1][1] - 4, gy + 3,
                                  fmt_hours(mins) if mins else "—")
            c.setFillColor(TXT)
            c.setFont("Helvetica-Bold", 7.5)
            c.drawRightString(gxs[-1] + gcols[-1][1] - 4, gy + 3, fmt_hours(met["workedMin"]))
            gy -= ROW_H

        hline(gy + ROW_H - 2, BORDER, 0.5)
        gy -= 10
        c.setFillColor(BRAND_DARK)
        c.setFont("Helvetica-Bold", 7.5)
        c.drawString(gxs[0] + 4, gy, "TOTAL")
        for j, b in enumerate(buckets):
            c.drawRightString(gxs[j + 1] + gcols[j + 1][1] - 4, gy, fmt_hours(col_totals[b]))
        c.drawRightString(gxs[-1] + gcols[-1][1] - 4, gy, fmt_hours(grand["workedMin"]))

        draw_footer()
        c.showPage()

    # ─────────── One block per employee ───────────
    if not detail:
        c.save()
        buf.seek(0)
        return buf.read()

    dcols, dxs = resolve(DETAIL_COLS)

    for emp_id, info, days, met in entries:
        name = info.get("FullName") or emp_id.replace("EMP#", "")
        y = draw_masthead(H - 10, "Detalle de Asistencia")

        y -= 14
        c.setFillColor(BRAND_DARK)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(LM, y, name)
        c.setFillColor(TXT3)
        c.setFont("Helvetica", 7)
        c.drawRightString(RM, y, period_label)

        y -= 12
        c.setFillColor(TXT2)
        c.setFont("Helvetica", 7.5)
        c.drawString(LM, y, "DNI: " + str(info.get("DNI") or "—") +
                     "    Área: " + str(info.get("Area") or "—") +
                     "    Cargo: " + str(info.get("Position") or "—"))

        y -= 10
        hline(y, BORDER, 0.6)

        y -= 18
        y = draw_thead(y, dcols, dxs)

        row_i = 0
        for d in days:
            if y < 78:
                draw_footer()
                c.showPage()
                y = draw_masthead(H - 10, "Detalle de Asistencia")
                y -= 14
                c.setFillColor(BRAND_DARK)
                c.setFont("Helvetica-Bold", 9)
                c.drawString(LM, y, name + "  (continuación)")
                y -= 20
                y = draw_thead(y, dcols, dxs)
                row_i = 0

            if d["weekend"]:
                bg = WEEKEND_BG
            else:
                bg = ROW_ODD if row_i % 2 else ROW_EVEN
            c.setFillColor(bg)
            c.rect(LM, y - 2, UW, ROW_H, fill=True, stroke=False)
            c.setStrokeColor(BORDER_LIGHT)
            c.setLineWidth(0.3)
            c.line(LM, y - 2, RM, y - 2)

            c.setFillColor(TXT)
            c.setFont("Helvetica", 7.5)
            c.drawString(dxs[0] + 4, y + 3, d["date"])
            c.setFillColor(TXT3 if d["weekend"] else TXT2)
            c.setFont("Helvetica", 7)
            c.drawString(dxs[1] + 4, y + 3, d["day"])
            c.setFillColor(TXT)
            c.setFont("Helvetica", 7.5)
            c.drawString(dxs[2] + 4, y + 3, d["in"])
            c.drawString(dxs[3] + 4, y + 3, d["out"])
            c.setFillColor(TXT2)
            c.setFont("Helvetica", 7)
            c.drawString(dxs[4] + 4, y + 3, (str(d["brk"]) + " min") if d["brk"] > 0 else "—")
            c.setFillColor(TXT)
            c.setFont("Helvetica-Bold" if d["wrk"] > 0 else "Helvetica", 7.5)
            c.drawString(dxs[5] + 4, y + 3, fmt_hours(d["wrk"]))

            y -= ROW_H
            row_i += 1

        hline(y + ROW_H - 2, BORDER, 0.5)

        y -= 10
        c.setFillColor(TXT)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(LM + 4, y, "Días trabajados: " + str(met["daysPresent"]))
        c.drawString(LM + 160, y, "Total horas: " + fmt_hours(met["workedMin"]))
        c.drawString(LM + 320, y, "Total break: " + fmt_hours(met["breakMin"]))

        y -= 20
        c.setFillColor(TXT3)
        c.setFont("Helvetica-Oblique", 6.5)
        c.drawString(LM, y, "Registro de control de asistencia. Horas calculadas con hora de servidor.")

        # Signature strip — an inspector expects a signed physical copy.
        y -= 34
        if y > 60:
            c.setStrokeColor(BORDER)
            c.setLineWidth(0.5)
            c.line(LM, y, LM + 170, y)
            c.line(RM - 170, y, RM, y)
            c.setFillColor(TXT3)
            c.setFont("Helvetica", 6.5)
            c.drawString(LM, y - 9, "Firma del trabajador")
            c.drawRightString(RM, y - 9, "Firma del empleador")

        draw_footer()
        c.showPage()

    c.save()
    buf.seek(0)
    return buf.read()


# ═══════════════════════════════════════════════════════
# Lambda Handler
# ═══════════════════════════════════════════════════════

def handle_employee_report(qs, company_name, company_ruc):
    employee_key = (qs.get("employeeKey") or "").strip().lower()
    if not employee_key:
        return resp(400, {"ok": False, "error": "Falta employeeKey"})

    segments, period_label, rtype, key_part = resolve_period(qs)
    start_d, end_d = span(segments)

    employee_id = employee_key if employee_key.startswith("EMP#") else "EMP#" + employee_key
    emp_info = get_employee_info(employee_id)

    report_title = {"weekly": "Semanal", "monthly": "Mensual",
                    "multi-monthly": "Multi-mensual", "yearly": "Anual"}.get(rtype, "Período")

    # One query over the outer bounds; days outside the chosen segments are
    # simply never asked for when the day list is built below.
    sk_from = "DATE#" + start_d.isoformat()
    sk_to = "DATE#" + end_d.isoformat()

    out = query_all(
        daily,
        KeyConditionExpression=Key("EmployeeID").eq(employee_id) & Key("WorkDate").between(sk_from, sk_to),
    )
    by_date = {it["WorkDate"].replace("DATE#", ""): it for it in out}

    days = []
    for d in iter_days(segments):
        ds = d.isoformat()
        days.append(build_day(ds, by_date.get(ds, {}), d))

    pdf_bytes = build_pdf(employee_key, emp_info, report_title, period_label,
                          days, start_d, end_d, company_name, company_ruc)

    safe = employee_key.replace("@", "_at_").replace("#", "_")
    key = "reports/" + rtype + "/" + key_part + "/" + safe + ".pdf"

    s3.put_object(Bucket=REPORT_BUCKET, Key=key, Body=pdf_bytes, ContentType="application/pdf")
    url = s3.generate_presigned_url("get_object", Params={"Bucket": REPORT_BUCKET, "Key": key}, ExpiresIn=900)

    return resp(200, {"ok": True, "url": url, "s3Key": key, "reportType": rtype,
                      "employeeId": employee_id, "fromDate": start_d.isoformat(),
                      "toDate": end_d.isoformat()})


def handle_tenant_report(qs, company_name, company_ruc, roster_in=None, roster_only=False):
    """Register covering the tenant's staff over any period, in one PDF."""
    tenant_id = (qs.get("tenantId") or "").strip()
    if not tenant_id:
        return resp(400, {"ok": False, "error": "Falta tenantId"})

    segments, period_label, rtype, key_part = resolve_period(qs)
    start_d, end_d = span(segments)
    rtype = rtype + "-all"

    areas = qs_list(qs, "areas", "area")
    cols = qs_list(qs, "cols")
    group_by_area = str(qs.get("groupByArea") or qs.get("group") or "").lower() in ("1", "true", "area", "yes")

    # Day-by-day blocks are the bulk of the document: a year of 40 people is
    # ~14 000 rows. Beyond roughly two months the summary is what gets printed,
    # so the detail is dropped unless the caller explicitly asks for it.
    span_days = total_days(segments)
    detail_raw = str(qs.get("detail") or "").lower()
    if detail_raw in ("1", "true", "yes"):
        detail = True
    elif detail_raw in ("0", "false", "no"):
        detail = False
    else:
        detail = span_days <= 62

    roster = build_roster(tenant_id, segments, roster_in, roster_only, areas)
    if not roster:
        return resp(404, {"ok": False, "error": "No hay empleados ni registros en el período"})

    pdf_bytes = build_consolidated_pdf(
        company_name, company_ruc, period_label, segments, roster,
        cols=cols, group_by_area=group_by_area, detail=detail,
        area_label=", ".join(areas),
    )

    safe_tenant = tenant_id.replace("TENANT#", "").replace("#", "_").replace("/", "_")
    if areas:
        safe_tenant += "_" + area_key(areas[0]).replace(" ", "-")[:24]
    key = "reports/" + rtype + "/" + key_part + "/" + safe_tenant + ".pdf"

    s3.put_object(Bucket=REPORT_BUCKET, Key=key, Body=pdf_bytes, ContentType="application/pdf")
    url = s3.generate_presigned_url("get_object", Params={"Bucket": REPORT_BUCKET, "Key": key}, ExpiresIn=900)

    return resp(200, {"ok": True, "url": url, "s3Key": key, "reportType": rtype,
                      "employeeCount": len(roster), "fromDate": start_d.isoformat(),
                      "toDate": end_d.isoformat(), "detail": detail,
                      "periodLabel": period_label})


def handler(event, context):
    try:
        qs = event.get("queryStringParameters") or {}
        # Company legal name + RUC are resolved by the Next.js backend (which owns
        # the tenant table) and passed in — keeps this Lambda's IAM scope minimal.
        company_name = (qs.get("companyName") or "Novasys").strip()
        company_ruc = (qs.get("companyRuc") or "").strip()
        scope = (qs.get("scope") or "employee").strip().lower()

        if scope == "tenant":
            # Active staff resolved by the caller (see build_roster).
            # rosterOnly means the caller hand-picked the list and nobody else
            # should be added to it.
            return handle_tenant_report(qs, company_name, company_ruc,
                                        event.get("roster"),
                                        bool(event.get("rosterOnly")))
        return handle_employee_report(qs, company_name, company_ruc)

    except ValueError as e:
        # Bad period / bad date: the caller can fix it, so say so with a 400
        # instead of a blank 500.
        return resp(400, {"ok": False, "error": str(e)})
    except Exception as e:
        return resp(500, {"ok": False, "error": str(e)})
