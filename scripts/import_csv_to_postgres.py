import argparse
import csv
import os
import re
from datetime import datetime


def load_env(path: str) -> dict:
    env = {}
    if not os.path.exists(path):
        return env
    with open(path, "r", encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            env[key.strip()] = value.strip()
    return env


def sanitize_column(name: str, used: set) -> str:
    col = re.sub(r"[^a-zA-Z0-9_]", "_", name.strip().lower())
    if not col:
        col = "column"
    if re.match(r"^[0-9]", col):
        col = f"col_{col}"
    original = col
    i = 1
    while col in used:
        i += 1
        col = f"{original}_{i}"
    used.add(col)
    return col


def detect_type(value: str) -> str:
    if value is None:
        return "null"
    v = value.strip()
    if v == "":
        return "null"
    low = v.lower()
    if low in {"true", "false"}:
        return "bool"
    if re.fullmatch(r"[+-]?\d+", v):
        return "int"
    if re.fullmatch(r"[+-]?\d*\.\d+", v):
        return "float"
    # date or datetime in common ISO formats
    for fmt in ("%Y-%m-%d", "%Y/%m/%d"):
        try:
            datetime.strptime(v, fmt)
            return "date"
        except ValueError:
            pass
    for fmt in (
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
    ):
        try:
            datetime.strptime(v, fmt)
            return "timestamp"
        except ValueError:
            pass
    return "text"


def merge_types(existing: str, new: str) -> str:
    if existing == "text" or new == "text":
        return "text"
    if existing == "null":
        return new
    if new == "null":
        return existing
    if existing == new:
        return existing
    if {"int", "float"} == {existing, new}:
        return "float"
    if {"date", "timestamp"} == {existing, new}:
        return "timestamp"
    return "text"


def postgres_type(kind: str) -> str:
    return {
        "int": "bigint",
        "float": "double precision",
        "bool": "boolean",
        "date": "date",
        "timestamp": "timestamp",
        "text": "text",
        "null": "text",
    }[kind]


def infer_schema(csv_path: str, sample_size: int) -> tuple[list[str], list[str]]:
    with open(csv_path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        headers = next(reader)
        used = set()
        columns = [sanitize_column(h, used) for h in headers]
        types = ["null"] * len(columns)
        for i, row in enumerate(reader):
            for idx, cell in enumerate(row):
                if idx >= len(types):
                    continue
                types[idx] = merge_types(types[idx], detect_type(cell))
            if i + 1 >= sample_size:
                break
    # Force postal/zip columns to text to avoid invalid numeric casts.
    for idx, col in enumerate(columns):
        if "zip" in col or "postal" in col:
            types[idx] = "text"
    return columns, [postgres_type(t) for t in types]


def ensure_db(conn, db_name: str) -> None:
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db_name,))
        if cur.fetchone():
            return
        cur.execute(f'CREATE DATABASE "{db_name}"')


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", required=True)
    parser.add_argument("--db-name", required=True)
    parser.add_argument("--table", required=True)
    parser.add_argument("--env-file", default=".env")
    parser.add_argument("--sample-size", type=int, default=1000)
    args = parser.parse_args()

    env = load_env(args.env_file)
    host = env.get("DB_HOST", "localhost")
    port = int(env.get("DB_PORT", "5432"))
    user = env.get("DB_USER", "postgres")
    password = env.get("DB_PASSWORD", "")

    try:
        import psycopg
    except Exception:
        print("psycopg is not installed. Run: pip install psycopg[binary]")
        return 1

    columns, types = infer_schema(args.csv, args.sample_size)
    col_defs = ", ".join(f'"{c}" {t}' for c, t in zip(columns, types))

    base_conninfo = {
        "host": host,
        "port": port,
        "user": user,
        "password": password,
        "dbname": "postgres",
    }

    with psycopg.connect(**base_conninfo, autocommit=True) as conn:
        ensure_db(conn, args.db_name)

    target_conninfo = dict(base_conninfo)
    target_conninfo["dbname"] = args.db_name

    with psycopg.connect(**target_conninfo) as conn:
        with conn.cursor() as cur:
            cur.execute(f'DROP TABLE IF EXISTS "{args.table}"')
            cur.execute(f'CREATE TABLE "{args.table}" ({col_defs})')
            with open(args.csv, "r", encoding="utf-8-sig", newline="") as f:
                column_list = ", ".join(f'"{c}"' for c in columns)
                copy_sql = (
                    f'COPY "{args.table}" ({column_list}) '
                    "FROM STDIN WITH CSV HEADER NULL 'NULL'"
                )
                with cur.copy(copy_sql) as copy:
                    for row in f:
                        copy.write(row)
        conn.commit()

    print(f"Imported {args.csv} into {args.db_name}.{args.table}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
