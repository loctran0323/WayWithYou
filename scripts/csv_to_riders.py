#!/usr/bin/env python3
"""
Build riders.json fixture from ORF401 Lab1 - Sheet1.csv.
Updates all fields; for Origin City, extracts and stores only the city name.
"""
import csv
import json
import re
from pathlib import Path

# Common US state abbreviations for extracting city from address
STATE_ABBREVS = {
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC",
}

# Street/address abbreviations: if these appear before the city, city is the following word(s)
STREET_ABBREVS = {
    "st", "st.", "ave", "ave.", "blvd", "dr", "ln", "ln.", "rd", "rd.",
    "way", "pl", "pl.", "ct", "court", "street", "avenue", "boulevard",
    "drive", "lane", "road", "place", "bouldevard", "park", "virginia",
}


def _city_from_address_part(addr: str) -> str:
    """
    From a single part that may be a full address, return only the city.
    E.g. "3000 31st Street Santa Monica" -> "Santa Monica"
         "87 Bond Ln Brentwood" -> "Brentwood"
         "Beverly Hills" -> "Beverly Hills"
    """
    if not addr or not addr.strip():
        return addr
    s = addr.strip()
    # If city is in parentheses, e.g. "1883 Com Stock Avenue (beverley Hills)", use that
    if " (" in s and ")" in s:
        start = s.index(" (") + 2
        end = s.index(")", start)
        return s[start:end].strip()
    tokens = s.split()
    if len(tokens) <= 2:
        return s
    # If second-to-last token looks like street number/designation (e.g. M4), city is last word only
    if any(c.isdigit() for c in tokens[-2]):
        return tokens[-1]
    if tokens[-2].lower() in STREET_ABBREVS:
        return tokens[-1]
    return " ".join(tokens[-2:])


def extract_city_name(origin_raw: str) -> str:
    """
    Extract only the city name from Origin City (may be full address).
    Examples: "145 Copley Pl, Beverly Hills" -> "Beverly Hills"
              "3000 31st Street Santa Monica, CA" -> "Santa Monica"
              "Austin, TX" -> "Austin"
              "Hidden Hills" -> "Hidden Hills"
    """
    if not origin_raw or not origin_raw.strip():
        return ""
    s = origin_raw.strip()
    # Split by comma
    parts = [p.strip() for p in s.split(",") if p.strip()]
    if not parts:
        return s
    if len(parts) == 1:
        # No comma: e.g. "87 Bond Ln Brentwood CA" or "235 S Chadbourne Ave Los Angeles CA 90049"
        tokens = parts[0].split()
        # Strip trailing ZIP (digits) then STATE
        while len(tokens) >= 1 and tokens[-1].isdigit():
            tokens = tokens[:-1]
        while len(tokens) >= 1 and tokens[-1].upper() in STATE_ABBREVS:
            tokens = tokens[:-1]
        if not tokens:
            return parts[0]
        without_state_zip = " ".join(tokens)
        return _city_from_address_part(without_state_zip)
    # Has commas: last part might be state (2 letters) or "STATE ZIP"
    last_part = parts[-1].strip()
    if len(last_part) == 2 and last_part.upper() in STATE_ABBREVS:
        # parts[-2] may be full address like "3000 31st Street Santa Monica"
        return _city_from_address_part(parts[-2]) if len(parts) >= 2 else parts[0]
    if len(parts) >= 2 and len(last_part) > 2 and last_part[:2].upper() in STATE_ABBREVS:
        # e.g. "CA 90275" -> city is parts[-2]
        return parts[-2].strip()
    # Last part not state: use last part (e.g. "..., Beverly Hills")
    last = parts[-1]
    if last.endswith("."):
        last = last.rstrip(".")
    if last in ("California", "United States", "United States."):
        return _city_from_address_part(parts[0]) if parts else s
    return last


def first_name_only(name_raw: str) -> str:
    """
    Store only the first name; remove parenthesized last name.
    E.g. "Sofia (Rich Grainge)" -> "Sofia", "Ciara" -> "Ciara".
    """
    if not name_raw or not name_raw.strip():
        return ""
    s = name_raw.strip()
    # Remove " (Last name)" or "(Last name)" suffix
    if " (" in s and s.endswith(")"):
        return s[: s.index(" (")].strip()
    return s


def parse_bool(val: str) -> bool:
    """Parse CSV boolean (true/false)."""
    return str(val).strip().lower() == "true"


def main():
    base = Path(__file__).resolve().parent.parent
    csv_path = base / "static" / "ORF401 Lab1 - Sheet1.csv"
    out_path = base / "rides" / "fixtures" / "riders.json"

    rows = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, start=1):
            first_name = first_name_only(row.get("First name") or "")
            origin_raw = (row.get("Origin City") or "").strip()
            destination_city = (row.get("Destination City") or "").strip()
            destination_state = (row.get("Destination State") or "").strip()[:2].upper()
            date_raw = (row.get("Date (YY-MM-DD)") or "").strip()
            time_raw = (row.get("Time (ex: 14:25)") or "").strip()
            taking = parse_bool(row.get("Taking Passengers (true/false)", ""))
            try:
                seats = int(row.get("seats_available", 0) or 0)
            except ValueError:
                seats = 0

            # Normalize date to YYYY-MM-DD
            if len(date_raw) == 8 and date_raw[2] == "-":
                date_str = "20" + date_raw  # 25-11-08 -> 2025-11-08
            else:
                date_str = date_raw

            # Time: ensure HH:MM
            if ":" in time_raw:
                time_str = time_raw.strip()[:5]
            else:
                time_str = time_raw.strip()

            origination = extract_city_name(origin_raw)

            rows.append({
                "model": "rides.person",
                "pk": i,
                "fields": {
                    "first_name": first_name,
                    "origination": origination,
                    "destination_city": destination_city,
                    "destination_state": destination_state,
                    "date": date_str,
                    "time": time_str,
                    "taking_passengers": taking,
                    "seats_available": seats,
                },
            })

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(rows, f, indent=2)

    print(f"Wrote {len(rows)} records to {out_path}")


if __name__ == "__main__":
    main()
